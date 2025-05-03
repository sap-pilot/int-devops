const fs = require("fs");
const path = require("path");
const cds = require("@sap/cds");
const { getAllDestinationsFromDestinationService } = require("@sap-cloud-sdk/connectivity");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const { logger } = require("./helper/logger");
const { config } = require("./helper/config");

module.exports = cds.service.impl(srv => {
    srv.on("resources", getResources);
});

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
        data = await getRemoteResources(req);
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

/**
 * get resource from remote content agent services via specified 'CAS_*' destinations
 */
const getRemoteResources = async function(req) {
    try {
        // get list of destinations
        const allDestinations = await getAllDestinationsFromDestinationService();
        // filter conten-agent destiation with prerix 'CAS_' and additional property 'TMS_NODE'
        const filteredDestinations = allDestinations.filter(dest => dest.name.startsWith("CAS_") && dest.originalProperties.TMS_NODE);
        if (!filteredDestinations || filteredDestinations.length == 0) 
            throw new Error(`no Content Agent destination found with prefix 'CAS_' and 'TMS_NODE' property`);
        let nodes = filteredDestinations.map(dest => ({
            idx: dest.originalProperties.NODE_ORDER,
            group: dest.originalProperties.NODE_GROUP,
            alias: dest.originalProperties.NODE_ALIAS || dest.originalProperties.TMS_NODE.split("_").at(-1),
            tmsNode: dest.originalProperties.TMS_NODE,
            dest: dest.name,
            r: {},
            obj: {}, // result object to be deleted after merge
        }));
        nodes = nodes.sort((a, b) => (a.idx == b.idx)? 0 : ((a.idx > b.idx)? 1 : -1));
        const groups = [];
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].idx = i; // reset index for later tree column display
            let g = groups.find((group) => group.name == nodes[i].group);
            if (!g) {
                g = {idx: groups.length, name: nodes[i].group};
                groups.push(g);
            }
            nodes[i].group = g.idx; // reset group name to index
        }
        const startTime = Date.now();
        logger.info(`loading contentResources for nodes ${JSON.stringify(nodes,null,2)}`);
        const promises = [];
        for (const node of nodes) {
            let p = executeHttpRequest({destinationName: node.dest}, { 
                method: "GET", 
                url: "/v1/contentResources?filters=(type eq 'API Management') or (type eq 'Cloud Integration')" 
            })
            p.then(result => {
                // check if response is valid
                if (!result.data || !result.data.contentResources) {
                    logger.warn(`no data.contentResources found from destination '${node.dest}', response: ${JSON.stringify(resp.data,null,2)}`);
                    throw new Error(`no data.contentResource found from destination '${node.dest}'`);
                }
                node.obj = _reorgResources(result.data, node.r); // parse/reorg and count resources by subType
            })
            .catch(error => {
                node.r.error = error.message;
                logger.warn(`failed to load contentResource from destination ${node.dest}: ${error}`,error);
            })
            .finally(() => {
                const durationMs = Date.now() - startTime;
                logger.debug(`completed loading contentResource from ${node.dest}, takes time ${durationMs} ms, result: ${JSON.stringify(node.r,null,2)}`);
            });
            promises.push(p);
        }
        // wait for all promises to complete
        await Promise.all(promises);
        const durationMs = Date.now() - startTime;
        logger.debug(`completed loading contentResources from all nodes, takes time ${durationMs} ms`);
        // merge objs array into single contentResources
        const merged = {
            "repoUrl": config.repoUrl,
            "table": {}, // to bev deleted after merge
            "nodes": nodes, // array of {tmsNode, alias} for instance {name:'PRE2',tmsNode:'INT_PRE2'}
            "groups": groups,
            "c": []
        };
        for (const node of nodes) {
            const v = `v${node.idx}`;
            _recursiveMerge(node.obj, merged, v);
            delete node.obj; // merged, delete this obj to avoid excessive result in response
        }
        _calculateStatus(merged, nodes.length);
        _recursiveDelete(merged,["table"]);
        _recursiveSort(merged);
        return merged;
    } catch (error) {
        throw new Error(`Failed to read remote resources from content-agent service: ${error}`,{cause: error});
    }
}

const getLocalResources = function(req) {
    try {
        const files = ['./tmp/tmp-res-stg.json','./tmp/tmp-res-pre2.json','./tmp/tmp-res-pre3.json','./tmp/tmp-res-pre.json'];
        const objs = [];
        // parse data into objs array
        for (const [idx, file] of files.entries()) {
            const data = fs.readFileSync(file, 'utf8');
            const parsedData = JSON.parse(data);
            const obj = _reorgResources(parsedData);
            objs.push(obj);
        }
        // merge objs array into single contentResources
        const merged = {
            "i":"contentResources",
            "repoUrl": config.repoUrl,
            "table": {},
            "c": []
        };
        for (const [idx, obj] of objs.entries()) {
            const v = `v${idx}`;
            _recursiveMerge(obj, merged, v);
        }
        _calculateStatus(merged, objs.length);
        _recursiveDelete(merged,["table"]);
        _recursiveSort(merged);
        return merged;
    } catch (err) {
        logger.error(`Error reading the file: ${err}`,err);
        return { "error": `Error reading the file: ${err}` };
    }
};

