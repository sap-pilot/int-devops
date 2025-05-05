const fs = require("fs");
const path = require("path");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const { logger } = require("./logger");
const { config } = require("./config");

/**
 * get contentResources from remote content agent services via specified 'CAS_*' destinations
 */
const getTmsLandscapeSync = async function(req) {
    const tmsLandscape = await getTmsLandscapeAsync(req);
    return tmsLandscape;
}

const getTmsLandscapeFromCache = async function(req) {
    const cachePath = config.cachedTmsLandscapePath;
    const forceRefresh = req.data.forceRefresh;
    const startTime = Date.now();
    let data = {};
    logger.info(`serving tms landscape for user=${req.user?req.user.id:'n/a'}, forceRefresh=${forceRefresh}`);
    if (!forceRefresh && fs.existsSync(cachePath)) {
        // try to load result from local fs first
        // logger.debug(`serving cached contentResources from "${cachePath}"`)
        const rawData = fs.readFileSync(cachePath, 'utf8');
        data = JSON.parse(rawData);
        // await new Promise(r => setTimeout(r, 5000));
    } else {
         // forceRefresh or cache file doesn't exist, so we should read data from remote resource
        data = await getTmsLandscapeSync(req);
        // now try to write data into local cache file
        try {
            logger.debug(`writing tms landscape info into "${cachePath}"`);
            let dirname = path.dirname(cachePath);
            if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname);
            }
            const dataString = JSON.stringify(data,null,2);
            fs.writeFileSync(cachePath, dataString);
        } catch (error) {
            logger.error(`failed tms landscape info into "${cachePath}": ${error}`,error);
        }
    }
    const durationMs = Date.now() - startTime;
    logger.debug(`completed serving tms landscape, takes time ${durationMs} ms`);
    return data;
}

/**
 * get tmsLandscape asynch
 * @returns promise
 */
const getTmsLandscapeAsync = async function(req, bSupressError) {
    const startTime = Date.now();
    const tmsLandscape = { nodes: [], routes: [] };
    const tmsDestination = config.tmsDestination;

    try {
        logger.info(`get tms nodes/routes from destination '${tmsDestination}'`);
        const nodesResult = await executeHttpRequest({ destinationName: tmsDestination }, {
            method: "GET",
            url: "/v2/nodes"
        });
        if (!nodesResult.data || !nodesResult.data.nodes) {
            logger.warn(`no nodes found, response: ${JSON.stringify(nodesResult.data, null, 2)}`);
            throw new Error(`no nodes found`);
        }
        tmsLandscape.nodes = nodesResult.data.nodes;

        const routesResult = await executeHttpRequest({ destinationName: tmsDestination }, {
            method: "GET",
            url: "/v2/routes"
        });
        if (!routesResult.data || !routesResult.data.routes) {
            logger.warn(`no routes found, response: ${JSON.stringify(routesResult.data, null, 2)}`);
            throw new Error(`no routes found`);
        }
        tmsLandscape.routes = routesResult.data.routes;
        
        return tmsLandscape;
    } catch (error) {
        if (bSupressError) {
            logger.error(`failed to load tms nodes/routes: ${error.message}`, {cause:error});
            tmsLandscape.error = error.message;
            return tmsLandscape;
        } else {
            throw new Error(`failed to load tms nodes/routes: ${error.message}`, {cause:error});
        }
    } finally {
        const durationMs = Date.now() - startTime;
        const oSimplifiedLandscape = {
            nodes : tmsLandscape.nodes.map(node => ({
                idx: node.id,
                name: node.name,
            })),
            routes : tmsLandscape.routes.map(route => ({
                sourceNodeId: route.sourceNodeId,
                targetNodeId: route.targetNodeId,
            })),
        }
        logger.debug(`completed loading tms nodes and routes, total time ${durationMs} ms, result: ${JSON.stringify(oSimplifiedLandscape, null, 2)}`);
    }
};

module.exports = { getTmsLandscapeFromCache, getTmsLandscapeSync, getTmsLandscapeAsync };
