const cds = require("@sap/cds");
const { getTmsLandscapeSync } = require("./helper/tms");

module.exports = cds.service.impl(srv => {
    srv.on("landscape", getTmsLandscapeSync);
});
