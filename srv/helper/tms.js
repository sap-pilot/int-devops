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

/**
 * get tmsLandscape asynch
 * @returns promise
 */
const getTmsLandscapeAsync = async function(req) {
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
        throw new Error(`failed to load tms nodes/routes: ${error.message}`, {cause:error});
    } finally {
        const durationMs = Date.now() - startTime;
        logger.debug(`completed loading tms nodes and routes, total time ${durationMs} ms`);
    }
};

module.exports = { getTmsLandscapeSync, getTmsLandscapeAsync };
