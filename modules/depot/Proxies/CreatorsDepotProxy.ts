import https from "https";
import ICreatorsDepotProxy from "./ICreatorsDepotProxy";
const strf = require('string-format');

class CreatorsDepotProxy implements ICreatorsDepotProxy{
    
    private allContentURL = "https://creators.tf/api/IDepots/GVersionInfo?depid=1&tags=content";
    private downloadRequestURL = "https://creators.tf/api/IDepots/GDownloadFile?depid=1&file={0}";

    async GetDepotData() : Promise<any> {        
        const buf = await this.Get(this.allContentURL);
        return JSON.parse(buf.toString());  
    }

    async DownloadFile(remotePath: string) : Promise<Buffer> {    
        //Format request url, then fix the slashes used
        let fileReqURL = strf(this.downloadRequestURL, remotePath);
        fileReqURL = fileReqURL.replace(/\\/g,"/");    

        return await this.Get(this.allContentURL);
    }

    private Get(url: string) : Promise<Buffer> {
        return new Promise((resolve, reject) => {
            var options = {
                headers: {
                    'User-Agent': 'creators-tf-launcher'
                }
            };

            var req = https.get(url, options, function (res : any) {
                if (res.statusCode !== 200) {
                    let error = `Request '${url}' failed, response code was: ${res.statusCode}`;
                    reject(error);
                }
                else {  
                    var data: any[] = [];
    
                    res.on("data", function (chunk: string | any[]) {
                        data.push(chunk);
                    });
    
                    res.on("end", () => {
                        var buf = Buffer.concat(data);

                        resolve(buf);
                    });
                }
            });

            req.on("error", function (err : any) {
                reject(err.toString());
            });
        });
    }
}

export default CreatorsDepotProxy;
export {CreatorsDepotProxy};