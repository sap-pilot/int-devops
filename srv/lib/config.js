// config variables
const config = {
    "repoUrl": process.env.REPO_URL,
    "tmsDestination": "TransportManagementService",
    "casDestinationPrefix": "CAS_",
    "cachedContentResourcePath": "./srv/tmp/content-resources.json",
    "cachedTmsLandscapePath": "./srv/tmp/tms-landscape.json",
    "groups": [
        {"idx":0,"name":"Sandbox"},
        {"idx":1,"name":"Development"},
        {"idx":2,"name":"Staging"},
        {"idx":3,"name":"Preprod"},
        {"idx":4,"name":"Production"}
    ]
}

module.exports = { config };