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
	"org/sapux/int/model/formatter"
], function (BaseController, Common, JSONModel, Select, Item, SwimLaneChainLayout, Column, Label, Text, formatter) {
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
			this.oResourceTreeModel = new JSONModel();
			this.oTreeTable = this.byId("resourceTreeTable");
			this.getView().setModel(this.oResourceTreeModel,"resourceTree");

			// initial landscape model (need to format contentResources response)
			this.oLandscapeModel = new JSONModel();
			this.getView().setModel(this.oLandscapeModel,"landscape");

			// list to nodes change event so to update columns
			const fnContentResourcesLoaded = function() {
				const aColumns = this.oTreeTable.getColumns();
				// remove existing columns
				for (let i = aColumns.length-1; i>2; i--) {
					this.oTreeTable.removeColumn(i);
				}	
				// add new columns
				const oContentResources = this.oResourceTreeModel.getProperty("/value");
				const selectedIndicesSet = new Set();
				const aNodes = oContentResources.nodes;
				const maxCasNodes = oContentResources.countCasNodes;
				for (let i = 0; i < maxCasNodes; i++) {
					const node = aNodes[i];;
					let column = new Column({
						label: new Label({text: node.alias}),
						template: new Text({text: `{resourceTree>v${node.idx}}`, wrapping: false}),
						width: "5em",
						visible: !node.r.error
					});
					this.oTreeTable.addColumn(column);
					selectedIndicesSet.add(node.idx);
				}
				// update comparision status
				this._updateVerisonCompareStatus(oContentResources,selectedIndicesSet, maxCasNodes);
				this.updateLandscapeModel(oContentResources);
				// add readable date to oContentResources
				if (oContentResources.lastUpdated) {
					this.oResourceTreeModel.setProperty("/value/lastUpdatedFormatted",new Date(oContentResources.lastUpdated).toLocaleString());
				}
				this.setBusy(false);
			}.bind(this);
			this.oResourceTreeModel.attachRequestCompleted(fnContentResourcesLoaded);
			this.oResourceTreeModel.attachRequestFailed(function(oEvent) {
				const oParams = oEvent.getParameters();
				Common.reportError(oParams,"Error loading content resources", null);
			});

			// list to appState>/liveMode change event
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
			this.oResourceTreeModel.loadData(sResourcePath);
		},

		updateLandscapeModel(oContentResources) {
			const obj = {
				nodes: structuredClone(oContentResources.nodes),
				groups: structuredClone(oContentResources.groups),
				routes: structuredClone(oContentResources.routes)
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
			let oTitleLabel = new Label({text:"TMS Landscape",design:"Bold"});
			oToolbar.insertContent(oTitleLabel, 0);
			let oLabel = new Label({
				text:"(updated as of {resourceTree>/value/lastUpdatedFormatted})", 
				visible:"{=${resourceTree>/value/lastUpdatedFormatted} !== undefined && !${viewState>/busy}}"
			});
			oToolbar.insertContent(oLabel, 1);
			let spacer = new sap.m.ToolbarSpacer();
			oToolbar.insertContent(spacer, 2);
			oToolbar.insertContent(oOrientation, 3);
			

		},

		onTreeFilterChange: function() {
			const oTreeFilter = this.byId("treeFilter");
			const sText = oTreeFilter.getValue().toLowerCase();
			if (!this.oOriginTree)
				this.oOriginTree = this.getView().getModel("resourceTree").getData();
			if (!sText) {
				this.getView().getModel("resourceTree").setData(this.oOriginTree);
			} else {
				const oFilteredTree = this.filterTree(this.oOriginTree.value.c, node => {
					for (const [key, value] of Object.entries(node) ) {
						if (key != 'c' && value && value.toLowerCase().indexOf(sText) > -1 )
							return true;
					}
					return false;
				});
				this.getView().getModel("resourceTree").setData({"value":{"c":oFilteredTree}});
				this.onExpandAll();
			}			
		},

		filterTree: function(tree, condition) {
			return tree
			  .map(node => {
				const c = node.c ? this.filterTree(node.c, condition) : [];
				// If current node matches or has matching children
				if (condition(node) || c.length) {
				  return { ...node, c };
				}
				return null;
			  })
			  .filter(Boolean); // Remove null entries
		},

		onCollapseAll: function() {
			this.oTreeTable.collapseAll();
		},

		onExpandAll: function() {
			this.oTreeTable.expandToLevel(3);
		},

		onCollapseSelection: function() {
			this.oTreeTable.collapse(this.oTreeTable.getSelectedIndices());
		},

		onExpandSelection: function() {
			this.oTreeTable.expand(this.oTreeTable.getSelectedIndices());
		},

		onNodePress: function (oEvent) {
			const oNode = oEvent.getSource();
			const nodes = this.oLandscapeModel.getProperty("/nodes");
			const node = nodes[oNode.getKey()];
			node.pSelected = !node.pSelected; // flip true selected state
		},

		onGraphSelectionChange: function(oEvent) {
			const maxCasNodes = this.oResourceTreeModel.getProperty("/value/countCasNodes");
			const nodes = this.oLandscapeModel.getProperty("/nodes");
			const columns = this.oTreeTable.getColumns();
			const selectedIndexSet = new Set();
			for (const node of nodes) {
				node.selected = node.pSelected;
				if (node.idx > maxCasNodes)
					continue; // skip nodes without contentResourcees
				columns[node.idx+3].setVisible(node.selected);
				if (node.selected)
					selectedIndexSet.add(node.idx);
			}
			const oResourceTree = this.oResourceTreeModel.getData();
			this._updateVerisonCompareStatus(oResourceTree.value,selectedIndexSet, maxCasNodes);
			this.oResourceTreeModel.setProperty("/value/c",oResourceTree.value.c);
		},

		_updateVerisonCompareStatus: function(entry, selectedIndexSet, maxCasNodes) {
			let maxUnique = 1;
			if (entry.c && entry.c.length > 0) {
				for (let child of entry.c) {
					const cd = this._updateVerisonCompareStatus(child, selectedIndexSet, maxCasNodes);
					if (cd > maxUnique)
						maxUnique = cd;
				}
			}
			let u = 0;
			let arr = [];
			for ( let idx of selectedIndexSet) {
				if (idx >= maxCasNodes)
					continue; // skip nodes without contentResourcees
				const v = `v${idx}`;
				arr.push(entry[v]);
			}
			u = this._countUnique(arr);
			//debugger;
			if (u <= 1 && maxUnique <= 1)
				entry.s = 'ok';
			else if (u > 2 || maxUnique > 2)
				entry.s = 'error'
			else
			entry.s = 'warning';
			return u == 1? maxUnique : u;
		},

		_countUnique: function(iterable) {
			return new Set(iterable).size;
		},

		onTreeSelectionChange: function(oEvent) {
			const oParams = oEvent.getParameters();
			console.log(`tree selection source index: ${oParams.rowIndex}, context: ${oParams.rowContext}`);
			// const oSource = this.oResourceTreeModel.getProperty(oParams.rowContext.toString());
			const aSelection = this.oTreeTable.getSelectedIndices() || [];
			this.byId("exportBtn").setText(`Export (${aSelection.length})`)
		}
	});

});
