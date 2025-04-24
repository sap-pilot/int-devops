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

			this.oResourceTreeModel = new JSONModel("model/resources.json");
			this.getView().setModel(this.oResourceTreeModel,"resourceTree");
		},

		setUpOrientationSelect: function () {
			var oGraph = this.byId("graph"),
				oToolbar = this.byId("graph-toolbar"),
				oOrientation = new Select();

			[
				{key: "LeftRight", text: "Left to right"},
				{key: "RightLeft", text: "Right to left"},
				{key: "TopBottom", text: "Top to bottom"},
				{key: "BottomTop", text: "Bottom to top"}
			].forEach(function (o) {
				oOrientation.addItem(new Item(o));
			});
			oOrientation.setSelectedKey("LeftRight");
			oOrientation.attachChange(function (oEvent) {
				var sKey = oEvent.getParameter("selectedItem").getKey();
				oGraph.setOrientation(sKey);
			});
			oToolbar.insertContent(oOrientation, 2);
		},

		onTreeFilterLiveChange: function() {
			const oTreeFilter = this.byId("treeFilter");
			const sText = oTreeFilter.getValue().toLowerCase();
			if (!this.oOriginTree)
				this.oOriginTree = this.getView().getModel("resourceTree").getData();
			if (!sText) {
				this.getView().getModel("resourceTree").setData(this.oOriginTree);
			} else {
				const oFilteredTree = this.filterTree(this.oOriginTree,node => node.name && node.name.toLowerCase().indexOf(sText) > -1);
				this.getView().getModel("resourceTree").setData(oFilteredTree);
				this.onExpandAll();
			}			
		},

		filterTree: function(tree, condition) {
			return tree
			  .map(node => {
				const children = node.children ? this.filterTree(node.children, condition) : [];
				// If current node matches or has matching children
				if (condition(node) || children.length) {
				  return { ...node, children };
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
