sap.ui.define([
	"org/sapux/int/controller/BaseController",
	"org/sapux/int/util/Common",
    "sap/ui/model/json/JSONModel",
	"org/sapux/int/model/formatter",
	"sap/suite/ui/commons/networkgraph/layout/SwimLaneChainLayout"
], function (BaseController, Common, JSONModel, formatter, SwimLaneChainLayout) {
	"use strict";

	return BaseController.extend("org.sapux.int.controller.Monitor", {

		formatter: formatter,

        onInit: function () {

			this.oViewStateModel = new JSONModel({
				busy: true,
				busyExporting: false
			});
			this.getView().setModel(this.oViewStateModel,"viewState");

			this._selectedNodes = new Set(); // Store selected node keys
			let oGraph = this.byId("graph");
			oGraph.setLayoutAlgorithm(new SwimLaneChainLayout());
			this.setupGraphControls();

			// listen to appState>/liveMode change event
			const appStateModel = this.getOwnerComponent().getModel("appState");
			appStateModel.bindProperty("/liveMode").attachChange(function(){this.loadContentResources(false)}.bind(this));

			// now load resource tree, delay a bit otherwise busy indicator wont work on initial load
			// setTimeout(function(){this.loadContentResources(false)}.bind(this),100);
			this.oRouterLandscapeModel = new JSONModel("model/router-landscape.json");
			this.getView().setModel(this.oRouterLandscapeModel,"routerLandscape");
			this.oRouterRulesModel = new JSONModel("model/router-rules.json");
			this.getView().setModel(this.oRouterRulesModel,"routerRules");
		},

		setupGraphControls: function () {
			var oGraph = this.byId("graph"),
				oToolbar = this.byId("graph-toolbar");
			// disable some existing content
			let aExistingContent = oToolbar.getContent();
			aExistingContent[0].setVisible(false); // disable 1st spacer
			aExistingContent[1].setVisible(false); // disable search field
			aExistingContent[2].setVisible(false); // disable legend
			// add new control
			let oOrientation = new sap.m.Select();
			[
				{key: "TopBottom", text: "Top to bottom"},
				{key: "BottomTop", text: "Bottom to top"},
				{key: "LeftRight", text: "Left to right"},
				{key: "RightLeft", text: "Right to left"}	
			].forEach(function (o) {
				oOrientation.addItem(new sap.ui.core.Item(o));
			});
			oOrientation.setSelectedKey(this.getOwnerComponent().getModel("appState").getProperty("/landscapeOrientation"));
			oOrientation.attachChange(function (oEvent) {
				var sKey = oEvent.getParameter("selectedItem").getKey();
				oGraph.setOrientation(sKey);
			});
			let oTitleLabel = new sap.m.Link({
				text:"Router Landscape",
				href:"#router",
				emphasized: true
			});
			oToolbar.insertContent(oTitleLabel, 0);
			let spacer = new sap.m.ToolbarSpacer();
			oToolbar.insertContent(spacer, 1);
			oToolbar.insertContent(oOrientation, 2);
		},

		setBusy(bBusy) {
			this.oViewStateModel.setProperty("/busy",bBusy);
		}
	});

});
