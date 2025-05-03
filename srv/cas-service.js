const fs = require("fs");
const path = require("path");
const cds = require("@sap/cds");
const { logger } = require("./helper/logger");
const { config } = require("./helper/config");
const { getContentResources } = require("./helper/cas");

module.exports = cds.service.impl(srv => {
    srv.on("resources", getResources);
});

/**
 * get contengResouces and tmsLandscape from either local cache (if exist and not forceRefresh) 
 *  or from actual content-agent-engine/tms services
 * 
 * @param req.data.forceRefresh [false|true] whether to skip cache and force load data from remote services 
 * @returns {
 *      "i": "contentResources",
 *       "nodes": [
 *          {"idx":0,"group":0,"alias":"DEV","tmsNode":"INT_DEV","dest":"CAS_DEV","r":{"package":6,"IFlow":15,"APIProvider":11,"proxy":18}},
 *          {"idx":1,"group":1,"alias":"STG","tmsNode":"INT_STG","dest":"CAS_STG","r":{"package":5,"IFlow":12,"APIProvider":10,"proxy":12}},
 *          {"idx":2,"group":2,"alias":"PRE","tmsNode":"INT_PRE","dest":"CAS_PRE","r":{"package":5,"IFlow":10,"APIProvider":10,"proxy":15}},
 *          {"idx":3,"group":3,"alias":"PROD","tmsNode":"INT_PROD","dest":"CAS_PROD","r":{"error":"Permission denied"}}
 *       ],
 *      "groups": [
 *          {"idx":0,"name":"Development"},
 *          {"idx":1,"name":"Staging"},
 *          {"idx":2,"name":"Preprod"},
 *          {"idx":3,"name":"Production"}
 *       ],
 *       "lines": [
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
        // await new Promise(r => setTimeout(r, 5000));
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