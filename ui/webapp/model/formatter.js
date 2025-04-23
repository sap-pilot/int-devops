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
				case "ok":
					return "sap-icon://sys-enter-2";
				case "error":
					return "sap-icon://error";
				default:
					return null;
			}
        },
        statusState: function (sStatusText) {
			// var resourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sStatusText) {
				case "ok":
					return "Success";
				case "error":
					return "Error";
				default:
					return null;
			}
        },
        statusHighlight: function (sStatusText) {
			// var resourceBundle = this.getView().getModel("i18n").getResourceBundle();
			switch (sStatusText) {
				case "ok":
					return "Success";
				case "info":
					return "Information";
				case "warning":
					return "Warning";
				case "error":
					return "Error";
				case "fatal":
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