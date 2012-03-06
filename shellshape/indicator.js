const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter
const Log = imports.log4javascript.log4javascript;
const Main = imports.ui.main;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Tiling = Extension.imports.tiling;

let _indicator;

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
	_init: function(ext) {
		this.log = Log.getLogger("shellshape.indicator");
		this.ext = ext;
		PanelMenu.SystemStatusButton.prototype._init.call(this, 'folder', 'Shellshape Layout');

		// create menu
		this.menu_entries = [
			{
				label: 'Floating',
				layout: Tiling.FloatingLayout,
				icon: 'window-tile-floating-symbolic'
			},
			{
				label: 'Horizontal',
				layout: Tiling.HorizontalTiledLayout,
				icon: 'window-tile-horizontal-symbolic'
			},
			{
				label: 'Vertical',
				layout: Tiling.VerticalTiledLayout,
				icon: 'window-tile-vertical-symbolic'
			}
		];

		var items = new PopupMenu.PopupMenuSection();
		for(var i=0; i<this.menu_entries.length; i++) {
			let item_props = this.menu_entries[i];
			let item = new PopupImageMenuItem(item_props.label, item_props.icon);
			items.addMenuItem(item);
			item.connect('activate', Lang.bind(this, function() {
				this.log.debug("callback for [" + item_props.label + "] received by " + this);
				this._set_active_item(item_props);
				this._current_workspace().set_layout(item_props.layout);
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
		this.actor.get_children().forEach(function(c) { c.destroy() });
		this.actor.add_actor(this.box);
		this.actor.connect('scroll-event', Lang.bind(this, this._scroll_event));

		this._workspaceChanged(null, null, global.screen.get_active_workspace_index());

		global.screen.connect_after('workspace-switched', Lang.bind(this,this._workspaceChanged));
		this.ext.connect('layout-changed', Lang.bind(this, this._update_indicator));
	},

	toString: function() {
		return "<ShellshapeIndicator>";
	},

	_scroll_event: function(actor, event) {
		let direction = event.get_scroll_direction();
		let diff = 0;
		if (direction == Clutter.ScrollDirection.DOWN) {
			diff = 1;
		} else if (direction == Clutter.ScrollDirection.UP) {
			diff = -1;
		} else {
			return;
		}

		this._active_item(function(item, idx) {
			let new_item = this.menu_entries[idx + diff];
			if(new_item == null) return;
			this._set_active_item(new_item);
			this._current_workspace().set_layout(new_item.layout);
		});
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

	_active_item: function(cb) {
		// find the active menu item for the current layout on the current workspace
		var layout_cls = this._current_workspace().active_layout;
		for(var i=0; i<this.menu_entries.length; i++) {
			var entry = this.menu_entries[i];
			if(entry.layout == layout_cls) {
				cb.call(this, entry, i);
				break;
			}
		}
	},

	_update_indicator: function() {
		var item_props = null;
		this._active_item(function(item) {
			this._set_active_item(item);
		});
	},

	_current_workspace: function() { return this.ext.current_workspace(); },

};
ShellshapeIndicator.enable = function(ext) {
	_indicator = new ShellshapeIndicator(ext);
	Main.panel.addToStatusArea('shellshape-indicator', _indicator);
};

ShellshapeIndicator.disable = function() {
	_indicator.destroy();
	_indicator = undefined;
};



