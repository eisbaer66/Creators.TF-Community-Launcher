import { ChecksumWorkerData, CommData } from "./ChecksumWorkerData";
import _crypto from "crypto";
const {parentPort} = require('worker_threads');

function Process(data: ChecksumWorkerData) : ChecksumWorkerData {
    if (data.fileContent == null)
        throw new Error("fileContent not set");

    let hash = _crypto.createHash("md5").update(data.fileContent).digest("hex");
    data.localMd5Hash = hash;
    data.ismatch = (hash == data.remoteMd5Hash);

    return data;
}

parentPort.on('message', (data:CommData) => {
    const result = Process(data.data);    
    data.port.postMessage(result);
  });