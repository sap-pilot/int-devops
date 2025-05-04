const cds = require("@sap/cds");
const { getTmsLandscapeSync, getTmsLandscapeFromCache } = require("./helper/tms");

module.exports = cds.service.impl(srv => {
    //srv.on("landscape", getTmsLandscapeSync);
    srv.on("landscape", getTmsLandscapeFromCache);
});
