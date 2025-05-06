const { getAllDestinationsFromDestinationService } = require("@sap-cloud-sdk/connectivity");
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const { logger } = require("./logger");
const { config } = require("./config");
const { getTmsLandscapeAsync } = require("./tms");

/**
 * get contentResources from remote content agent services via specified 'CAS_*' destinations
 *  @returns {
 *      "i": "contentResources",
 *      "tmsUrl": "XX",
 *      "countCasNodes": 4,
 *       "nodes": [
 *          {"idx":0,"group":0,"alias":"DEV","tmsNode":"INT_DEV","casDest":"CAS_DEV","casUrl":"XX","r":{"package":6,"IFlow":15,"APIProvider":11,"proxy":18}},
 *          {"idx":1,"group":1,"alias":"STG","tmsNode":"INT_STG","casDest":"CAS_STG","casUrl":"XX","r":{"package":5,"IFlow":12,"APIProvider":10,"proxy":12}},
 *          {"idx":2,"group":2,"alias":"PRE","tmsNode":"INT_PRE","casDest":"CAS_PRE","casUrl":"XX","r":{"package":5,"IFlow":10,"APIProvider":10,"proxy":15}},
 *           {"idx":3,"group":3,"alias":"PROD","tmsNode":"INT_PROD","casDest":"CAS_PROD","casUrl":"XX","r":{"error":"Permission denied"}}
 *       ],
 *      "groups": [
 *           {"idx":0,"name":"Sandbox"},
 *           {"idx":1,"name":"Development"},
 *           {"idx":2,"name":"Staging"},
 *           {"idx":3,"name":"Preprod"},
 *           {"idx":4,"name":"Production"}
 *       ],
 *       "routes": [
 *           {"from":0,"to":1},
 *           {"from":1,"to":2},
 *           {"from":2,"to":3}
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
const getContentResources = async function(req) {
    try {
        // get list of destinations
        const allDestinations = await getAllDestinationsFromDestinationService();
        // extract tms url
        const tmsDestination = allDestinations.find( dest => dest.name === config.tmsDestination );
        const tmsUrl = tmsDestination?.tokenServiceUrl?.replace(/https:\/\/([^.]+).authentication.([^.]+).(.+)/, (match, subdomain, region) => {
            return `https://${subdomain}.ts.cfapps.${region}.hana.ondemand.com/main/webapp/index.html`
        });
        
        // filter conten-agent destiation with prerix 'CAS_' and additional property 'TMS_NODE'
        const filteredDestinations = allDestinations.filter(dest => dest.name.startsWith(config.casDestinationPrefix) && dest.originalProperties.TMS_NODE);
        if (!filteredDestinations || filteredDestinations.length == 0) 
            throw new Error(`no Content Agent destination found with prefix '${config.casDestinationPrefix}' and 'TMS_NODE' property`);
        let nodes = filteredDestinations.map(dest => ({
            idx: dest.originalProperties.NODE_ORDER,
            group: dest.originalProperties.NODE_GROUP,
            alias: dest.originalProperties.NODE_ALIAS || dest.originalProperties.TMS_NODE.split("_").at(-1),
            tmsNode: dest.originalProperties.TMS_NODE,
            casDest: dest.name, // cas destination name
            casUrl: dest.tokenServiceUrl?.replace(/https:\/\/([^.]+).authentication.([^.]+).(.+)/, (match, subdomain, region) => {
                return `https://${subdomain}.${region}.content-agent.cloud.sap/index.html`
            }),
            r: {},
            obj: {}, // result object to be deleted after merge
        }));
        nodes.sort((a, b) => a.idx - b.idx);
        // reset index and extract groups
        const groups = structuredClone(config.groups);
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].idx = i; // reset index for later tree column display
            _assignOrCreateGroup(nodes[i],groups);
        }
        logger.info(`loading contentResources for nodes ${JSON.stringify(nodes,null,2)}`);
        const startTime = Date.now();
        const startDate = new Date(startTime);
        const promises = [];
        // also start loading tms landscape
        const tmsPromise = getTmsLandscapeAsync(req, true);
        for (const node of nodes) {
            let p = executeHttpRequest({destinationName: node.casDest}, { 
                method: "GET", 
                url: "/v1/contentResources?filters=(type eq 'API Management') or (type eq 'Cloud Integration')" 
            })
            p.then(result => {
                // check if response is valid
                if (!result?.data?.contentResources) {
                    logger.warn(`no contentResources found from destination '${node.casDest}', response: ${JSON.stringify(resp.data,null,2)}`);
                    node.r.warning = "No contentResources found";
                } else {
                    node.obj = _reorgResources(result.data, node.r); // parse/reorg and count resources by subType
                }
            })
            // .catch(error => {
            //     node.r.error = error.message;
            //     logger.warn(`failed to load contentResource from destination ${node.casDest}: ${error}`,error);
            // })
            .finally(() => {
                const durationMs = Date.now() - startTime;
                logger.debug(`completed loading contentResource from ${node.casDest}, takes time ${durationMs} ms, result: ${JSON.stringify(node.r,null,2)}`);
            });
            promises.push(p);
        }
        // wait for all promises to complete
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                nodes[index].r.error = result.reason.message;
                logger.warn(`Failed to load contentResource from destination ${nodes[index].casDest}: ${result.reason}`);
            }
        });
        const durationMs = Date.now() - startTime;
        logger.debug(`completed loading contentResources from all nodes, takes time ${durationMs} ms`);
       
        // merge objs array into single contentResources
        const merged = {
            "repoUrl": config.repoUrl,
            "tmsUrl": tmsUrl,
            "lastUpdated": startDate.toISOString(),
            "table": {}, // to bev deleted after merge
            "countCasNodes": nodes.length, // only nodes with contentResources will be included the UI tree table
            "nodes": nodes, // array of {tmsNode, alias} for instance {name:'PRE2',tmsNode:'INT_PRE2'}
            "groups": groups,
            "routes": [],
            "c": []
        };
        for (const node of nodes) {
            const v = `v${node.idx}`;
            _recursiveMerge(node.obj, merged, v);
            delete node.obj; // merged, delete this obj to avoid excessive result in response
        }

        _recursiveDelete(merged,["table"]);
        _recursiveSort(merged);

        // done with contentResources, now added tms resource into merged result
        const tmsLandscape = await tmsPromise;
        _mergeTmsLandscapeData(merged, tmsLandscape);

        // all done, return merged result
        return merged;
    } catch (error) {
        throw new Error(`Failed to read remote resources from content-agent service: ${error}`,{cause: error});
    }
}

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

const _recursiveSort = function(obj) {
    if (obj.c && obj.c.length > 0) {
        obj.c = obj.c.sort((a,b)=>a.n === b.n?0:(a.n > b.n?1:-1));
        for (const child of obj.c) {
            _recursiveSort(child);
        }
    }
}

const _assignOrCreateGroup = function(node, groups) {
    let nodeName = node.tmsNode || node.alias;
    nodeName = nodeName.toLowerCase();
    let groupName = '';
    if (nodeName.includes("dev")) {
        groupName = "Development";
    } else if (nodeName.includes("stg") || nodeName.includes("staging")) {
        groupName = "Staging";
    } else if (nodeName.includes("pre") || nodeName.includes("qa") ) {
        groupName = "Preprod";
    } else if (nodeName.includes("sbx") || nodeName.includes("sandbox") ) {
        groupName = "Sandbox";
    } else if (nodeName.includes("prod")) {
        groupName = "Production";
    } else {
        groupName = "Other";
    }
    let group = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
    if (!group) {
        group = {
            idx: groups.length,
            name: groupName
        };
        groups.push(group);
    }
    node.group = group.idx;
}

const _mergeTmsLandscapeData = function(merged, tmsLandscape) {
    if (!tmsLandscape || !tmsLandscape.nodes || !tmsLandscape.routes) {
        logger.warn(`tmsLandscape data is not valid: ${JSON.stringify(tmsLandscape,null,2)}`);
        return;
    }
    const tmsNodeNameMap = {}, tmsNodeIdMap = {}, nodeTmsIdMap = {}, routeSet = new Set();
    for (const tmsNode of tmsLandscape.nodes) {
        tmsNodeNameMap[tmsNode.name] = tmsNode;
        tmsNodeIdMap[tmsNode.id] = tmsNode;
    }
    // enrich content resources nodes with tms info
    for (const node of merged.nodes) {
        const tmsNode = tmsNodeNameMap[node.tmsNode];
        if (!tmsNode) {
            logger.warn(`tmsNode not found for ${node.tmsNode}, node: ${JSON.stringify(node,null,2)}`);
            continue;
        }
        node.tmsNodeId = tmsNode.id;
        node.tmsUploadAllowed = tmsNode.uploadAllowed;
        nodeTmsIdMap[node.tmsNodeId] = node;
    }
    // add existing routes
    for (const route of merged.routes) {
        routeSet.add(`${route.from}-${route.to}`);
    }
    // now go through tms routes and add connected nodes
    let foundAdditionTmsNode = true;
    while (foundAdditionTmsNode) {
        foundAdditionTmsNode = false;
        for (const route of tmsLandscape.routes) {
            let fromNode = nodeTmsIdMap[route.sourceNodeId];
            let toNode = nodeTmsIdMap[route.targetNodeId];
            if (!fromNode && !toNode) {
                // neither node is connected to existing landscape, so we skip this route route
                continue;
            }
            if (!(fromNode && toNode) ) {
                foundAdditionTmsNode = true;
                // one of the nodes is already connected, so we can add the other one
                if (!fromNode) {
                    const fromTmsNode = tmsNodeIdMap[route.sourceNodeId]
                    fromNode = _convertTmsNode(fromTmsNode, merged.groups);
                    fromNode.idx = merged.nodes.length;
                    merged.nodes.push(fromNode);
                    nodeTmsIdMap[fromNode.tmsNodeId] = fromNode;
                    logger.debug(`added node from tms: ${JSON.stringify(fromNode,null,2)}`);
                } else if (!toNode) {
                    const toTmsNode = tmsNodeIdMap[route.targetNodeId]
                    toNode = _convertTmsNode(toTmsNode, merged.groups);
                    toNode.idx = merged.nodes.length;
                    merged.nodes.push(toNode);
                    nodeTmsIdMap[toNode.tmsNodeId] = toNode;
                    logger.debug(`added node from tms: ${JSON.stringify(toNode,null,2)}`);
                } else {
                    logger.warn(`unexpected state, both nodes are connected: ${JSON.stringify(route,null,2)}`);
                }
            }
            // now add route if not done already
            const routeKey = `${fromNode.idx}-${toNode.idx}`;
            if (!routeSet.has(routeKey)) {
                routeSet.add(routeKey);
                const route = {from: fromNode.idx, to: toNode.idx};
                merged.routes.push(route);
                logger.debug(`added route from tms: ${JSON.stringify(route,null,2)}`);
            }
        }
    }
}


const _convertTmsNode = function(tmsNode, groups) {
    let node = {
        idx: -1,
        group: -1, // TODO: assign a group for this one
        tmsNode: tmsNode.name,
        tmsNodeId: tmsNode.id,
        tmsUploadAllowed: tmsNode.uploadAllowed,
        r: {
            warning: "CAS not connected"
        }
    };
    _assignOrCreateGroup(node, groups);
    return node;
}

module.exports = { getContentResources };