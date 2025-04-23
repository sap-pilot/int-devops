// config variables
const config = {
    "uploadPath": "./upload", // mtars get uploaded to this folder
    "tmpPath": "./tmp", // then extracted to this folder
    "workPath": "./work", // then moved to this folder (git-repos)
    "prettyResponse": process.env.PRETTY_RESPONSE != "false",
    "redactAuthHeader": !process.env.REDACT_AUTH_HEADER || process.env.REDACT_AUTH_HEADER != "false",
    //tmsUrl: "https://int-devops.free.beeceptor.com",
    "tmsUrl": process.env.TMS_URL ? process.env.TMS_URL : "https://transport-service-app-backend.ts.cfapps.us10.hana.ondemand.com",
    "repo": {
        "url": process.env.REPO_URL,
        "branches": process.env.REPO_BRANCHES ? JSON.parse(process.env.REPO_BRANCHES) : ["dev", "release", "maint", "master"],
        "nodeMapping": process.env.REPO_NODE_MAPPING ? JSON.parse(process.env.REPO_NODE_MAPPING) : {
            "INT_DEV": "dev",
            "INT_STAGING": "release",
            "INT_MAINT": "maint",
            "INT_PREPROD": "master",
            "INT_PROD": "master",
        }
    }
}

module.exports = { config };