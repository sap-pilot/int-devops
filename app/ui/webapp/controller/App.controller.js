sap.ui.define(
	[
		"org/sapux/int/util/Common",
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/Theming",
		"sap/ui/core/Fragment"
	],
	function(Common, BaseController, JSONModel, Theming, Fragment) {
		"use strict";

		return BaseController.extend("org.sapux.int.controller.App", {

			onInit: function() {

				jQuery("#splash-screen").remove();
				jQuery("#ui5-container").css("display", "block");
				this.oMenuModel = new JSONModel();
				this.oMenuModel.loadData(sap.ui.require.toUrl("org/sapux/int/model/menu.json"), null, false);
				this.getView().setModel(this.oMenuModel);

				// initialize avatar popover
				this.oView = this.getView();
				this.userAvatar = this.oView.byId("userAvatar");
				this._oUserMenuPopover = Fragment.load({
					id: this.oView.getId(),
					name: "org.sapux.int.view.frag.UserMenuPopover",
					controller: this
				}).then(function(oPopover) {
					this.oView.addDependent(oPopover);
					this._oUserMenuPopover = oPopover;
				}.bind(this));

				// load user info
				this.userInfo = new JSONModel();
				this.getView().setModel(this.userInfo, "userInfo");
				this.loadUserInfo();

				// load build info
				const buildInfo = new JSONModel("./build-info.json");
				this.getView().setModel(buildInfo, "buildInfo");

				// setup session dialog and expiring timeout (attach to fetch event)
				this.setupSessionExpiringTimer();

				this.restoreUIState();
			},

			// restore UI state from local storage
			restoreUIState: function() {
				const sTheme = this.getOwnerComponent().getModel("appState").getProperty("/theme");
				this.toggleTheme(sTheme);
			},

			loadUserInfo: function() {
				// read sub-accounts
				const url = document.location.href.indexOf("localhost")>-1 
					? "./model/currentUser.json": "../user-api/currentUser" ,
				 requestOptions = {
						method: "GET",
						redirect: "follow"
					},
				 sErrorMessage = "Error while loading user info";
				try {
					fetch(url, requestOptions)
						.then(response => response.json())
						.then(function(result) {
							if (result && result.error) {
								Common.reportError(result.error, sErrorMessage, null);
								return;
							}
							if (result) {
								this.handleUserInfo(result);
							} else {
								console.error("Unexpected data returned from " + url + ": " + result);
							}
						}.bind(this))
						.catch(function(error) {
							Common.reportError(error, sErrorMessage, null);
						});
				} catch (error) {
					Common.reportError(error, sErrorMessage, null);
				}
			},

			handleUserInfo: function(oUserInfo) {
				let sInitial = "";
				if (oUserInfo) {
					if (oUserInfo.firstname) {
						sInitial += oUserInfo.firstname.slice(0, 1);
					}
					if (oUserInfo.lastname) {
						sInitial += oUserInfo.lastname.slice(0, 1);
					}
				}
				if (sInitial) {
					sInitial = sInitial.toUpperCase();
				} else {
					sInitial = "NA";
				}
				oUserInfo.initial = sInitial;
				this.userInfo.setData(oUserInfo);
			},

			toggleSideExpanded: function() {
				const oToolPage = this.byId("toolPage");
				this.getOwnerComponent().getModel("appState").setProperty("/sideExpanded",!oToolPage.getSideExpanded());
			},

			toggleTheme: function(sNewTheme) {
				if (!sNewTheme) {
					sNewTheme = Theming.getTheme() != "sap_horizon_dark"? "sap_horizon_dark" : "sap_horizon_light";
				}
				Theming.setTheme(sNewTheme);
				this.getOwnerComponent().getModel("appState").setProperty("/theme",sNewTheme);
			},

			onHomeIconPress: function() {
				sap.ui.core.UIComponent.getRouterFor(this).navTo("Main");
			},

			onUserAvatarPress: function(oEvent) {
				const userAvatar = this.oView.byId("userAvatar"),
				 oEventSource = oEvent.getSource(),
					bActive = userAvatar.getActive();
				userAvatar.setActive(!bActive);
				if (bActive) {
					this._oUserMenuPopover.close();
				} else {
					this._oUserMenuPopover.openBy(oEventSource);
				}
			},

			onUserAvatarPopoverClose: function() {
				const userAvatar = this.oView.byId("userAvatar");
				userAvatar.setActive(false);
			},

			onUserMenuListItemPress: function(oEvent) {
				const userAvatar = this.oView.byId("userAvatar");
				userAvatar.setActive(false);
				this._oUserMenuPopover.close();
				const menuTitle = oEvent.getSource() ? oEvent.getSource().getProperty("title") : "";
				if (menuTitle == "Sign Out") {
					window.location = "/do/logout";
				} else if (menuTitle == "Report Issue") {
					window.open(Common.LINK_REPORT_ISSUE);
				} else if (menuTitle == "About") {
					this.openAboutDialog();
				}
			},


			openAboutDialog: function() {
				if (!this.oAboutDialog) {
					this.oAboutDialog = new sap.m.Dialog({
						type: sap.m.DialogType.Message,
						title: "About",
						content: new sap.m.Label({
							text: "SAP Integration DevOps v{buildInfo>/version}-{buildInfo>/commit} ({buildInfo>/date})"
						}),
						beginButton: new sap.m.Button({
							type: sap.m.ButtonType.Emphasized,
							text: "OK",
							press: function() {
								this.oAboutDialog.close();
							}.bind(this)
						})
					});
					this.getView().addDependent(this.oAboutDialog);
				}
				this.oAboutDialog.open();
			},

			// start of session expiring handling
			setupSessionExpiringTimer: function() {

				// setup session timeout countdown model
				this.oSessionExpiringModel = new JSONModel({
					bIsExpiring: true,
					iSecondsLeft: Common.SESSION_WARNING_SEC
				});
				this.getView().setModel(this.oSessionExpiringModel, "sessionExpiring");

				// add fetch event listener
				const me = this;
				window.fetch = new Proxy(window.fetch, {
					apply: function(actualFetch, that, args) {
						// reset session expiring timeout before each fetch
						me.resetSessionExpiringTimeout();

						// Forward function call to the original fetch
						const result = Reflect.apply(actualFetch, that, args);

						// Do whatever you want with the resulting Promise
						// result.then((response) => {
						// 	console.log("fetch completed!", args, response);
						// });
						return result;
					}
				});
				this.resetSessionExpiringTimeout();
			},

			resetSessionExpiringTimeout: function() {
				if (this._sessionExpiringTimeout) {
					clearTimeout(this._sessionExpiringTimeout);
				}

				// show session warning dialog before session timeout
				this._sessionExpiringTimeout = setTimeout(this.openSessionExpiringDialog.bind(this), (Common.SESSION_TIMEOUT_SEC - Common.SESSION_WARNING_SEC) * 1000);
			},

			openSessionExpiringDialog: function() {
				if (!this._oSessionExpiringDialog) {
					Fragment.load({
						name: "org.sapux.int.view.frag.AppSessionExpiringDialog",
						controller: this
					}).then(function(oSessionExpiringDialog) {
						this._oSessionExpiringDialog = oSessionExpiringDialog;
						this.getView().addDependent(this._oSessionExpiringDialog);
						this.onSessionExpiringDialogOpen();
					}.bind(this));
				} else {
					this.onSessionExpiringDialogOpen();
				}
			},

			onSessionExpiringDialogOpen: function() {
				this._oSessionExpiringDialog.open();
				this._startCounter();
			},

			onContinueWorking: function() {
				this.onSessionExpiringDialogClose();

				// fire a dummy fetch request
				this.loadUserInfo();
			},

			onSessionExpiringDialogClose: function() {
				this._oSessionExpiringDialog.close();
				this._stopCounter();
			},

			onSignIn: function() {
				this.onSessionExpiringDialogClose();
				window.location.reload();
			},

			onExit: function() {
				this._stopCounter();
				window.location.reload();
			},

			_decrementCounter: function() {
				this._onUpdateStatus();
				if (this.iSeconds === 0) {
					this._stopCounter();
					this._onCounterEnd();
					return;
				}
				this.iSeconds--;
			},

			_startCounter: function() {
				this.iSeconds = Common.SESSION_WARNING_SEC;
				this._onCounterStart();
				clearInterval(this.oTimer);
				this.oTimer = setInterval(this._decrementCounter.bind(this), 1000);
			},

			_stopCounter: function() {
				clearInterval(this.oTimer);
				this.oTimer = null;
			},

			_onUpdateStatus: function() {
				this.oSessionExpiringModel.setProperty("/iSecondsLeft", this.iSeconds);
			},

			_onCounterStart: function() {
				this.oSessionExpiringModel.setProperty("/bIsExpiring", true);
				this.oSessionExpiringModel.setProperty("/iSecondsLeft", this.iSeconds);
				this.iSeconds--;
			},

			_onCounterEnd: function() {
				this.oSessionExpiringModel.setProperty("/bIsExpiring", false);
			}
		});
	}
);