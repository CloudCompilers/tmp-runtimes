"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function lambdaHandler(event, context) {
    console.log(`cc_api Dispatched`);
    let { __callType, __functionToCall, __moduleName, __params: payloadKey, path: eventPathEntry } = event;
    let mode = parseMode(__callType, eventPathEntry);
    if (!mode)
        return InvalidModeError();
    let parameters = payloadKey ? await s3fs.getCallParameters(payloadKey, mode) : {};
    if (!parameters)
        return MissingParametersError();
    switch (mode) {
        case "webserver":
            return webserverResponse(event, context);
        case "emitter":
            return await activate_emitter(__functionToCall, __moduleName, parameters, payloadKey);
        case "rpc":
            return await handle_rpc_call(__functionToCall, __moduleName, parameters);
    }
}
async function handle_rpc_call(__functionToCall, __moduleName, parameters) {
    try {
        let result = await require(path.join("../", __moduleName))[__functionToCall].apply(null, parameters);
        let payloadKey = uuid.v4();
        await s3fs.saveParametersToS3(payloadKey, result);
        return payloadKey;
    }
    catch (e) {
        console.error(e);
        return JSON.stringify(e);
    }
}
async function activate_emitter(__functionToCall, __moduleName, parameters, payloadKey) {
    try {
        const [emitterVariableName, emitterMsgName] = __functionToCall === null || __functionToCall === void 0 ? void 0 : __functionToCall.split(":");
        let emitter = require(path.join("../", __moduleName))[emitterVariableName];
        await emitter.emit(emitterMsgName, parameters);
        await s3fs.saveParametersToS3("/dev/null", "");
        return payloadKey;
    }
    catch (e) {
        console.error(e);
        return JSON.stringify(e);
    }
}
function parseMode(__callType, eventPathEntry) {
    if (__callType === "emitter")
        return "emitter";
    if (eventPathEntry)
        return "webserver";
    if (__callType === "rpc")
        return "rpc";
    // Otherwise, runtime error
    return;
}
function webserverResponse(event, context) {
    try {
        let app = require("../index.js").app;
        const serverlessExpress = require('@vendia/serverless-express');
        return serverlessExpress({ app }).apply(null, [event, context]);
    }
    catch (e) {
        console.log(e);
        return JSON.stringify(e);
    }
}
function MissingParametersError() {
    const errorMsg = `CloudCC Runtime Error: Expected Parameters`;
    console.error(errorMsg);
    return JSON.stringify(new Error(errorMsg));
}
function InvalidModeError() {
    const errorMsg = `CloudCC Runtime Error: Invalid Dispatcher Mode`;
    console.error(errorMsg);
    return JSON.stringify(new Error(errorMsg));
}
const s3fs = require('./s3fs');
const uuid = require("uuid");
const path = require("path");
let wrappedHandler = lambdaHandler;
//const lumigo = require('@lumigo/tracer')({ token: 't_13478b22d8c54138a701d' }); // Compiler
const lumigo = require('@lumigo/tracer')({ token: 't_87b29e27628f459790e43' }); // Apps
wrappedHandler = lumigo.trace(wrappedHandler);
exports.handler = wrappedHandler;
