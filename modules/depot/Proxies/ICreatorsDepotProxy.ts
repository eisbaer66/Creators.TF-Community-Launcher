interface ICreatorsDepotProxy{
    GetDepotData() : Promise<any>;
    DownloadFile(remotePath: string) : Promise<Buffer>
}

export default ICreatorsDepotProxy;
export {ICreatorsDepotProxy};