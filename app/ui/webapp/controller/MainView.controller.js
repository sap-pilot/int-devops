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
				busy: true,
				busyExporting: false
			});
			this.getView().setModel(this.oViewStateModel,"viewState");

			this._selectedNodes = new Set(); // Store selected node keys
			let oGraph = this.byId("graph");
			oGraph.setLayoutAlgorithm(new SwimLaneChainLayout());
			this.setupGraphControls();

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
			setTimeout(function(){this.loadContentResources(false)}.bind(this),100);
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

		onNodePress: function (oEvent) {
			const oNode = oEvent.getSource();
			const nodes = this.oLandscapeModel.getProperty("/nodes");
			const sKey = oNode.getKey();
			const node = nodes.find( (elemenet) => elemenet.tmsNodeId == sKey);
			if (node)
				node.pSelected = !node.pSelected; // flip true selected state
		},

		onGraphSelectionChange: function(oEvent) {
			const nodes = this.oLandscapeModel.getProperty("/nodes");
			const columns = this.oCasResourcesTable.getColumns();
			const selectedIndexSet = new Set();
			for (const node of nodes) {
				node.selected = node.pSelected;
				if (node.idx === undefined)
					continue; // skip non-cas nodes (or "otherTmsNodes")
				if (node.error || node.warning) 
					continue; // skip nodes with error or warning
				columns[node.idx+3].setVisible(node.selected);
				if (node.selected)
					selectedIndexSet.add(node.idx);
			}
			const oCasResources = this.oCasResourcesModel.getProperty("/value");
			this.updateVerisonCompareStatus(oCasResources,selectedIndexSet);
			this.oCasResourcesModel.setProperty("/value/c",oCasResources.c);
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

			// update tree table
			const oContentResources = this.oCasResourcesModel.getProperty("/value");
			const aCasNodes = oContentResources?.casNodes || [];
			this.updateTreeTableColumns(this.oCasResourcesTable, aCasNodes, oContentResources, "casResources", true)

			// merge cas and tms nodes
			const allNodes = [ ...oContentResources?.casNodes || [], ...oContentResources?.otherTmsNodes || [] ];
			oContentResources.allNodes = allNodes;
			this.oCasResourcesModel.setProperty("/allNodes", allNodes);

			// update landscape graph model
			this.updateLandscapeModel(oContentResources);

			// add allowUploadNodes and allowExportNodes for Export Dialog
			let allowUploadNodes = [], allowExportNodes = [];
			for (let node of allNodes || []) {
				if (node.casDest && !node.error) allowExportNodes.push(node);
				if (node.tmsUploadAllowed) allowUploadNodes.push(node);
			}
			this.oCasResourcesModel.setProperty("/allowUploadNodes",allowUploadNodes);
			this.oCasResourcesModel.setProperty("/allowExportNodes",allowExportNodes);

			// add readable date to oContentResources
			if (oContentResources?.lastUpdated) {
				this.oCasResourcesModel.setProperty("/value/lastUpdatedFormatted",new Date(oContentResources.lastUpdated).toLocaleString());
			} 

			this.bSuppressSelectionEvent = true;
			this.updateRowSelection();
			this.bSuppressSelectionEvent = false;
		},

		updateTreeTableColumns(oTreeTable, aCasNodes, oResourceRoot, sModelName, bColumnsInitialVisible) {
			// remove existing columns
			const aColumns = oTreeTable.getColumns();
			for (let i = aColumns.length-1; i>2; i--) {
				oTreeTable.removeColumn(i);
			}	
			// add new columns
			const selectedIndicesSet = new Set();
			for (const node of aCasNodes) {
				const columnVisible = bColumnsInitialVisible && (!node.error && !node.warning);
				let column = new Column({
					label: node.casUrl?
						new sap.m.Link({
							text: node.alias, href:`${node.casUrl}`, 
							tooltip: `Open Content-Agent for ${node.alias}`,
							emphasized: true,
							target:"_blank",  wrapping: false})
						: new Text({text: node.alias, wrapping: false}),
					template: new Text({text: `{${sModelName}>v${node.idx}}`, wrapping: false}),
					width: "5em",
					visible: columnVisible
				});
				oTreeTable.addColumn(column);
				if (columnVisible) {
					selectedIndicesSet.add(node.idx);
				}
			}
			// update comparision status
			this.updateVerisonCompareStatus(oResourceRoot, selectedIndicesSet);
		},

		updateLandscapeModel(oContentResources) {
			const obj = {
				nodes: structuredClone(oContentResources?.allNodes) || [],
				groups: structuredClone(oContentResources?.groups) || [],
				routes: structuredClone(oContentResources?.routes) || []
			};
			for (const node of obj.nodes) {
				node.attrs = [];
				if (node.alias) {
					node.attrs.push({key:"alias",value:node.alias});
				}
				if (node.resources) {
					for (const [key, value] of Object.entries(node.resources)) {
						const attr = {key: key, value: value};
						node.attrs.push(attr);
					}
				}
				//node.checkboxState = "Checked"; // dont show checkbox yet
				if (node.error) {
					node.status = "Error";
				} else if (node.warning) { 
					node.status = "Warning";
				} else if (node.idx === undefined) { // not a cas node
					node.status = "Warning";
					node.attrs.push({key: "warning", value: "CAS not connected"});
				} else {
					node.selected = true;
					node.pSelected = true;
				}
			}
			this.oLandscapeModel.setData(obj);
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
			this.bSuppressSelectionEvent = true;
			this.updateRowSelection();
			this.bSuppressSelectionEvent = false;
		},

		updateVerisonCompareStatus: function(entry, selectedIndexSet) {
			if (!entry)
				return 0;
			let maxUnique = 1;
			if (entry.c && entry.c.length > 0) {
				for (let child of entry.c) {
					const cd = this.updateVerisonCompareStatus(child, selectedIndexSet);
					if (cd > maxUnique)
						maxUnique = cd;
				}
			}
			let u = 0;
			let arr = [];
			for (let idx of selectedIndexSet) {
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
			let set = new Set(iterable);
			if (set.has('-')) // if artifact is missing then return at least warning
				return set.size > 2? set.size : 2;
			else
				return set.size;
		},

		bSuppressSelectionEvent: false, // supress tree selection event so to prevent infinite loop when operating tree selection

		onTreeSelectionChange: function(oEvent) {
			const oParams = oEvent.getParameters();
			console.log(`tree selection source index: ${oParams.rowIndex}, context: ${oParams.rowContext}, userInteraction? ${oParams.userInteraction}`);
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
			this.oCasResourcesModel.setProperty("/value/selectedTransportableEntries", aSelectedTransportableEntries.length);
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
			let filteredChildren = null;
			if (entry.c && entry.c.length > 0) {
				filteredChildren = entry.c.filter(child => this.filterSelectedTree(child));
			}
			if (entry.selected || filteredChildren?.length > 0) {
				return {...entry, c: filteredChildren}; // copy node 
			} else {
				return null;
			}
		},

		openExportDialog: function() {
			// build export model base on selected tree entries
			const oContentResources = this.oCasResourcesModel.getProperty("/value");
			const aCasNodes = oContentResources?.casNodes || [];
			const oFilteredRoot = {c:this.filterSelectedTree(oContentResources).c}; // keep only content resources
			if (!this.oCasExportModel) {
				this.oCasExportModel = new JSONModel();
				this.getView().setModel(this.oCasExportModel,"casExport");
			}
			this.oCasExportModel.setData({
				sourceNode: '',
				targetNode: '',
				description: '',
				nonExistEntriesCount: 0,
				exported: false,
				contentResources: oFilteredRoot, // content resources
				result: {
					message: "Not initiated"
				}
			})
			if (!this.oExportDialog) {
				Fragment.load({
					id: this.getView().getId(),
					name: "org.sapux.int.view.frag.ExportDialog",
					controller: this
				}).then(function(oDialog) {
					this.getView().addDependent(oDialog);
					this.oExportDialog = oDialog;
					this.oExportDialog.open();
					this.oExportTreeTable = this.byId("exportTreeTable");
					// add columns
					this.updateTreeTableColumns(this.oExportTreeTable, aCasNodes, oFilteredRoot, "casExport", false);
					this.oExportTreeTable.expandToLevel(3);
				}.bind(this));
			} else {
				this.oExportDialog.open();
				// update columns
				this.updateTreeTableColumns(this.oExportTreeTable, aCasNodes, oFilteredRoot, "casExport", false);
				this.onExportNodeChange();
				this.oExportTreeTable.expandToLevel(3);
			}			
		},

		closeExportDialog: function(event) {
			if (this.oExportDialog) {
				this.oExportDialog.close();
			}
		},

		onExportNodeChange: function(oEvent) {
			let sSourceNode = this.oCasExportModel.getProperty("/sourceNode");
			let sTargetNode = this.oCasExportModel.getProperty("/targetNode");
			//console.log(`export node change, source=${sSourceNode}, target=${sTargetNode}`);
			const nodes = this.oCasResourcesModel.getProperty("/value/allNodes");
			const columns = this.oExportTreeTable.getColumns();
			let selectedIndexSet = new Set();
			for (const node of nodes) {
				if (node.idx != undefined && node.tmsNode !== undefined && (node.tmsNode == sSourceNode || node.tmsNode == sTargetNode)) {
					columns[node.idx+3].setVisible(true);
					selectedIndexSet.add(node.idx);
				}
				else if (node.idx != undefined) {
					columns[node.idx+3].setVisible(false);
				}
			}
			const oCasExportRoot = this.oCasExportModel.getProperty("/contentResources");
			this.updateVerisonCompareStatus(oCasExportRoot,selectedIndexSet); // update compare status "s"
			this.oCasExportModel.setProperty("/contentResources",oCasExportRoot);

			// count nonexist entries in source
			let oSourceNode = nodes.find(node => node.tmsNode === sSourceNode);
			const cnt = oSourceNode?.idx ? this.countNonExistEntries(oCasExportRoot, `v${oSourceNode.idx}`) : 0;
			this.oCasExportModel.setProperty("/nonExistEntriesCount", cnt);
			//console.log(`idx: ${oSourceNode?.idx}, nonExistEntriesCount: ${cnt}`);
		},

		countNonExistEntries: function(entry, sProp) {
			let cnt = 0;
			if (entry[sProp] === undefined || entry[sProp] == '-')
				cnt++;
			if (entry.c && entry.c.length > 0) {
				for (let child of entry.c) {
					cnt += this.countNonExistEntries(child, sProp);
				}
			}
			return cnt;
		},

		onExportToTMS: function() {
			this.oViewStateModel.setProperty("/busyExporting",true);
			this.oCasExportModel.setProperty("/result/message","Export in progress");
			let oExportData = this.oCasExportModel.getData();
			debugger;
			fetch("/srv/cas/export", {
				method: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({payload:JSON.stringify(oExportData)}) // urgly but seems to be the only way to pass any/tree object type
			})
			.then(response => {
				if (!response.ok) {
				  	throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.json(); // or response.text(), response.blob(), etc.
			})
			.then(this.handleExportResponse.bind(this))
			.catch(function(error) {
				Common.reportError(error, "Error exporting to TMS", null);
				this.oCasExportModel.setProperty("/result/message","Error during export");
			}.bind(this))
			.finally(function(){
				this.oViewStateModel.setProperty("/busyExporting",false);
			}.bind(this));
		},

		handleExportResponse: function(response) {
			console.log(response);
			if (response?.value) {
				this.oCasExportModel.setProperty("/result",response.value);
				this.oCasExportModel.setProperty("/exported", true);
			} 
		}
	});

});
