class ChecksumWorkerData {
    public filePath : string;
    public fileContent : Buffer|null;
    public localMd5Hash : string;
    public remoteMd5Hash : string;
    public remotePath : string;
    
    public computed : boolean;
    public ismatch : boolean;
    public fileExisted : boolean;

    constructor(fPath : string, fileContent: Buffer|null, md5 : string, remotePath : string){
        this.filePath = fPath;
        this.fileContent = fileContent;
        this.remoteMd5Hash = md5;
        this.localMd5Hash = "";
        this.computed = false;
        this.ismatch = false;
        this.fileExisted = fileContent != null;
        this.remotePath = remotePath;
    }
}
interface CommData {
    port: MessagePort;
    data: ChecksumWorkerData;
  }

export {ChecksumWorkerData, CommData};
