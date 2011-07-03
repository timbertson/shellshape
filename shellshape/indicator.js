const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const St = imports.gi.St;
const Log = imports.log4javascript.log4javascript;

function ShellshapeIndicator() {
	this._init.apply(this, arguments);
}

ShellshapeIndicator.prototype = {
	__proto__: PanelMenu.SystemStatusButton.prototype,
	_init: function() {
		// TODO: 'folder'?
		this.log = Log.getLogger("shellshape.Indicator");
		PanelMenu.SystemStatusButton.prototype._init.call(this, 'folder', 'Shellshape Layout');

		// create menu
		this.menu_entries = [
			{
				label: 'Floating',
				action: this._untile_all,
				// activeText: 'X'
			},
			{
				label: 'Tiled',
				action: this._tile_all,
				// activeText: 'Tiled'
			}
		];
		this.menu_indexes = {
			floating: 0,
			vertical: 1
		};

		var items = new PopupMenu.PopupMenuSection();
		for(i in this.menu_entries) {
			let item_props = this.menu_entries[i];
			let item = new PopupMenu.PopupMenuItem(item_props.label);
			items.addMenuItem(item);
			item.connect('activate', Lang.bind(this, function() {
				this.log.debug("callback for [" + item_props.label + "] received by " + this);
				this._set_text(item_props.label);
				item_props.action.call(this);
			}));
		}
		this.menu.addMenuItem(items);

		this.status_label = new St.Label({ text: this.menu_entries[0].label });
		this.actor.set_child(this.status_label);
		this.meta_workspace = global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
		this._update_indicator()

		global.screen.connect_after('workspace-switched', Lang.bind(this,this._workspaceChanged));
		this.ext.connect('layout-changed', Lang.bind(this, this._update_indicator));
	},

	toString: function() {
		return "<ShellshapeIndicator>";
	},

	_set_text: function(text) {
		this.status_label.set_text(text);
	},

	_workspaceChanged: function(meta_screen, old_index, new_index) {
		this.meta_workspace = global.screen.get_workspace_by_index(new_index);
		// this.log.debug("indicator saw switch to new workspace: " + this.meta_workspace);
		this._update_indicator();
	},
	_update_indicator: function() {
		//TODO: extend this when we have multiple tiling layouts
		var item_props = null;
		if(this.ext.get_workspace(this.meta_workspace).auto_tile) {
			item_props = this.menu_entries[this.menu_indexes.vertical];
		} else {
			item_props = this.menu_entries[this.menu_indexes.floating];
		}
		this._set_text(item_props.label);
	},

	_tile_all: function() {
		this.ext.current_workspace().tile_all(true);
	},

	_untile_all: function() {
		this.ext.current_workspace().tile_all(false);
	},

};
ShellshapeIndicator.init = function(ext) {
	// return;
	ShellshapeIndicator.prototype.ext = ext;
	Panel.STANDARD_TRAY_ICON_ORDER.unshift('shellshape-indicator');
	Panel.STANDARD_TRAY_ICON_SHELL_IMPLEMENTATION['shellshape-indicator'] = ShellshapeIndicator;
};



