const { execSync } = require('child_process');
const { logger } = require("./logger");

// extract specified mtarFile to destDir, returns Promise
const extractMtar = (mtarFile, destDir) => {
    return new Promise((resolve,reject) => {
        try {
            const result = execSync(`./srv/helper/mtar-extractor.sh ${mtarFile} ${destDir}`);
            logger.debug(`extracted ${mtarFile}: ${result}`);
            resolve(result);
        } catch (error) {
            reject(new Error(`error during extracting ${mtarFile}: ${error}`, { cause: error }));
        }
    });
}

module.exports = { extractMtar };