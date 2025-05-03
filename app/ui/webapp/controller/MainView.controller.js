sap.ui.define([
	"org/sapux/int/controller/BaseController",
    "sap/ui/model/json/JSONModel",
	"sap/m/Select",
	"sap/ui/core/Item",
	"sap/suite/ui/commons/networkgraph/layout/SwimLaneChainLayout",
	"sap/ui/table/Column",
	"sap/m/Label",
	"sap/m/Text",
	"org/sapux/int/model/formatter"
], function (BaseController,JSONModel, Select, Item, SwimLaneChainLayout, Column, Label, Text, formatter) {
	"use strict";

	return BaseController.extend("org.sapux.int.controller.Monitor", {

		formatter: formatter,

        onInit: function () {

			this.oViewStateModel = new JSONModel({
				busy: true
			});
			this.getView().setModel(this.oViewStateModel,"viewState");

			var oGraph,
				oModel = new JSONModel("model/landscape.json");

			this.getView().setModel(oModel);
			this.setUpOrientationSelect();

			oGraph = this.byId("graph");
			oGraph.setLayoutAlgorithm(new SwimLaneChainLayout());

			// load resource tree depending on liveMode
			this.oResourceTreeModel = new JSONModel();
			this.oTreeTable = this.byId("resourceTreeTable");
			this.getView().setModel(this.oResourceTreeModel,"resourceTree");

			// list to nodes change event so to update columns
			const fnResourceTreeLoaded = function() {
				const aColumns = this.oTreeTable.getColumns();
				// remove existing columns
				for (let i = aColumns.length-1; i>2; i--) {
					this.oTreeTable.removeColumn(i);
				}	
				// add new columns
				const aNodes = this.oResourceTreeModel.getProperty("/value/nodes");
				for (const node of aNodes) {
					let column = new Column({
						label: new Label({text: node.name}),
						template: new Text({text: `{resourceTree>v${node.idx}}`, wrapping: false}),
						width: "5em"
					});
					this.oTreeTable.addColumn(column);
				}
				this.setBusy(false);
			}.bind(this);
			this.oResourceTreeModel.attachRequestCompleted(fnResourceTreeLoaded);

			// list to appState>/liveMode change event
			const appStateModel = this.getOwnerComponent().getModel("appState");
			appStateModel.bindProperty("/liveMode").attachChange(function(){this.loadResourceTree(false)}.bind(this));

			// now load resource tree, delay a bit otherwise busy indicator wont work on initial load
			setTimeout(function(){this.loadResourceTree(false)}.bind(this),200);
		},

		setBusy(bBusy) {
			this.oViewStateModel.setProperty("/busy",bBusy);
		},

		loadResourceTree(forceRefresh) {
			this.setBusy(true);
			const appStateModel = this.getOwnerComponent().getModel("appState");
			const sResourcePath = appStateModel.getProperty("/liveMode")?`/srv/cas/resources(forceRefresh=${forceRefresh?true:false})`:"model/resources.json";
			this.oResourceTreeModel.loadData(sResourcePath);
		},

		setUpOrientationSelect: function () {
			var oGraph = this.byId("graph"),
				oToolbar = this.byId("graph-toolbar"),
				oOrientation = new Select();
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
			oToolbar.insertContent(oOrientation, 2);
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

		onCollapseSelection: function() {
			this.oTreeTable.collapse(this.oTreeTable.getSelectedIndices());
		},

		onExpandAll: function() {
			this.oTreeTable.expandToLevel(3);
		},

		onExpandSelection: function() {
			this.oTreeTable.expand(this.oTreeTable.getSelectedIndices());
		},

		onGraphSelectionChange: function(event) {
			console.log("graph selection change: "+event);
		}
	});

});
