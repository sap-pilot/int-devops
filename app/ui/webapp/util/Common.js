sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function(MessageBox, MessageToast) {
	"use strict";

	let sResponsivePaddingClasses = "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer";

	return {

		SESSION_TIMEOUT_SEC: 119 * 60, // session timeout after 119 minutes (-1 minute comparing to app/xs-app.json->sessionTimeout)
		SESSION_WARNING_SEC: 59, // show session expiring dialog 59 seconds before actual timeout
		LINK_REPORT_ISSUE: "https://github.com/sap-pilot/btp-pilot/issues",

		reportSuccess: function(oProgressModel, sMessage) {
			if (!oProgressModel) {
				return;
			}
			oProgressModel.setProperty("/state", "Success");
			oProgressModel.setProperty("/message", sMessage);
			oProgressModel.setProperty("/running", false);
			oProgressModel.setProperty("/percent", 100);
		},

		/**
		 * Report error object - display error messagebox and update oProgressModel if specified.
		 * @param oError
		 * @param sMainMessage
		 * @param oProgressModel
		 */
		reportError: function(oError, sMainMessage, oProgressModel) {
			console.error(oError);
			let sCode = "Error",
				sMessage = null;
			if (oError) {
				if (typeof oError === "string") {
					sMessage = oError;
				} else if (oError.reason) {
					if (typeof oError.reason === "string") {
						sMessage = oError.reason;
					} else if (oError.reason.message) {
						sMessage = oError.reason.message;
					} else {
						sMessage = JSON.stringify(oError.reason);
					} // TODO: other case to check?
				} else if (oError.error) {
					if (typeof oError.error === "string") {
						sMessage = oError.error;
					} else if (oError.error.message) {
						sMessage = oError.error.message;
					} else {
						sMessage = JSON.stringify(oError.error);
					} // TODO: other case to check?
				} else if (oError.message) {
					if (typeof oError.message === "string") {
						sMessage = oError.message;
					} else {
						sMessage = JSON.stringify(oError.message);
					} // TODO: other case to check?
					if (oError.code) {
						sCode = oError.code;
					}
				} else {
					sMessage = JSON.stringify(oError); // TODO: other case to check?
				}
			}
			let sErrorDetail = "<p><a href=\"" + this.LINK_REPORT_ISSUE + "\" target=\"_blank\">Report issue</a>.";
			if (sMessage) {
				sErrorDetail = "<p>" + sMessage + "</p>" + sErrorDetail;
			}
			if (!sMainMessage) {
				sMainMessage = "Unexpected error";
			}
			MessageBox.error(sMainMessage, {
				title: sCode,
				id: "errorMessage",
				details: sErrorDetail,
				contentWidth: "150px",
				styleClass: sResponsivePaddingClasses
			});
			if (oProgressModel) {
				const sProgressMessage = sMainMessage ? sMainMessage : sMessage ? sMessage : "Unexpected error";
				oProgressModel.setProperty("/state", "Error");
				oProgressModel.setProperty("/message", sProgressMessage);
				oProgressModel.setProperty("/running", false);
			}
		},

		reportWarning: function(oObject, sMessage) {
			console.warn(oObject);
			MessageBox.warning(sMessage, {
				title: "Warning",
				id: "warningMessage",
				details: oObject,
				contentWidth: "250px",
				styleClass: sResponsivePaddingClasses
			});
		},

		toast: function(sMessage) {
			sap.m.MessageToast.show(sMessage, {
				duration: 4000,                  // default
				width: "15em",                   // default
				my: "center bottom",             // default
				at: "center bottom",             // default
				of: window,                      // default
				offset: "0 0",                   // default
				collision: "fit fit",            // default
				onClose: null,                   // default
				autoClose: true,                 // default
				animationTimingFunction: "ease", // default
				animationDuration: 1000,         // default
				closeOnBrowserNavigation: true   // default
			});
		},

		shallowClone: function(oObject) {
			return Object.assign({}, oObject);
		},

		downloadObjectAsJson: function(exportObj, exportName) {
			let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 4)),
			 downloadAnchorNode = document.createElement("a");
			downloadAnchorNode.setAttribute("href", dataStr);
			downloadAnchorNode.setAttribute("download", exportName + ".json");
			document.body.appendChild(downloadAnchorNode); // required for firefox
			downloadAnchorNode.click();
			downloadAnchorNode.remove();
		},

		downloadFile: function(url, fileName) {
			let downloadAnchorNode = document.createElement("a");
			downloadAnchorNode.setAttribute("href", url);
			downloadAnchorNode.setAttribute("download", fileName);
			document.body.appendChild(downloadAnchorNode); // required for firefox
			downloadAnchorNode.click();
			downloadAnchorNode.remove();
		},

		checkSubDomainRequired: function(tabTitle, directoryShortName){
			if(tabTitle === 'SCC' || directoryShortName === 'SAC'){
				return false;
			}
			else{
				return true;
			}
		}
	};
});