/**
 * reorg resoruces response from content agent into nested array for tree display,
 * 
 * return properties: i = id, n = name, v = version, t = type, c = children
 * 
 * @param obj   {"contentResources":[
 *                  {"id":"Finance","type":"Cloud Integration","version":"1.0.0","subType":"package","components":[]},
 *                  {"id":"JointVenture","type":"API Management","version":"1.0.0","subType":"proxy"}
 *              ]}
 * @param typeCounter counter of subTypes, will be updated to result like {proxy:10,iFlow:10} etc
 * @returns {
 *      "i": "contentResources",
 *      "c": [
 *          {"n": "Cloud Integration","v":"1.0.0","c":[
 *              {"i":"Finance","n":"Finance","v":"1.0.0"}
 *          ]},
 *          {"n": "API Management","v":"1.0.0","c":[
 *              {"i":"proxy","n":"proxy","v":"1.0.0","c":[
 *                   {"i":"xxx","n":"JointVenture","v":"1.0.0"}
 *              ]}
 *          ]},
 *      ]
 * }
 */
const _reorgResources = function(data, typeCounter) {
    if (!data || !data.contentResources) {
        throw new Error("Unexpected response, no 'contentResources' found");
    }
    const cpi = { "i":"CPI", "n": "Cloud Integration", "t":"", "v": "", "c": [] };
    const apim = { "i":"APIM", "n": "API Management", "t":"", "v": "", "c": [], "subTypes": {} };
    for ( const entry of data.contentResources ) {
        if (entry.type == "Cloud Integration") {
            const package = { "i":entry.id, "n": entry.name, "t": entry.subType, "v": entry.version, "c": []};
            if (entry.subType) typeCounter[entry.subType] = typeCounter[entry.subType]? typeCounter[entry.subType]+1 : 1;
            if (config.repoUrl) {
                package.p = `/${entry.id}&version=GBdev`;
             };
            if ( entry.components ) {
                for ( const comp of entry.components ) {
                    const iflow = {"i": comp.id, "n": comp.name, "t": comp.type, "v": comp.version}
                    if (comp.type) typeCounter[comp.type] = typeCounter[comp.type]? typeCounter[comp.type]+1 : 1;
                    if (config.repoUrl) {
                        iflow.p = `/${package.i}/${comp.id}_content/&version=GBdev`;
                    }
                    package.c.push(iflow);
                }
            }
            cpi.c.push(package);
        } else if (entry.type == "API Management") {
            let subType = apim.subTypes[entry.subType];
            if (!subType) {
                subType = {"i":entry.subType, "n":entry.subType, "t":"", "v":"", "c":[]};
                apim.subTypes[entry.subType] = subType;
                apim.c.push(subType);
            }
            if (entry.subType) typeCounter[entry.subType] = typeCounter[entry.subType]? typeCounter[entry.subType]+1 : 1;
            const apimObj = {"i":entry.id, "n":entry.name || entry.id, "t":entry.subType, "v": entry.version};
            subType.c.push(apimObj);
        } else {
            // other entry types are ignored
        }
    }
    delete apim.subTypes;
    const ret = {
        "i": "contentResources",
        "c": [ cpi, apim ]
    }
    return ret;
}

const _recursiveDelete = function(obj, keysToDelete) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (keysToDelete.includes(key)) {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                _recursiveDelete(obj[key], keysToDelete);
            }
        }
    }
    return obj;
}

const _recursiveMerge = function(obj, merged, vProp) {
    for (const entry of obj.c) {
        let mergedEntry = merged.table[entry.i];
        if (!mergedEntry) {
            mergedEntry = {"i":entry.i, "n":entry.n,"t":entry.t,"table":{}};
            if (entry.p)
                mergedEntry.p = entry.p;
            merged.table[entry.i] = mergedEntry;
            merged.c.push(mergedEntry);
        } 
        mergedEntry[vProp] = entry.v;
        if (entry.c && entry.c.length > 0) {
            if(!mergedEntry.c) 
                mergedEntry.c = [];
            _recursiveMerge(entry, mergedEntry, vProp);
        }
    }
}

function _recursiveSort(obj) {
    if (obj.c && obj.c.length > 0) {
        obj.c = obj.c.sort((a,b)=>a.n === b.n?0:(a.n > b.n?1:-1));
        for (const child of obj.c) {
            _recursiveSort(child);
        }
    }
}