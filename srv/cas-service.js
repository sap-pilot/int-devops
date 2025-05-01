const cds = require("@sap/cds");
const fs = require("fs");
const { logger } = require("./helper/logger");

module.exports = cds.service.impl(srv => {
    srv.on("resources", getResources);
});

const getResources = req => {
    try {
        const data = fs.readFileSync('./tmp/resources-0.json', 'utf8');
        const obj = JSON.parse(data);
        if (!obj || !obj.contentResources) {
            throw new Error("unexpected response, no 'contentResources' found");
        }
        const cpi = { "n": "Cloud Integration", "t":"", "v0": "", "c": [] };
        const apim = { "n": "API Management", "t":"", "v0": "", "c": [], "subTypes": {} };
        for ( const entry of obj.contentResources ) {
            if (entry.type == "Cloud Integration") {
                const package = { "i":entry.id, "n": entry.name, "t": entry.subType, "v0": entry.version, "c": [] };
                if ( entry.components ) {
                    for ( const comp of entry.components ) {
                        const iflow = {"i": comp.id, "n": comp.name, "t": comp.type, "v0": comp.version };
                        package.c.push(iflow);
                    }
                }
                cpi.c.push(package);
            } else if (entry.type == "API Management") {
                let subType = apim.subTypes[entry.subType];
                if (!subType) {
                    subType = {"n":entry.subType, "t":"", "v0":"", "c":[]};
                    apim.subTypes[entry.subType] = subType;
                    apim.c.push(subType);
                }
                const apimObj = {"i":entry.id, "n":entry.name, "t":entry.subType, "v0": entry.version};
                subType.c.push(apimObj);
            }
        }
        delete apim.subTypes;
        const ret = {
            "resources": [ cpi, apim ]
        }
        return ret;
    } catch (err) {
        logger.error(`Error reading the file: ${err}`);
        return { "error": `Error reading the file: ${err}` };
    }
};