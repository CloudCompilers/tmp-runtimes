"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lambdaProxyCaller = lambdaProxyCaller;
const s3fs = require("./s3fs");
const uuid = require('uuid').v4;
const _ = require('lodash');
const delay = require('delay');
//TODO: Use env variables injected during emulation?
let awsLocalAddress = process.env["AWS_ENDPOINT"] ? `http://${process.env["AWS_ENDPOINT"]}` : null;
let targetRegion = process.env["AWS_TARGET_REGION"];
let { lambda, s3 } = s3fs.getAWSClients(awsLocalAddress, targetRegion);
async function lambdaProxyCaller(callType, execGroupName, moduleName, functionName, params) {
    let payloadKey = uuid();
    await s3fs.saveParametersToS3(payloadKey, params);
    let physicalAddress = getExecUnitLambdaFunctionName(execGroupName);
    console.log(`CALLING ${execGroupName} || ${moduleName} || ${functionName} || PayloadKey: ${payloadKey}`);
    const payloadToSend = {
        "__moduleName": moduleName,
        "__functionToCall": functionName,
        "__params": payloadKey,
        "__callType": callType
    };
    try {
        let invokeParams = {
            FunctionName: physicalAddress,
            InvocationType: callType == "emitter" ? "Event" : "RequestResponse",
            Payload: JSON.stringify(payloadToSend)
        };
        let result = await lambda.invoke(invokeParams).promise();
        if (callType == "emitter") {
            return;
        }
        else {
            let dispatcherParamKeyResult = JSON.parse(result.Payload);
            return await s3fs.getCallParameters(dispatcherParamKeyResult, false);
        }
    }
    catch (e) {
        console.error(e);
        return;
    }
}
exports.fs = {
    writeFile: s3fs.s3_writeFile,
    readFile: s3fs.s3_readFile,
    readdir: s3fs.s3_readdir,
    access: s3fs.s3_exists
    // listContents: s3fs.userS3fs.listContents,    
    // createReadStream: s3fs.userS3fs.createReadStream,
    // createWriteStream: s3fs.userS3fs.createWriteStream
};
function getAWSConfig(isLocalstack, configFields) {
    let allConfig = _.toPairs(configFields);
    let desiredConfigs = _.intersectionWith(_.toPairs(allConfig), configFields, (confKey, field) => confKey == field);
    _.toPairs(configFields).filter(x => allConfig);
    if (awsLocalAddress) {
        // @ts-ignore
        return {
            accessKeyId: "test",
            secretAccessKey: "test",
            skipMetadataApiCheck: true,
            region: targetRegion,
            s3ForcePathStyle: true,
        };
    }
}
function getExecUnitLambdaFunctionName(logicalName) {
    let realFunctionName; //Default
    switch (logicalName) {
        case "cc_api":
            realFunctionName = "cc_api-58096";
            break;
        case "cc_thin_cli":
            realFunctionName = "cc_thin_cli-4c621";
            break;
        case "cc_compiler":
            realFunctionName = "cc_compiler-98529";
            break;
        default:
            realFunctionName = logicalName;
    }
    return realFunctionName;
}
