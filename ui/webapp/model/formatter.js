sap.ui.define([], function () {
	"use strict";
	return {
        statusBusyIndicatorVisible: function (sStatusText) {
            return sStatusText == "Testing";
        },
        statusVisible: function (sStatusText) {
            return sStatusText != "Testing";
        },
		statusIcon: function (sStatusText) {
			// var resourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sStatusText) {
				case "OK":
					return "sap-icon://sys-enter-2";
				case "ERROR":
					return "sap-icon://error";
				default:
					return null;
			}
        },
        statusState: function (sStatusText) {
			// var resourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sStatusText) {
				case "OK":
					return "Success";
				case "ERROR":
					return "Error";
				default:
					return null;
			}
        },
        statusHighlight: function (sStatusText) {
			// var resourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sStatusText) {
				case "OK":
					return "Success";
				case "INFO":
					return "Information";
				case "WARNING":
					return "Warning";
				case "ERROR":
					return "Error";
				case "FATAL":
					return "Error";
				default:
					return "None";
			}
        },
		timestampToLocal: function(sTimestamp) {
			if (!sTimestamp)
				return "";
			var d = new Date(Number(sTimestamp)*1000);
			return d.toLocaleString();
		}
	};
});