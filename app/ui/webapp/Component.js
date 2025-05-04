/**
 * Eslint-disable @sap/ui5-jsdocs/no-jsdoc.
 */

sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"sap/m/IllustrationPool",
	"sap/ui/model/json/JSONModel",
	"sap/ui/util/Storage",
	"org/sapux/int/model/models"
],
function(UIComponent, Device, IllustrationPool, JSONModel, Storage, models) {
	"use strict";

	return UIComponent.extend("org.sapux.int.Component", {
		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function() {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();
			this.getRouter().attachRouteMatched(null, this.handleRouteMatched.bind(this));

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			// component level model for keeping track of component navigation etc
			this.compModel = new JSONModel({ currentRouteName: "Homepage" });
			this.setModel(this.compModel, "comp");

			const oTntSet = {
				setFamily: "tnt",
				setURI: sap.ui.require.toUrl("sap/tnt/themes/base/illustrations")
			};

			// register tnt illustration set
			IllustrationPool.registerIllustrationSet(oTntSet, false);

			// init local storage and restore UI state
			this.oStorage = new Storage(Storage.Type.local, "int-devops");
			const oAppState = {
				"theme":"sap_horizon",
				"sideExpanded":false,
				"liveMode":false, // demoMode on
				"resourceTreeWidth": "810px",
				"landscapeOrientation": "TopBottom"
			};
			this.oAppStateModel = new JSONModel(oAppState);
			const fnappStateChangeListener = function(event) {
				let oNewAppState = this.oAppStateModel.getData();
				// console.log(`save new appState: ${JSON.stringify(oNewAppState,null,2)}`);
				this.oStorage.put("appState",oNewAppState);
			}.bind(this);
			// restore previous stateJSONModel can only attachChange against each property
			const oPreviousappState = this.oStorage.get('appState') || {};
			for (const sKey in oAppState) {
				// check properties one by one in case of property gets added or delete
				if (oPreviousappState.hasOwnProperty(sKey)) oAppState[sKey] = oPreviousappState[sKey];
				// JSONModel can only attachChange against each property
				this.oAppStateModel.bindProperty(`/${sKey}`).attachChange(fnappStateChangeListener);
			}
			this.setModel(this.oAppStateModel, "appState");
		},

		handleRouteMatched: function(event) {
			const oParams = event.getParameters(); // matched route
			// update page title & current rute
			if (oParams && oParams.name) {
				document.title = oParams.name + " - Integration DevOps";
				this.compModel.setProperty("/currentRouteName", oParams.name);
			} else {
				document.title = "Integration DevOps";
				this.compModel.setProperty("/currentRouteName", "");
			}
			const oPageViewEvent = {
				page_title: document.title,
				page_location: window.location.href + window.location.hash
			};
			gtag("event", "page_view", oPageViewEvent);
		}
	});
}
);