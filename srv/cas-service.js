const fs = require("fs");
const path = require("path");
const cds = require("@sap/cds");
const { logger } = require("./lib/logger");
const { config } = require("./lib/config");
const { getContentResources, exportContent, queryActivity } = require("./lib/cas");
const { message } = require("@sap/cds/lib/log/cds-error");

module.exports = cds.service.impl(srv => {
    srv.on("resources", getResources);
    srv.on("export", handleExport);
    srv.on("activity", getActivity);
});

/**
 * get contengResouces and tmsLandscape from either local cache (if exist and not forceRefresh) 
 *  or from actual content-agent-engine/tms services
 * 
 * @param req.data.forceRefresh [false|true] whether to skip cache and force load data from remote services 
 * @returns {
 *      "i": "contentResources",
 *      "tmsUrl": "XX",
 *      "countCasNodes": 4,
 *      "nodes": [
 *          {"idx":0,"group":0,"alias":"DEV","tmsNode":"INT_DEV","casDest":"CAS_DEV","casUrl":"XX","r":{"package":6,"IFlow":15,"APIProvider":11,"proxy":18}},
 *          {"idx":1,"group":1,"alias":"STG","tmsNode":"INT_STG","casDest":"CAS_STG","casUrl":"XX","r":{"package":5,"IFlow":12,"APIProvider":10,"proxy":12}},
 *          {"idx":2,"group":2,"alias":"PRE","tmsNode":"INT_PRE","casDest":"CAS_PRE","casUrl":"XX","r":{"package":5,"IFlow":10,"APIProvider":10,"proxy":15}},
 *          {"idx":3,"group":3,"alias":"PROD","tmsNode":"INT_PROD","casDest":"CAS_PROD","casUrl":"XX","r":{"error":"Permission denied"}}
 *       ],
 *      "groups": [
 *          {"idx":0,"name":"Sandbox"},
 *          {"idx":1,"name":"Development"},
 *          {"idx":2,"name":"Staging"},
 *          {"idx":3,"name":"Preprod"},
 *          {"idx":4,"name":"Production"}
 *       ],
 *       "routes": [
 *          {"from":0,"to":1},
 *          {"from":1,"to":2},
 *          {"from":2,"to":3}
 *       ],
 *      "c": [
 *          {"n": "Cloud Integration","v0":"1.0.0","c":[
 *              {"i":"Finance","n":"Finance","v0":"1.0.0"}
 *          ]},
 *          {"n": "API Management","v0":"1.0.0","c":[
 *              {"i":"proxy","n":"proxy","v0":"1.0.0","c":[
 *                   {"i":"xxx","n":"JointVenture","v0":"1.0.0"}
 *              ]}
 *          ]},
 *      ]
 * } 
 */
const getResources = async function(req) {
    const forceRefresh = req.data.forceRefresh; 
    let result = null;
    const cachePath = config.cachedContentResourcePath;
    const startTime = Date.now();
    let data = {};
    logger.info(`serving contentResources for user=${req.user?req.user.id:'n/a'}, forceRefresh=${forceRefresh}`);
    if (!forceRefresh && fs.existsSync(cachePath)) {
        // try to load result from local fs first
        // logger.debug(`serving cached contentResources from "${cachePath}"`)
        const rawData = fs.readFileSync(cachePath, 'utf8');
        data = JSON.parse(rawData);
        //await new Promise(r => setTimeout(r, 10000));
    } else {
         // forceRefresh or cache file doesn't exist, so we should read data from remote resource
        data = await getContentResources(req);
        // now try to write data into local cache file
        try {
            logger.debug(`writing contentResources into "${cachePath}"`);
            let dirname = path.dirname(cachePath);
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname);
            }
            const dataString = JSON.stringify(data,null,2);
            fs.writeFileSync(cachePath, dataString);
        } catch (error) {
            logger.error(`failed to write contentResources into "${cachePath}": ${error}`,error);
        }
    }
    const durationMs = Date.now() - startTime;
    logger.debug(`completed serving contentResource, takes time ${durationMs} ms`);
    return data;
}

const handleExport = async function(req) {  
    const startTime = Date.now();
    const oPayload = {
        userId: req.user?.id,
        casDestination: req.data?.casDestination,
        targetTmsNodeId : req.data?.targetTmsNodeId,
        countContentResources: req.data?.countContentResources,
        payload: JSON.parse(req.data?.payload)
    }
    oPayload.payload.transportUser = req.user?.id;
    logger.info(`handling export request: ${JSON.stringify(oPayload,null,2)}`);
    const exportResponse = await exportContent(oPayload) || {};
    // await new Promise(r => setTimeout(r, 5000));
    // const result = {
    //     message: "Export into TMS completed successfully",
    //     type: "Success",
    //     tr: "193861"
    // }
    const exportTime = Date.now();
    logger.debug(`completed export contentResource, takes time ${exportTime - startTime} ms, response: ${JSON.stringify(exportResponse)}`);
    if (!exportResponse.activityId) {
        throw new Error(`activityId not found in export response: ${JSON.stringify(exportResponse)}`);
    }
    const activityResponse = await queryActivity(oPayload.casDestination, exportResponse.activityId);
    logger.debug(`got activity from casDestination: ${oPayload.casDestination}, activityId: ${exportResponse.activityId}, takes time ${exportTime - startTime} ms, response: ${JSON.stringify(activityResponse)}`);
    return activityResponse;
}

const getActivity = async function(req) {
    const casDestination = req.data?.casDestination;
    const activityId = req.data?.activityId;
    const startTime = Date.now();
    const activityResponse = await queryActivity(casDestination, activityId);
    logger.debug(`got activity for userId: ${req.user?.id} from casDestination: ${casDestination}, activityId: ${activityId}, takes time ${Date.now() - startTime} ms, response: ${JSON.stringify(activityResponse)}`);
    return activityResponse;
}