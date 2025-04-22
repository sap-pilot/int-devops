const { execSync } = require('child_process');
const { logger } = require("./logger");

// const { config } = require('../config');
// const mtarFile = `${config.uploadPath}/cpi-all.mtar`;
// const destDir = `${config.tmpPath}/cpi-all`;

const extractMtar = (mtarFile, destDir) => {
    try {
        const result = execSync(`./srv/helper/mtar-extractor.sh ${mtarFile} ${destDir}`);
        logger.info(`extracted ${mtarFile}: ${result}`);
    } catch (error) {
        console.error(`error during extracting ${mtarFile}: ${error}`);
    }
}

module.exports = { extractMtar };