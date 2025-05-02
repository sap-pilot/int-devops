sap.ui.define([
	"org/sapux/int/controller/BaseController",
    "sap/ui/model/json/JSONModel",
	"sap/m/Popover",
	"sap/m/ListBase",
	"sap/m/StandardListItem",
	"sap/m/Select",
	"sap/ui/core/Item",
	"sap/suite/ui/commons/networkgraph/layout/SwimLaneChainLayout",
	"org/sapux/int/model/formatter"
], function (BaseController,JSONModel, Popover, ListBase, StandardListItem, Select, Item, SwimLaneChainLayout, formatter) {
	"use strict";

	return BaseController.extend("org.sapux.int.controller.Monitor", {

		formatter: formatter,

        onInit: function () {

			var oGraph,
				oModel = new JSONModel("model/landscape.json");

			this.getView().setModel(oModel);
			this.setUpOrientationSelect();

			oGraph = this.byId("graph");
			oGraph.setLayoutAlgorithm(new SwimLaneChainLayout());

			// load resource tree depending on liveMode
			this.oResourceTreeModel = new JSONModel();
			const viewStateModel = this.getOwnerComponent().getModel("viewState");
			const fnLoadResourceTree = function() {
				const sResourcePath = viewStateModel.getProperty("/liveMode")?"/srv/cas/resources":"model/resources.json";
				this.oResourceTreeModel.loadData(sResourcePath);
			}.bind(this);
			fnLoadResourceTree();
			viewStateModel.bindProperty("/liveMode").attachChange(fnLoadResourceTree);
			this.getView().setModel(this.oResourceTreeModel,"resourceTree");
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
			oOrientation.setSelectedKey(this.getOwnerComponent().getModel("viewState").getProperty("/landscapeOrientation"));
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
			const oTreeTable = this.byId("TreeTableBasic");
			oTreeTable.collapseAll();
		},

		onCollapseSelection: function() {
			const oTreeTable = this.byId("TreeTableBasic");
			oTreeTable.collapse(oTreeTable.getSelectedIndices());
		},

		onExpandAll: function() {
			const oTreeTable = this.byId("TreeTableBasic");
			oTreeTable.expandToLevel(3);
		},

		onExpandSelection: function() {
			const oTreeTable = this.byId("TreeTableBasic");
			oTreeTable.expand(oTreeTable.getSelectedIndices());
		}
	});

});
