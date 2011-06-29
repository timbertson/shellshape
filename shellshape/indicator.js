const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const St = imports.gi.St;

function ShellshapeIndicator() {
	this._init.apply(this, arguments);
}

ShellshapeIndicator.prototype = {
	__proto__: PanelMenu.SystemStatusButton.prototype,
	_init: function() {
		// TODO: 'folder'?
		PanelMenu.SystemStatusButton.prototype._init.call(this, 'folder', 'Shellshape Layout');

		// create menu
		this.menuEntries = [
			{
				label: 'Floating',
				action: this._untileAll,
				// activeText: 'X'
			},
			{
				label: 'Tiled',
				action: this._tileAll,
				// activeText: 'Tiled'
			}
		];
		this.menuIndexes = {
			floating: 0,
			vertical: 1
		};

		var items = new PopupMenu.PopupMenuSection();
		for(i in this.menuEntries) {
			let itemProps = this.menuEntries[i];
			let item = new PopupMenu.PopupMenuItem(itemProps.label);
			items.addMenuItem(item);
			item.connect('activate', Lang.bind(this, function() {
				log("callback for [" + itemProps.label + "] received by " + this);
				this._setText(itemProps.label);
				itemProps.action.call(this);
			}));
		}
		this.menu.addMenuItem(items);

		this.statusLabel = new St.Label({ text: this.menuEntries[0].label });
		this.actor.set_child(this.statusLabel);
		this.metaWorkspace = global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
		this._updateIndicator()

		global.screen.connect_after('workspace-switched', Lang.bind(this,this._workspaceChanged));
		this.ext.connect('layout-changed', Lang.bind(this, this._updateIndicator));
	},

	toString: function() {
		return "<ShellshapeIndicator>";
	},

	_setText: function(text) {
		this.statusLabel.set_text(text);
	},

	_workspaceChanged: function(metaScreen, oldIndex, newIndex) {
		this.metaWorkspace = global.screen.get_workspace_by_index(newIndex);
		// log("indicator saw switch to new workspace: " + this.metaWorkspace);
		this._updateIndicator();
	},
	_updateIndicator: function() {
		//TODO: extend this when we have multiple tiling layouts
		var itemProps = null;
		if(this.ext.getWorkspace(this.metaWorkspace).autoTile) {
			itemProps = this.menuEntries[this.menuIndexes.vertical];
		} else {
			itemProps = this.menuEntries[this.menuIndexes.floating];
		}
		this._setText(itemProps.label);
	},

	_tileAll: function() {
		this.ext.currentWorkspace().tileAll(true);
	},

	_untileAll: function() {
		this.ext.currentWorkspace().tileAll(false);
	},

};
ShellshapeIndicator.init = function(ext) {
	// return;
	log("starting ShellshapeIndicator with ext = "+ ext);
	ShellshapeIndicator.prototype.ext = ext;
	Panel.STANDARD_TRAY_ICON_ORDER.unshift('shellshape-indicator');
	Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['shellshape-indicator'] = ShellshapeIndicator;
};



