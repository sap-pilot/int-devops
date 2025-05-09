const cds = require("@sap/cds");
const { getTmsLandscapeFromCache } = require("./lib/tms");

module.exports = cds.service.impl(srv => {
    //srv.on("landscape", getTmsLandscapeSync);
    srv.on("landscape", getTmsLandscapeFromCache);
});
