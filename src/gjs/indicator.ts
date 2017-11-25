/// <reference path="common.ts" />
module Indicator {
	var Lang: Lang = imports.lang;
	var PanelMenu = imports.ui.panelMenu;
	var PopupMenu = imports.ui.popupMenu;
	var St = imports.gi.St;
	var Clutter = imports.gi.Clutter;
	var Shell = imports.gi.Shell;
	var Main = imports.ui.main;
	var Ext = imports.misc.extensionUtils.getCurrentExtension();
	var Gio = imports.gi.Gio;

	var _indicator;

	// A BIT HACKY: add the shellshape icon directory to the current theme's search path,
	// as this seems to be the only way to get symbolic icons loading properly.
	(function() {
		var theme = imports.gi.Gtk.IconTheme.get_default();
		var icon_dir = Ext.dir.get_child('data').get_child('icons');
		if(icon_dir.query_exists(null)) {
			global.log("adding icon dir: " + icon_dir.get_path());
			theme.append_search_path(icon_dir.get_path());
		} else {
			global.log("no icon dir found at " + icon_dir.get_path() + " - assuming globally installed");
		}
	})();

	class PopupImageMenuItem {
		__proto__: Object
		connect: Function
		disconnect: Function
		private _icon: any
		private actor: any
		private label: any

		constructor(label, icon, params?) {
			this._init.apply(this, arguments);
		}

		_init(text, iconName, params?) {
			PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

			this.label = new St.Label({
				text: text
			});
			this._icon = new St.Icon({
				style_class: 'popup-menu-icon'
			});
			this.actor.add(this._icon, { align: St.Align.START });
			this.actor.add(this.label);
			this.setIcon(iconName);
		}

		setIcon(name) {
			this._icon.icon_name = name;
		}
	};

	PopupImageMenuItem.prototype.__proto__ = PopupMenu.PopupBaseMenuItem.prototype;


	interface MenuEntry {
		label:string
		layout:any
		icon: string
	}

	export class ShellshapeIndicator {
		__proto__: Object
		private ext: Extension.Ext
		private log: Logger
		private menu_entries: MenuEntry[]
		private menu: any
		private icon: any
		private actor: any
		private destroy:{():void}
		bound_signals = []

		static enable(ext) {
			if(!_indicator) {
				_indicator = new ShellshapeIndicator(ext);
				Main.panel.addToStatusArea('shellshape-indicator', _indicator);
			}
		}

		static disable() {
			if(_indicator) {
				_indicator.disable();
			}
		}

		constructor(ext:Extension.Ext) {
			this._init.apply(this, arguments);
		}

		_init(ext) {
			var self = this;
			this.log = Logging.getLogger("shellshape.indicator");
			this.ext = ext;
			PanelMenu.Button.prototype._init.call(this,
				0.0, // menuAlignment
				'Shellshape Layout', // nameText
				false // dontCreateMenu (so false means doCreateMenu)
			);

			// create menu
			this.menu_entries = [
				{
					label: 'Floating',
					layout: Layout.FloatingLayout,
					icon: 'window-tile-floating-symbolic'
				},
				{
					label: 'Vertical',
					layout: Layout.VerticalTiledLayout,
					icon: 'window-tile-vertical-symbolic'
				},
				{
					label: 'Horizontal',
					layout: Layout.HorizontalTiledLayout,
					icon: 'window-tile-horizontal-symbolic'
				},
				{
					label: 'Full Screen',
					layout: Layout.FullScreenLayout,
					icon: 'window-tile-full-symbolic'
				}
			];

			var items = new PopupMenu.PopupMenuSection();

			(function() {
				for(var i=0; i<self.menu_entries.length; i++) {
					(function(item_props) { // workaround for lack of `let` in typescript
						var item = new PopupImageMenuItem(item_props.label, item_props.icon);
						items.addMenuItem(item);
						item.connect('activate', function() {
							self.log.debug("callback for [" + item_props.label + "] received by " + self);
							self._set_active_item(item_props);
							self._current_workspace().set_layout(item_props.layout);
						});
					})(self.menu_entries[i]);
				}
			})();

			items.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

			(function() {
				var item = new PopupMenu.PopupMenuItem("Shellshape Settings");
				item.connect('activate', function() {
					var uuid = "shellshape@gfxmonk.net";
					var appSys = Shell.AppSystem.get_default();
					var app = appSys.lookup_app('gnome-shell-extension-prefs.desktop');
					var info = app.get_app_info();
					var timestamp = global.display.get_current_time_roundtrip();
					info.launch_uris(['extension:///' + uuid],
					                 global.create_app_launch_context(timestamp, -1));
				});
				items.addMenuItem(item);
			})();

			this.menu.addMenuItem(items);

			var default_entry = this.menu_entries[0];
			this.icon = new St.Icon({
				icon_name: default_entry.icon,
				style_class: 'system-status-icon'
			});
			this.actor.get_children().forEach(function(c) { c.destroy() });
			this.actor.add_actor(this.icon);
			this.actor.connect('scroll-event', Lang.bind(this, this._scroll_event));

			this._workspaceChanged(null, null, global.screen.get_active_workspace_index());

			Util.connect_and_track(this,
				global.screen,
				'workspace-switched',
				Lang.bind(this,this._workspaceChanged),
				true // use connect-after
			);

			Util.connect_and_track(this, this.ext, 'layout-changed',
				Lang.bind(this,this._update_indicator));
		}

		disable() {
			Util.disconnect_tracked_signals(this);
			assert(_indicator === this);
			this.destroy();
			_indicator = null;
		}

		toString() {
			return "<ShellshapeIndicator>";
		}

		private _scroll_event(actor, event) {
			var self = this;
			var direction = event.get_scroll_direction();
			var diff = 0;
			if (direction == Clutter.ScrollDirection.DOWN) {
				diff = 1;
			} else if (direction == Clutter.ScrollDirection.UP) {
				diff = -1;
			} else {
				return;
			}

			this._active_item(function(item, idx) {
				var new_item = self.menu_entries[idx + diff];
				if(new_item == null) return;
				self._set_active_item(new_item);
				self._current_workspace().set_layout(new_item.layout);
			});
		}

		private _set_active_item(item) {
			this.icon.set_icon_name(item.icon);
		}

		private _workspaceChanged(meta_screen, old_index, new_index) {
			this._update_indicator();
		}

		private _active_item(cb) {
			// find the active menu item for the current layout on the current workspace
			var layout_cls = this._current_workspace().active_layout;
			for(var i=0; i<this.menu_entries.length; i++) {
				var entry = this.menu_entries[i];
				if(entry.layout == layout_cls) {
					cb.call(this, entry, i);
					break;
				}
			}
		}

		private _update_indicator() {
			var self = this;
			var item_props = null;
			this._active_item(function(item) {
				self._set_active_item(item);
			});
		}

		private _current_workspace() { return this.ext.current_workspace(); }
	}

	ShellshapeIndicator.prototype.__proto__ = PanelMenu.Button.prototype;

}
