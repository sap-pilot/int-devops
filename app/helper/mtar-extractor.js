const { config } = require("../config");
const { command } = require('./command');
const fs = require("fs");

// extract specified mtarFile to destDir, returns Promise
const extractMtar = function(mtarFile, destDir) {
    return new Promise((resolve,reject) => {
        const cmd = `${__dirname}/mtar-extractor.sh`;
        const args = `${mtarFile} ${destDir}`;
        try {
            if (!fs.existsSync(config.tmpPath)){
                fs.mkdirSync(config.tmpPath);
            }
            const result = command(cmd, args, config.tmpPath);
            resolve(result);
        } catch (error) {
            reject(new Error(`'${cmd} ${args}': ${error}`, {cause: error}));
        }
    });
}

module.exports = { extractMtar };