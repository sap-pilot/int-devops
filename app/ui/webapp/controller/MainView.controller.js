sap.ui.define([
	"org/sapux/int/controller/BaseController",
	"org/sapux/int/util/Common",
    "sap/ui/model/json/JSONModel",
	"sap/m/Select",
	"sap/ui/core/Item",
	"sap/suite/ui/commons/networkgraph/layout/SwimLaneChainLayout",
	"sap/ui/table/Column",
	"sap/m/Label",
	"sap/m/Text",
	"sap/ui/core/Fragment",
	"org/sapux/int/model/formatter"
], function (BaseController, Common, JSONModel, Select, Item, SwimLaneChainLayout, Column, Label, Text, Fragment, formatter) {
	"use strict";

	return BaseController.extend("org.sapux.int.controller.Monitor", {

		formatter: formatter,

        onInit: function () {

			this.oViewStateModel = new JSONModel({
				busy: true
			});
			this.getView().setModel(this.oViewStateModel,"viewState");

			this._selectedNodes = new Set(); // Store selected node keys
			let oGraph = this.byId("graph");
			oGraph.setLayoutAlgorithm(new SwimLaneChainLayout());
			this.setUpOrientationSelect();

			// load resource tree depending on liveMode
			this.oCasResourcesModel = new JSONModel();
			this.oCasResourcesTable = this.byId("casResourcesTable");
			this.getView().setModel(this.oCasResourcesModel,"casResources");

			// initial landscape model (need to format contentResources response)
			this.oLandscapeModel = new JSONModel();
			this.getView().setModel(this.oLandscapeModel,"landscape");

			this.oCasResourcesModel.attachRequestCompleted(this.processContentResources.bind(this));
			this.oCasResourcesModel.attachRequestFailed(function(oEvent) {
				console.log("Content resources load failed");
				const oParams = oEvent.getParameters();
				Common.reportError(oParams,"Error loading content resources", null);
			}.bind(this));

			// listen to appState>/liveMode change event
			const appStateModel = this.getOwnerComponent().getModel("appState");
			appStateModel.bindProperty("/liveMode").attachChange(function(){this.loadContentResources(false)}.bind(this));

			// now load resource tree, delay a bit otherwise busy indicator wont work on initial load
			setTimeout(function(){this.loadContentResources(false)}.bind(this),200);
		},

		setBusy(bBusy) {
			this.oViewStateModel.setProperty("/busy",bBusy);
		},

		loadContentResources(forceRefresh) {
			this.setBusy(true);
			const appStateModel = this.getOwnerComponent().getModel("appState");
			const sResourcePath = appStateModel.getProperty("/liveMode")?`/srv/cas/resources(forceRefresh=${forceRefresh?true:false})`:"model/resources.json";
			this.oCasResourcesModel.loadData(sResourcePath);
		},

		processContentResources(result) {
			this.setBusy(false);
			// update treeTable
			const aColumns = this.oCasResourcesTable.getColumns();
			// remove existing columns
			for (let i = aColumns.length-1; i>2; i--) {
				this.oCasResourcesTable.removeColumn(i);
			}	
			// add new columns
			const oContentResources = this.oCasResourcesModel.getProperty("/value");
			const selectedIndicesSet = new Set();
			const aNodes = oContentResources?.nodes || [];
			const maxCasNodes = oContentResources?.countCasNodes || 0;
			for (let i = 0; i < maxCasNodes; i++) {
				const node = aNodes[i];
				const columnVisible = !node.r?.error && !node.r?.warning;
				let column = new Column({
					label: node.casUrl?
						new sap.m.Link({
							text: node.alias, href:`${node.casUrl}`, 
							tooltip: `Open Content-Agent for ${node.alias}`,
							emphasized: true,
							target:"_blank",  wrapping: false})
						: new Text({text: node.alias, wrapping: false}),
					template: new Text({text: `{casResources>v${node.idx}}`, wrapping: false}),
					width: "5em",
					visible: columnVisible
				});
				this.oCasResourcesTable.addColumn(column);
				if (columnVisible) {
					selectedIndicesSet.add(node.idx);
				}
			}
			// add allowUploadNodes and allowExportNodes for Export Dialog
			let allowUploadNodes = [], allowExportNodes = [];
			for (let node of aNodes) {
				if (node.casDest) allowExportNodes.push(node);
				if (node.tmsUploadAllowed) allowUploadNodes.push(node);
			}
			this.oCasResourcesModel.setProperty("/allowUploadNodes",allowUploadNodes);
			this.oCasResourcesModel.setProperty("/allowExportNodes",allowExportNodes);

			// update comparision status
			this.updateVerisonCompareStatus(oContentResources,selectedIndicesSet, maxCasNodes);
			this.updateLandscapeModel(oContentResources);
			
			// add readable date to oContentResources
			if (oContentResources?.lastUpdated) {
				this.oCasResourcesModel.setProperty("/value/lastUpdatedFormatted",new Date(oContentResources.lastUpdated).toLocaleString());
			} 
		},

		updateLandscapeModel(oContentResources) {
			const obj = {
				nodes: structuredClone(oContentResources?.nodes) || [],
				groups: structuredClone(oContentResources?.groups) || [],
				routes: structuredClone(oContentResources?.routes) || []
			};
			for (const node of obj.nodes) {
				node.attrs = [];
				if (node.alias) {
					node.attrs.push({key:"alias",value:node.alias});
				}
				for (const [key, value] of Object.entries(node.r)) {
					const attr = {key: key, value: value};
					node.attrs.push(attr);
				}
				//node.checkboxState = "Checked"; // dont show checkbox yet
				if (node.r.error) {
					node.status = "Error";
				} else if (node.r.warning) { 
					node.status = "Warning";
				} else {
					node.selected = true;
					node.pSelected = true;
				}
			}
			this.oLandscapeModel.setData(obj);
		},

		setUpOrientationSelect: function () {
			var oGraph = this.byId("graph"),
				oToolbar = this.byId("graph-toolbar");
				
			// disable some existing content
			let aExistingContent = oToolbar.getContent();
			aExistingContent[0].setVisible(false); // disable 1st spacer
			aExistingContent[1].setVisible(false); // disable search field
			aExistingContent[2].setVisible(false); // disable legend
			// add new control
			let oOrientation = new Select();
			[
				{key: "TopBottom", text: "Top to bottom"},
				{key: "BottomTop", text: "Bottom to top"},
				{key: "LeftRight", text: "Left to right"},
				{key: "RightLeft", text: "Right to left"}	
			].forEach(function (o) {
				oOrientation.addItem(new Item(o));
			});
			oOrientation.setSelectedKey(this.getOwnerComponent().getModel("appState").getProperty("/landscapeOrientation"));
			oOrientation.attachChange(function (oEvent) {
				var sKey = oEvent.getParameter("selectedItem").getKey();
				oGraph.setOrientation(sKey);
			});
			let oTitleLabel = new sap.m.Link({
				text:"TMS Landscape",
				href:"{casResources>/value/tmsUrl}",
				tooltip: "Open TMS",
				target:"_blank",
				emphasized: true,
				enabled:"{=${casResources>/value/tmsUrl} !== undefined}"
			});
			oToolbar.insertContent(oTitleLabel, 0);
			let oLabel = new Label({
				text:"(updated as of {casResources>/value/lastUpdatedFormatted})", 
				visible:"{=${casResources>/value/lastUpdatedFormatted} !== undefined && !${viewState>/busy}}"
			});
			oToolbar.insertContent(oLabel, 1);
			let spacer = new sap.m.ToolbarSpacer();
			oToolbar.insertContent(spacer, 2);
			oToolbar.insertContent(oOrientation, 3);
			

		},

		onTreeFilterChange: function() {
			const oTreeFilter = this.byId("treeFilter");
			const sText = oTreeFilter.getValue().toLowerCase();
			const oModel = this.getView().getModel("casResources");
			if (!this.oOriginTree)
				this.oOriginTree = oModel.getProperty("/value/c");
			if (!sText) {
				this.getView().getModel("casResources").setProperty("/value/c",this.oOriginTree);
			} else {
				let arr = sText.split(" ");
				const matchAll = function(str) {
					if (!str) return false;
					return arr.every( (s) => str.indexOf(s) > -1 );
				};
				const oFilteredTree = this.filterTree(this.oOriginTree, node => {
					let nonStatusFields = [];
					for (const [key, value] of Object.entries(node) ) {
						if ((key != 's' && key != 'c' && value && typeof value === 'string'))
							nonStatusFields.push(value.toLowerCase());
					}
					if (matchAll(nonStatusFields.join(' '))) {
						return {exactMatch: true}; // this case will include the node itself and all its children
					} else if (node.s?.indexOf(sText) > -1) {
						return true; // this case will include the node itself only
					}
					return false;
				});
				this.getView().getModel("casResources").setProperty("/value/c", oFilteredTree);
				this.handleTreeAction("expandAll");
			}			
		},

		filterTree: function (tree, condition) {
			return tree.reduce((filtered, node) => {
				const matchResult = condition(node);
				if (matchResult?.exactMatch) {
					// matched id or name so include the node and all it's children
					filtered.push(node);
				} else {
					// matched version, status etc, so only include itself and matching children
					const children = node.c ? this.filterTree(node.c, condition) : [];
					if (matchResult || children.length) {
						filtered.push({ ...node, c: children });
					}
				}
				return filtered;
			}, []);
		},

		handleTreeAction: function (action) {
			switch (action) {
				case "collapseAll":
					this.oCasResourcesTable.collapseAll();
					break;
				case "expandAll":
					this.oCasResourcesTable.expandToLevel(3);
					break;
				case "collapseSelection":
					this.oCasResourcesTable.collapse(this.oCasResourcesTable.getSelectedIndices());
					break;
				case "expandSelection":
					this.oCasResourcesTable.expand(this.oCasResourcesTable.getSelectedIndices());
					break;
			}
		},

		onNodePress: function (oEvent) {
			const oNode = oEvent.getSource();
			const nodes = this.oLandscapeModel.getProperty("/nodes");
			const node = nodes[oNode.getKey()];
			node.pSelected = !node.pSelected; // flip true selected state
		},

		onGraphSelectionChange: function(oEvent) {
			const maxCasNodes = this.oCasResourcesModel.getProperty("/value/countCasNodes");
			const nodes = this.oLandscapeModel.getProperty("/nodes");
			const columns = this.oCasResourcesTable.getColumns();
			const selectedIndexSet = new Set();
			for (const node of nodes) {
				node.selected = node.pSelected;
				if (node.idx >= maxCasNodes)
					continue; // skip nodes without contentResourcees
				if (node.r?.error || node.r?.warning) 
					continue; // skip nodes with error or warning
				columns[node.idx+3].setVisible(node.selected);
				if (node.selected)
					selectedIndexSet.add(node.idx);
			}
			const oCasResources = this.oCasResourcesModel.getData();
			this.updateVerisonCompareStatus(oCasResources.value,selectedIndexSet, maxCasNodes);
			this.oCasResourcesModel.setProperty("/value/c",oCasResources.value.c);
		},

		updateVerisonCompareStatus: function(entry, selectedIndexSet, maxCasNodes) {
			if (!entry)
				return 0;
			let maxUnique = 1;
			if (entry.c && entry.c.length > 0) {
				for (let child of entry.c) {
					const cd = this.updateVerisonCompareStatus(child, selectedIndexSet, maxCasNodes);
					if (cd > maxUnique)
						maxUnique = cd;
				}
			}
			let u = 0;
			let arr = [];
			for (let idx of selectedIndexSet) {
				if (idx >= maxCasNodes)
					continue; // skip nodes without contentResourcees
				const v = `v${idx}`;
				arr.push(entry[v]);
			}
			u = this.countUnique(arr);
			//debugger;
			if (u <= 1 && maxUnique <= 1)
				entry.s = 'ok';
			else if (u > 2 || maxUnique > 2)
				entry.s = 'error'
			else
			entry.s = 'warning';
			return u == 1? maxUnique : u;
		},

		countUnique: function(iterable) {
			return new Set(iterable).size;
		},

		bSuppressSelectionEvent: false, // supress tree selection event so to prevent infinite loop when operating tree selection

		onTreeSelectionChange: function(oEvent) {
			const oParams = oEvent.getParameters();
			//console.log(`tree selection source index: ${oParams.rowIndex}, context: ${oParams.rowContext}, userInteraction? ${oParams.userInteraction}`);
			if (this.bSuppressSelectionEvent || !oParams.userInteraction) {
				return; 
			}
			this.bSuppressSelectionEvent = true;
			const entry = oParams.rowContext?.getObject();
			if (entry) {
				const bSelected = oParams.rowIndex !== -1 && this.oCasResourcesTable.isIndexSelected(oParams.rowIndex); // Check if the row is selected
				this.recursiveUpdateEntrySelection(entry, bSelected);
			}
			// update selected rows
			this.updateRowSelection();
			this.bSuppressSelectionEvent = false;
		},

		onToggleOpenState: function(oEvent) {	
			this.bSuppressSelectionEvent = true;
			this.updateRowSelection();
			this.bSuppressSelectionEvent = false;
		},

		updateRowSelection: function() {
			const oRootEntry = this.oCasResourcesModel.getProperty("/value");
			const aSelectedEntries = [], aSelectedTransportableEntries = [], aAllEntries = [];
			this.addSelectedEntries(oRootEntry, aSelectedEntries, aSelectedTransportableEntries, aAllEntries);
			// update selection
			console.log(`update row selection, selected entries: ${aSelectedEntries.length}, transportable: ${aSelectedTransportableEntries.length}, all: ${aAllEntries.length}`);
			this.oCasResourcesTable.clearSelection();
			for (let i = 0; i < aAllEntries.length; i++) {
				const oRowContext = this.oCasResourcesTable.getContextByIndex(i);
				if (!oRowContext) {
					break; // reach end of rows;
				}
				if (aSelectedEntries.indexOf(oRowContext.getObject()) > -1) {
					this.oCasResourcesTable.addSelectionInterval(i,i);
				}
			}
			const oExportBtn = this.byId("exportBtn");
			this.oCasResourcesModel.setProperty("/value/selectedTransportableEntries", aSelectedTransportableEntries.length);
			// oExportBtn.setText(`Export (${aSelectedTransportableEntries.length})`)
			// oExportBtn.setEnabled(aSelectedTransportableEntries.length > 0);
		},

		addSelectedEntries: function(entry, aSelectedEntries, aSelectedTransportableEntries, aAllEntries) {
			aAllEntries.push(entry);
			if (entry.selected) {
				aSelectedEntries.push(entry);
				if (entry.t) {
					// has subType, hence transportable
					aSelectedTransportableEntries.push(entry);
				}
			}
			if (entry.c && entry.c.length > 0) {
				for (let child of entry.c) {
					this.addSelectedEntries(child, aSelectedEntries, aSelectedTransportableEntries, aAllEntries);
				}
			}
		},

		recursiveUpdateEntrySelection: function(entry, selected) {
			entry.selected = selected;
			if (entry.c && entry.c.length > 0) {
				for (let child of entry.c) {
					this.recursiveUpdateEntrySelection(child, selected);
				}
			}
		},

		filterSelectedTree: function(entry) {
			if (entry.c && entry.c.length > 0) {
				entry.selectedChildren = entry.c.filter(child => this.filterSelectedTree(child));
			}
			if (entry.selected || entry.selectedChildren?.length > 0) {
				return entry;
			} else {
				return null;
			}
		},

		openExportDialog: function() {
			// get selected tree entries
			const oRootEntry = this.oCasResourcesModel.getProperty("/value");
			const oFilteredRoot = this.filterSelectedTree(oRootEntry);
			if (!this.oCasExportModel) {
				this.oCasExportModel = new JSONModel();
			}
			this.oCasExportModel.setProperty("/resources",oFilteredRoot);
			this.getView().setModel(this.oCasExportModel,"casExport");
			if (!this.oExportDialog) {
				Fragment.load({
					id: this.getView().getId(),
					name: "org.sapux.int.view.frag.ExportDialog",
					controller: this
				}).then(function(oDialog) {
					this.getView().addDependent(oDialog);
					this.oExportDialog = oDialog;
					this.oExportDialog.open();
					this.byId("exportTreeTable").expandToLevel(3);
					//this.bindFullscreenTable(sSource);
				}.bind(this));
				// to get access to the controller's model
			} else {
				this.oExportDialog.open();
				//this.bindFullscreenTable(sSource);
			}
		},

		closeExportDialog: function(event) {
			if (this.oExportDialog) {
				this.oExportDialog.close();
			}
		},
	});

});
