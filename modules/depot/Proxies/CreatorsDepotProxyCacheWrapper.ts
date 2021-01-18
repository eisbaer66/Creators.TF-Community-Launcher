import ICreatorsDepotProxy from "./ICreatorsDepotProxy";


class CreatorsDepotProxyCacheWrapper implements ICreatorsDepotProxy{    
    private allDepotData : string | undefined;
    constructor(private proxy: ICreatorsDepotProxy){ }

    async GetDepotData() : Promise<any> {
        if (this.allDepotData == undefined){
            this.allDepotData = await this.proxy.GetDepotData();
        }        
        
        return this.allDepotData;
    }

    async DownloadFile(remotePath: string) : Promise<Buffer> {    
        return await this.proxy.DownloadFile(remotePath);
    }
}

export default CreatorsDepotProxyCacheWrapper;
export {CreatorsDepotProxyCacheWrapper};