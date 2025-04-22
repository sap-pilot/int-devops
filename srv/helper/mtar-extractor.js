const { exec } = require('child_process');
const { logger } = require("./logger");

const { config } = require('../config');
const mtarFile = `${config.uploadPath}/cpi-all.mtar`;
const destDir = `${config.tmpPath}/cpi-all`;

const extractMtar = (mtarFile, destDir) => {
    exec(`./srv/helper/mtar-extractor.sh ${mtarFile} ${destDir}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`failed to extract $${mtarFile}:\n${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`error during extraction ${mtarFile}:\n${stderr}`);
            return;
        }
        logger.info(`extracted ${mtarFile}:\n${stdout}`);
    });
}

module.exports = { extractMtar };