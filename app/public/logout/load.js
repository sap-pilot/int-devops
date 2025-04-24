sap.ui.require(["sap/m/Shell", "sap/ui/core/ComponentContainer"], function(e, t) {
	"use strict";
	sap.ui.getCore().attachInit(function() {
		new e({
			appWidthLimited: false,
			app: new t({
				height: "100%",
				width: "100%",
				name: "sap.cf.pages.logoff",
				async: true
			})
		}).placeAt("content");
	});
});