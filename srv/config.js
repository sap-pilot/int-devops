const path = require("path");
const rootPath = path.join(__dirname, '..');
const { logger } = require('./helper/logger');

// config variables
const config = {
    "rootPath": rootPath,
    "uploadPath": `${rootPath}/upload`, // mtars get uploaded to this folder
    "tmpPath": `${rootPath}/tmp`, // then extracted to this folder
    "workPath": `${rootPath}/work`, // then moved to this folder (git-repos)
    "logPretty": process.env.LOG_PRETTY != "false",
    //tmsUrl: "https://int-devops.free.beeceptor.com",
    "tmsUrl": process.env.TMS_URL ? process.env.TMS_URL : "https://transport-service-app-backend.ts.cfapps.us10.hana.ondemand.com",
    "repo": {
        "url": process.env.REPO_URL,
        "branches": process.env.REPO_BRANCHES ? JSON.parse(process.env.REPO_BRANCHES) : ["dev", "release", "maint", "master"],
        "nodeMapping": process.env.REPO_NODE_MAPPING ? JSON.parse(process.env.REPO_NODE_MAPPING) : {
            "INT_DEV": "dev",
            "INT_PREPROD2": "release",
            "INT_DEV2": "maint",
            "INT_STAGING": "maint",
            "INT_PREPROD": "master",
            "INT_PROD": "master",
        }
    }
}
logger.info(`config: ${JSON.stringify(config,null,2)}`);

module.exports = { config };