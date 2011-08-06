const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const St = imports.gi.St;
const Log = imports.log4javascript.log4javascript;

function ShellshapeIndicator() {
	this._init.apply(this, arguments);
}



function PopupImageMenuItem() {
	this._init.apply(this, arguments);
};

PopupImageMenuItem.prototype = {
	__proto__: PopupMenu.PopupBaseMenuItem.prototype,

	_init: function (text, iconName, params) {
		PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

		this.label = new St.Label({ text: text });
		this._icon = new St.Icon({
			icon_type: (St.IconType.FULLCOLOR), // TODO: shouldn't be necessary
			style_class: 'popup-menu-icon'
		});
		this.addActor(this._icon, { align: St.Align.START });
		this.addActor(this.label);
		this.setIcon(iconName);
	},

	setIcon: function(name) {
		this._icon.icon_name = name;
	}
};

ShellshapeIndicator.prototype = {
	__proto__: PanelMenu.SystemStatusButton.prototype,
	_init: function() {
		this.log = Log.getLogger("shellshape.indicator");
		PanelMenu.SystemStatusButton.prototype._init.call(this, 'folder', 'Shellshape Layout');

		// create menu
		this.menu_entries = [
			{
				label: 'Floating',
				action: this._untile_all,
				icon: 'window-tile-floating-symbolic'
				// activeText: 'X'
			},
			{
				label: 'Horizontal',
				action: this._tile_all,
				icon: 'window-tile-horizontal-symbolic'
				// activeText: 'Tiled'
			}
			// ,{
			// 	label: 'Vertical',
			// 	action: this._tile_all,
			// 	icon: 'window-tile-vertical-symbolic'
			// }
		];
		this.menu_indexes = {
			floating: 0,
			horizontal: 1
		};

		var items = new PopupMenu.PopupMenuSection();
		for(i in this.menu_entries) {
			let item_props = this.menu_entries[i];
			let item = new PopupImageMenuItem(item_props.label, item_props.icon);
			items.addMenuItem(item);
			item.connect('activate', Lang.bind(this, function() {
				this.log.debug("callback for [" + item_props.label + "] received by " + this);
				this._set_active_item(item_props);
				item_props.action.call(this);
			}));
		}
		this.menu.addMenuItem(items);

		var default_entry = this.menu_entries[0];
		this.box = new St.BoxLayout({});
		this.icon = new St.Icon({
			icon_type: (St.IconType.FULLCOLOR), // TODO: use proper symbolic icons
			icon_name: default_entry.icon,
			style_class: 'system-status-icon'
		});
		this.status_label = new St.Label({
			text: default_entry.label,
			style: "padding-left: 0.5em; min-width:5.5em;" // TODO: externalize style?
		});
		this.box.add_actor(this.icon);
		this.box.add_actor(this.status_label);
		this.actor.set_child(this.box);

		this.meta_workspace = global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
		this._update_indicator()

		global.screen.connect_after('workspace-switched', Lang.bind(this,this._workspaceChanged));
		this.ext.connect('layout-changed', Lang.bind(this, this._update_indicator));
	},

	toString: function() {
		return "<ShellshapeIndicator>";
	},

	_set_active_item: function(item) {
		this.status_label.set_text(item.label);
		this.icon.set_icon_name(item.icon);
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
			item_props = this.menu_entries[this.menu_indexes.horizontal];
		} else {
			item_props = this.menu_entries[this.menu_indexes.floating];
		}
		this._set_active_item(item_props);
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



