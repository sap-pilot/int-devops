const cds = require("@sap/cds");
const fs = require("fs");
const { logger } = require("./helper/logger");

module.exports = cds.service.impl(srv => {
    srv.on("resources", getResources);
});

const getResources = function(req) {
    try {
        const files = ['./srv/tmp-res-0.json','./srv/tmp-res-1.json','./srv/tmp-res-2.json'];
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
            "table": {},
            "c": []
        };
        for (const [idx, obj] of objs.entries()) {
            const v = `v${idx}`;
            _resursiveMerge(obj, merged, v);
        }
        _calculateStatus(merged, objs.length);
        _recursiveDelete(merged,["table"]);
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
 * @returns {
 *      "resources": [
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
const _reorgResources = function(data) {
    if (!data || !data.contentResources) {
        throw new Error("Unexpected response, no 'contentResources' found");
    }
    const cpi = { "i":"cpi", "n": "Cloud Integration", "t":"", "v": "", "c": [] };
    const apim = { "i":"apim", "n": "API Management", "t":"", "v": "", "c": [], "subTypes": {} };
    for ( const entry of data.contentResources ) {
        if (entry.type == "Cloud Integration") {
            const package = { "i":entry.id, "n": entry.name, "t": entry.subType, "v": entry.version, "c": [] };
            if ( entry.components ) {
                for ( const comp of entry.components ) {
                    const iflow = {"i": comp.id, "n": comp.name, "t": comp.type, "v": comp.version };
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

const _resursiveMerge = function(obj, merged, vProp) {
    for (const entry of obj.c) {
        let mergedEntry = merged.table[entry.i];
        if (!mergedEntry) {
            mergedEntry = {"i":entry.i, "n":entry.n,"t":entry.t,"table":{}};
            merged.table[entry.i] = mergedEntry;
            merged.c.push(mergedEntry);
        } 
        mergedEntry[vProp] = entry.v;
        if (entry.c && entry.c.length > 0) {
            if(!mergedEntry.c) 
                mergedEntry.c = [];
            _resursiveMerge(entry, mergedEntry, vProp);
        }
    }
}

function _countUnique(iterable) {
    return new Set(iterable).size;
}
  

const _calculateStatus = function(obj, maxIndex) {
    let maxUnique = 1;
    if (obj.c && obj.c.length > 0) {
        for (let child of obj.c) {
            const cd = _calculateStatus(child, maxIndex);
            if (cd > maxUnique)
                maxUnique = cd;
        }
    }
    let u = 0;
    let arr = [];
    for ( let i = 0; i < maxIndex; i++ ) {
        const v = `v${i}`;
        if (!obj.hasOwnProperty(v))
            obj[v] = '-';
        arr.push(obj[v]);
    }
    u = _countUnique(arr);
    if (u == 1 && maxUnique == 1)
        obj.s = 'ok';
    else if (u > 2 || maxUnique > 2)
        obj.s = 'error'
    else
        obj.s = 'warning';
    return u == 1? maxUnique : u;
}