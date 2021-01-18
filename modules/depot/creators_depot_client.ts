import fs from "fs";
import _crypto from "crypto";
import path from "path";
const log = require("electron-log");
const ProgressBar = require("electron-progressbar");
import { Worker, MessagePort, MessageChannel } from 'worker_threads';
import {ChecksumWorkerData} from "./ChecksumWorkerData";
import { Utilities } from "../utilities";
import ICreatorsDepotProxy from "./Proxies/ICreatorsDepotProxy";

//Checks for updates of local files based on their md5 hash.
class CreatorsDepotClient {

    private proxy : ICreatorsDepotProxy;
    private modPath : string;
    private filesToUpdate : Array<ChecksumWorkerData> = [];
    private MaxConcurrentDownloads = 3;
    private updateActive = false;
    private currentDownloads = 0;
    private workerThreadCount = 6;

    constructor(modpath : string, proxy : ICreatorsDepotProxy){
        this.modPath = modpath;
        this.proxy = proxy;
    }

    public CheckForUpdates() : Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            var data : any;
            try{
                data = await this.proxy.GetDepotData();
            }
            catch(error){
                reject(error);
            }

            log.log("Processing DepotData");

            if(data.result != "SUCCESS"){
                reject(`Server error, status was: ${data.result}`);
                return;
            }

            const fileCount = data.groups.map((g:any) => g.files).reduce((a:any, b:any) => a.concat(b)).length;

            //@ts-ignore
            var progressBar = Utilities.GetNewLoadingPopup("Checking files for updates", global.mainWindow, reject);
            var detailStr = "Checking files ";
            progressBar.detail = detailStr + `(${0}/${fileCount}) files checked.`;

            const processedWorkerData = await this.GenerateHashes(reject, data, progressBar, detailStr, fileCount);
            
            for(var processedData of processedWorkerData){
                if(!processedData.ismatch){
                    this.filesToUpdate.push(processedData);
                }
            }

            log.log("Processed DepotData");

            progressBar.setCompleted();
            resolve(this.filesToUpdate.length > 0);
        });
    }

    private GenerateHashes(rejectParent: (reason?: any) => void, data: any, progressBar: any, detailStr: string, fileCount: any) {
        return new Promise<ChecksumWorkerData[]>(async (resolve, reject) => {

            var processedWorkerData = new Array<ChecksumWorkerData>();
            const workers = new Array<Worker>();
            for (var i = 0; i < this.workerThreadCount; i++) {
                const worker = this.SetupChecksumWorker(rejectParent);
                workers.push(worker);
            }

            let fileIndex = 0;
            for (var group of data.groups) {
                var dir = group.directory.local;
                dir = dir.replace("Path_Mod", this.modPath);
                dir = path.normalize(dir);
                for (var fileData of group.files) {
                    let filePath = fileData[0];
                    let hash = fileData[1];

                    let remotePath = path.join(group.directory.remote, filePath.replace("\\", "/"));
                    const absoluteFilePath = path.join(dir, filePath);
                    if (fs.existsSync(absoluteFilePath)) {
                        const file = fs.readFileSync(absoluteFilePath);
                        const data = new ChecksumWorkerData(absoluteFilePath, file, hash, remotePath);

                        const { port1, port2 } = new MessageChannel();
                        port1.on('message', (result) => {
                            processedWorkerData.push(result);
                            progressBar.detail = detailStr + `(${processedWorkerData.length}/${fileCount}) files checked.`;
                            if (processedWorkerData.length == fileCount)
                                resolve(processedWorkerData);
                        });
                        
                        workers[fileIndex % this.workerThreadCount].postMessage({ port: port2, data: data }, [port2]);
                    }
                    else {
                        const data = new ChecksumWorkerData(absoluteFilePath, null, hash, remotePath);
                        processedWorkerData.push(data);
                    }

                    fileIndex++;
                }
            }
        });
    }

    private SetupChecksumWorker(reject : (reason?: any) => void) : Worker {
        const worker = new Worker(path.join(__dirname, 'checksum_worker.js'));
        worker.on('error', (e) => {
                reject(e);
            });
        worker.on('exit', (code) => {
                if (code !== 0)
                    reject(new Error(`Worker stopped with exit code ${code}`));
            });
        return worker;
    }

    public async UpdateFiles(mainWindow : any, app : any, loadingTextStyle : any) : Promise<void> {
        return new Promise((resolve, reject) => {
            if(this.filesToUpdate.length > 0){
                var progressBar = new ProgressBar({
                    indeterminate: false,
                    text: "Downloading Mod Files",
                    detail: "Starting Download...",
                    abortOnError: true,
                    closeOnComplete: false,
                    maxValue: this.filesToUpdate.length,
                    browserWindow: {
                        webPreferences: {
                            nodeIntegration: true
                        },
                        width: 550,
                        parent: mainWindow,
                        modal: true,
                        title: "Downloading Mod Files",
                        backgroundColor: "#2b2826",
                        closable: true
                    },
                    style: {
                        text: loadingTextStyle,
                        detail: loadingTextStyle,
                        value: loadingTextStyle
                    }
                }, app);
    
                //Setup events to display data.
                progressBar
                .on('completed', function () {
                    //progressBar.detail = 'Download Finished!';
                })
                .on('aborted', function (value : any) {
                    reject("Download Cancelled by User!");
                });

                this.updateActive = true;
                var currentIndex = 0;

                //Start downloads equal to files to update length or max amount, whichever is smaller.
                for(var i = 0; i < Math.min(this.filesToUpdate.length, this.MaxConcurrentDownloads); i++){
                    //Download the file then write to disk strait away.
                    try{
                        this.UpdateNextFile(currentIndex, progressBar);
                        currentIndex++;
                    }
                    catch(error : any){
                        reject(error);
                    }
                }

                if(currentIndex < this.filesToUpdate.length){
                    var checkFunction = () => {
                        if(this.currentDownloads > 0 && this.updateActive){
                            //Can we start updating a new file?
                            if(this.currentDownloads < this.MaxConcurrentDownloads){
                                if(currentIndex < this.filesToUpdate.length){
                                    try{
                                        this.UpdateNextFile(currentIndex, progressBar);
                                        currentIndex++;
                                    }
                                    catch(error : any){
                                        reject(error);
                                    }
                                }
                                else if(this.currentDownloads == 0){
                                    this.updateActive = false;
                                    progressBar.setCompleted();
                                    progressBar.close();
                                    resolve();
                                }
                            }

                            //Recheck this in 100ms.
                            setTimeout(checkFunction, 100);
                        }

                        if(!this.updateActive){
                            resolve();
                        }
                    };

                    checkFunction();
                }
            }
        });
    }

    //Start a download and write the first file from the queue. 
    private async UpdateNextFile(index : number, progressBar : any) {
        var fileToUpdate = this.filesToUpdate[index];

        this.currentDownloads++;
        const fileBuffer = await this.proxy.DownloadFile(fileToUpdate.remotePath);
        
        progressBar.detail = "Downloaded " + fileToUpdate.remotePath;
        progressBar.value++;
        this.WriteFile(fileToUpdate.filePath, fileBuffer);
        this.currentDownloads--;
    }

    private WriteFile(targetpath : string, data : Buffer){
        log.log(`Writing file "${targetpath}"`);
        let dir = path.dirname(targetpath);

        if(!fs.existsSync(dir)){
            fs.mkdirSync(dir, {recursive: true});
        }
        
        fs.writeFileSync(targetpath, data);
    }
}

export {CreatorsDepotClient};