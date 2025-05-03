// config variables
const config = {
    "repoUrl": process.env.REPO_URL,
    "tmsDestination": "TransportManagementService",
    "casDestinationPrefix": "CAS_",
    "cachedContentResourcePath": "./srv/tmp-content-resources.json",
    "cachedTmsLandscapePath": "./srv/tmp-tms-landscape.json"
}

module.exports = { config };