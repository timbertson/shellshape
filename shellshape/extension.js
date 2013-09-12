// shellshape -- a tiling window manager extension for gnome-shell

const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Tiling = Extension.imports.tiling;
const Window = Extension.imports.mutter_window.Window;
const ShellshapeSettings = Extension.imports.shellshape_settings;
const Workspace = Extension.imports.workspace.Workspace;
const ShellshapeIndicator = Extension.imports.indicator.ShellshapeIndicator;
const Gdk = imports.gi.Gdk;
const Log = Extension.imports.log4javascript.log4javascript;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const KEYBINDING_BASE = 'org.gnome.shell.extensions.net.gfxmonk.shellshape.keybindings';


const LAYOUTS = {
	'floating': Tiling.FloatingLayout,
	'vertical': Tiling.VerticalTiledLayout,
	'horizontal': Tiling.HorizontalTiledLayout,
	'fullscreen': Tiling.FullScreenLayout
};


// Primary 'extension' object.  This is instantiated and enabled by the
// main() function declared at the bottom of this file.
const Ext = function Ext() {
	let self = this;
	self.enabled = false;
	self.log = Log.getLogger("shellshape.extension");
	self.prefs = new ShellshapeSettings.Prefs();
	ShellshapeSettings.initTranslations();

	/* -------------------------------------------------------------
	 *                 Utility functions
	 * ------------------------------------------------------------- */

	// Returns a string representation of the extension.
	self.toString = function() {
		return "<Shellshape Extension>";
	};

	// Safely execute a callback by catching any
	// exceptions and logging the traceback and a caller-provided
	// description of the action.
	self._do = function _do(action, desc, fail) {
		try {
			action();
		} catch (e) {
			self.log.error("ERROR in tiling (" + desc + "): ", e);
			self.log.error(e.stack);
			if(fail) throw e;
			return e;
		}
	};

	// Utility function over GObject.connect(). Keeps track
	// of each added connection in `owner._bound_signals`,
	// for later cleanup in disconnect_tracked_signals().
	self.connect_and_track = function(owner, subject, name, cb) {
		if (!owner.hasOwnProperty('_bound_signals')) {
			owner._bound_signals = [];
		}
		owner._bound_signals.push([subject, subject.connect(name, cb)]);
	};


	/* -------------------------------------------------------------
	 *           window / workspace object management
	 * ------------------------------------------------------------- */

	// Given a `proxy GIName:Meta.Workspace`, return a corresponding
	// shellshape Workspace (as defined in shellshape/workspace.js).
	// These are cached in the self.workspaces object and dynamically
	// created by this method if not already cached.
	self.get_workspace = function get_workspace(meta_workspace) {
		let workspace = self.workspaces[meta_workspace];

		// If this workspace hasn't been encountered before...
		if(typeof(workspace) == "undefined") {

			// Build a new LayoutState object using our 'bounds' attr.

			// TODO -- the bounds attribute is derived from the size
			// of the 'screen' and 'monitor' during the .enable() method.
			// That code overlooks the possibility of two monitors, so
			// any attempt at two monitors may have to be taken up here
			// as well.

			var state = new Tiling.LayoutState(self.bounds);

			// Using the new state object and the passed-in
			// gnome-shell meta workspace, both create a new
			// shellshape workspace and save it to the
			// self.workspaces cache.
			workspace = self.workspaces[meta_workspace] = new Workspace(meta_workspace, state, self);
		}
		return workspace;
	};

	// Remove a workspace from the extension's cache.  Disable it first.
	self.remove_workspace = function(meta_workspace) {
		self.log.debug("disabling workspace...");
		var ws = self.workspaces[meta_workspace];
		if(ws != null) {
			self._do(function() {ws._disable();}, 'disable workspace');
			delete self.workspaces[meta_workspace];
		}
	};

	// Much the same as .get_workspace(...) above.  Given a gome-shell
	// meta window, return a shellshape Window object and cache the result.
	self.get_window = function get_window(meta_window, create_if_necessary) {
		if(typeof(create_if_necessary) == 'undefined') {
			create_if_necessary = true;
		}
		if(!meta_window) {
			// self.log.debug("bad window: " + meta_window);
			return null;
		}
		var id = Window.GetId(meta_window);
		if(id == null) return null;
		var win = self.windows[id];
		if(typeof(win) == "undefined" && create_if_necessary) {
			win = self.windows[id] = new Window(meta_window, self);
		} else {
			// if window is scheduled for GC, stop that:
			self.mark_window_as_active(win);
		}
		return win;
	};

	// Remove a window from the extension's cache.
	// this doesn't happen immediately, but only on the next "GC"
	// gc happens whenever the overview window is closed, or
	// dead_windows grows larger than 20 items
	self.remove_window = function(win) {
		let meta_window = win.meta_window;
		let id = Window.GetId(meta_window);
		self.dead_windows.push(win);
		if(self.dead_windows.length > 20) {
			self.gc_windows();
		}
	};

	self.mark_window_as_active = function(win) {
		let idx = self.dead_windows.indexOf(win);
		if(idx != -1) {
			self.dead_windows.splice(idx, 1);
		}
	};

	// garbage collect windows that have been marked as "dead"
	// (and haven't been revived since then).
	self.gc_windows = function(win) {
		if(self.dead_windows.length > 0) {
			self.log.info("Garbage collecting " + self.dead_windows.length + " windows");
		}
		for(let i=0; i<self.dead_windows.length; i++) {
			let win = self.dead_windows[i];
			delete self.windows[Window.GetId(win.meta_window)];
		}
		self.dead_windows = [];
	};

	// Returns a Workspace (shellshape/workspace.js) representing the
	// current workspace.
	self.current_workspace = function current_workspace() {
		return self.get_workspace(self.current_meta_workspace());
	};

	// Return a gnome-shell meta-workspace representing the current workspace.
	self.current_meta_workspace = function current_meta_workspace() {
		return global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
	};

	// Returns the Layout (shellshape/tiling.js,coffee) tied to the current
	// workspace.
	self.current_layout = function current_layout() {
		return self.get_workspace(self.current_meta_workspace()).layout;
	};

	// Returns the gnome-shell meta-display that is currently active.
	self.current_display = function current_display() {
		return global.screen.get_display();
	};

	// Returns the shellshape Window corresponding with the currently
	// focused-on window.
	self.current_window = function current_window() {
		return self.get_window(self.current_display()['focus-window']);
	};

	// Changes the current workspace by +1 or -1.  If provided with a
	// window, then that window is moved to the destination workspace.
	// Called directly upon keypress.  Bound in _init_keybindings().
	self.switch_workspace = function switch_workspace(offset, window) {
		let activate_index = global.screen.get_active_workspace_index()
		let new_index = activate_index + offset;
		if(new_index < 0 || new_index >= global.screen.get_n_workspaces()) {
			self.log.debug("No such workspace; ignoring");
			return;
		}

		let next_workspace = global.screen.get_workspace_by_index(new_index);
		if(window !== undefined) {
			window.move_to_workspace(new_index);
			next_workspace.activate_with_focus(window.meta_window, global.get_current_time())
		} else {
			next_workspace.activate(global.get_current_time());
		}
	};

	/* -------------------------------------------------------------
	 *   OVERVIEW ducking, and dealing with changes in workspaces
	 *          and windows from within the overview mode.
	 * ------------------------------------------------------------- */

	self._init_overview = function _init_overview() {
		self._pending_actions = [];
		self.connect_and_track(self, Main.overview, 'hiding', function() {
			if(self._pending_actions.length > 0) {
				self.log.debug("Overview hiding - performing " + self._pending_actions.length + " pending actions");
				for(var i=0; i<self._pending_actions.length; i++) {
					self._do(self._pending_actions[i], "pending action " + i);
				}
				self._pending_actions = [];
			}
			self.gc_windows();
		});
	};

	// Pretty messy stuff: The overview workspace thumbnail area inserts a new workspace
	// by simply moving everything one workspace up and leaving a hole where the new workspace
	// is supposed to go. This means that our Shellshape.Workspace objects (keyed by
	// meta_workspace object) are now attached to the wrong meta_workspace.
	//
	// The attachment to workspace object is not itself a problem, but we need to move
	// all the user-facing details (layout and tile state) in the same way that the
	// overview moves the windows.
	//
	// Note that this function is executed once at constructionn time, not during init()
	// (and is never unbound). It doesn't *do* anything while the extension is inactive,
	// but there's no correct way to undo a monkey-patching if other extensions also
	// monkey-patched the same function.
	(function() {
		return; // NOTE: DISABLED until bugs are ironed out.
		let src = imports.ui.workspaceThumbnail.ThumbnailsBox.prototype;
		let orig = src.acceptDrop;
		let ws_by_index = function(i) { return self.get_workspace(self.screen.get_workspace_by_index(i)); }
		let replace = function(old_idx, new_idx) {
			self.log.debug("copying layout from workspace[" + old_idx + "] to workspace[" + new_idx + "]");
			if(old_idx == new_idx) return;
			ws_by_index(new_idx)._take_layout_from(ws_by_index(old_idx));
		};
		let map_ws = function(f) {
			for (let i = 0; i < self.screen.get_n_workspaces(); i++) {
				f(ws_by_index(i));
			}
		};

		let replacement = function() {
			if(!self.enabled) return orig.apply(this, arguments);

			let _dropPlaceholderPos = this._dropPlaceholderPos;
			map_ws(function(ws) { ws._turbulence.enter(); });
			self.log.debug("acceptDrop start");
			let ret = orig.apply(this, arguments);
			self.log.debug("acceptDrop returned: " + String(ret));
			self.log.debug("_dropPlaceholderPos: " + String(_dropPlaceholderPos));
			if(ret === true && _dropPlaceholderPos != -1) {
				// a new workspace was inserted at _dropPlaceholderPos
				_dropPlaceholderPos = _dropPlaceholderPos + 0; // just in case it's null or something daft.
				self.log.debug("looks like a new workspace was inserted at position " + _dropPlaceholderPos);
				let num_workspaces = self.screen.get_n_workspaces();
				for (var i=num_workspaces - 1; i > _dropPlaceholderPos; i--) {
					replace(i-1, i);
				}
				ws_by_index(_dropPlaceholderPos)._take_layout_from(null);

				// confusing things will happen if we ever get two workspaces referencing the
				// same layout, so make sure it hasn't happened:
				var layouts = [];
				for (var i=0; i<num_workspaces; i++) {
					let layout = ws_by_index(i).layout;
					if(layouts.indexOf(layout) != -1) {
						throw new Error("Aliasing error! two workspaces ended up with the same layout: " + i + " and " + layouts.indexOf(layout));
					}
					layouts.push(layout);
				}
				self.emit('layout-changed');
			};
			self.log.debug("acceptDrop end");
			map_ws(function(ws) { ws._turbulence.leave(); });
			return ret;
		};
		src.acceptDrop = replacement;
	})();

	self.perform_when_overview_is_hidden = function(action) {
		if(Main.overview.visible) {
			self.log.debug("Overview currently visible - delaying action");
			self._pending_actions.push(action);
		} else {
			action();
		}
	};


	/* -------------------------------------------------------------
	 *                          KEYBINDINGS
	 * ------------------------------------------------------------- */

	// Bind keys to callbacks.
	self._init_keybindings = function _init_keybindings() {
		var gsettings = new ShellshapeSettings.Keybindings().settings;

		// Utility method that binds a callback to a named keypress-action.
		function handle(name, func) {
			self._bound_keybindings[name] = true;
			var added;
			var handler = function() { self._do(func, "handler for binding " + name); };
			var flags = Meta.KeyBindingFlags.NONE;
 
			if (Main.wm.addKeybinding) {
				// 3.8+
				added = Main.wm.addKeybinding(
					name,
					gsettings,
					flags,
					Shell.KeyBindingMode.NORMAL | Shell.KeyBindingMode.MESSAGE_TRAY,
					handler);
			} else {
				// pre-3.8
				added = self.current_display().add_keybinding(
					name,
					gsettings,
					flags,
					handler);
			}
			if(!added) {
				throw("failed to add keybinding handler for: " + name);
			}
		}

		self.log.debug("adding keyboard handlers for Shellshape");
		var BORDER_RESIZE_INCREMENT = 0.05;
		var WINDOW_ONLY_RESIZE_INGREMENT = BORDER_RESIZE_INCREMENT * 2;
		handle('tile-current-window',           function() { self.current_layout().tile(self.current_window())});
		handle('untile-current-window',         function() { self.current_layout().untile(self.current_window()); });
		handle('adjust-splits-to-fit',          function() { self.current_layout().adjust_splits_to_fit(self.current_window()); });
		handle('increase-main-window-count',    function() { self.current_layout().add_main_window_count(1); });
		handle('decrease-main-window-count',    function() { self.current_layout().add_main_window_count(-1); });

		handle('next-window',                   function() { self.current_layout().select_cycle(1); });
		handle('prev-window',                   function() { self.current_layout().select_cycle(-1); });

		handle('rotate-current-window',         function() { self.current_layout().cycle(1); });
		handle('rotate-current-window-reverse', function() { self.current_layout().cycle(-1); });

		handle('focus-main-window',             function() { self.current_layout().activate_main_window(); });
		handle('swap-current-window-with-main', function() { self.current_layout().swap_active_with_main(); });

		// layout changers
		handle('set-layout-tiled-vertical',     function() { self.change_layout(Tiling.VerticalTiledLayout); });
		handle('set-layout-tiled-horizontal',   function() { self.change_layout(Tiling.HorizontalTiledLayout); });
		handle('set-layout-floating',           function() { self.change_layout(Tiling.FloatingLayout); });
		handle('set-layout-fullscreen',         function() { self.change_layout(Tiling.FullScreenLayout); });

		// move a window's borders
		// to resize it
		handle('increase-main-split',           function() { self.current_layout().adjust_main_window_area(+BORDER_RESIZE_INCREMENT); });
		handle('decrease-main-split',           function() { self.current_layout().adjust_main_window_area(-BORDER_RESIZE_INCREMENT); });
		handle('increase-minor-split',          function() { self.current_layout().adjust_current_window_size(+BORDER_RESIZE_INCREMENT); });
		handle('decrease-minor-split',          function() { self.current_layout().adjust_current_window_size(-BORDER_RESIZE_INCREMENT); });

		// resize a window without
		// affecting others
		handle('decrease-main-size',            function() { self.current_layout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT, 'x'); });
		handle('increase-main-size',            function() { self.current_layout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT, 'x'); });
		handle('decrease-minor-size',           function() { self.current_layout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT, 'y'); });
		handle('increase-minor-size',           function() { self.current_layout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT, 'y'); });
		handle('decrease-size',                 function() { self.current_layout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT); });
		handle('increase-size',                 function() { self.current_layout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT); });

		handle('switch-workspace-down',         function() { self.switch_workspace(+1); });
		handle('switch-workspace-up',           function() { self.switch_workspace(-1); });
		handle('move-window-workspace-down',    function() { self.switch_workspace(+1, self.current_window()); });
		handle('move-window-workspace-up',      function() { self.switch_workspace(-1, self.current_window()); });
		handle('toggle-maximize',               function() { self.current_layout().toggle_maximize();});
		handle('minimize-window',               function() { self.current_layout().minimize_window();});
		handle('unminimize-last-window',        function() { self.current_layout().unminimize_last_window();});
		self.log.debug("Done adding keyboard handlers for Shellshape");
	};


	/* -------------------------------------------------------------
	 *           workspace / layout changes
	 * ------------------------------------------------------------- */

	// Change the layout of the current workspace.
	self.change_layout = function(cls) {
		self.current_workspace().set_layout(cls);
		// This emits a gobject signal that others can watch.
		// ShellshapeIndicator uses it to update the "current layout" display.
		self.emit('layout-changed');
	};

	// Connect callbacks to all workspaces
	self._init_workspaces = function() {
		self.screen = global.screen;
		function _init_workspace (i) {
			self.log.debug("new workspace at index " + i);
			self.get_workspace(self.screen.get_workspace_by_index(i));
		};

		// TODO - how will this play into multiple monitors
		self.connect_and_track(self, self.screen, 'workspace-added', function(screen, i) { _init_workspace(i); });
		self.connect_and_track(self, self.screen, 'workspace-removed', self.remove_workspace);

		// add existing workspaces
		for (let i = 0; i < self.screen.n_workspaces; i++) {
			_init_workspace(i);
		}

		var display = self.current_display();
		//TODO: need to disconnect and reconnect when old display changes
		//      (when does that happen?)
		self.connect_and_track(self, display, 'notify::focus-window', function(display, meta_window) {
			// DON'T update `focus_window` if this is a window we've never seen before
			// (it's probably new, and we want to know what the *previous* focus_window
			// was in order to place it appropriately)
			var old_focused = self.focus_window;
			var new_focused = self.get_window(display['focus-window'], false);
			if(new_focused) {
				self.focus_window = new_focused;
			}
		});
	};

	/* -------------------------------------------------------------
	 *              PREFERENCE monitoring
	 * ------------------------------------------------------------- */
	self._init_prefs = function() {

		// default layout
		(function() {
			let default_layout = self.prefs.DEFAULT_LAYOUT;
			let update = function() {
				let name = default_layout.get();
				let new_layout = LAYOUTS[name];
				if(new_layout) {
					self.log.debug("updating default layout to " + name);
					Workspace.prototype.default_layout = new_layout;
				} else {
					self.log.error("Unknown layout name: " + name);
				}
			};
			self.connect_and_track(self, default_layout.gsettings, 'changed::' + default_layout.key, update);
			update();
		})();


		// max-autotile
		(function() {
			let pref = self.prefs.MAX_AUTOTILE;
			let update = function() {
				let val = pref.get();
				self.log.debug("setting max-autotile to " + val);
				Workspace.prototype.max_autotile = val;
			};
			self.connect_and_track(self, pref.gsettings, 'changed::' + pref.key, update);
			update();
		})();


		// padding
		(function() {
			let pref = self.prefs.PADDING;
			let update = function() {
				let val = pref.get();
				self.log.debug("setting padding to " + val);
				Tiling.BaseLayout.prototype.padding = val;
				self.current_workspace().relayout();
			};
			self.connect_and_track(self, pref.gsettings, 'changed::' + pref.key, update);
			update();
		})();
		
	};

	/* -------------------------------------------------------------
	 *                   setup / teardown
	 * ------------------------------------------------------------- */

	// Enable ShellshapeIndicator
	self._init_indicator = function() {
		ShellshapeIndicator.enable(self);
	};

	// Resets the runtime state of the extension,
	// basically all of the things that will be
	// repopuplated in enable().
	self._reset_state = function() {
		self.enabled = false;
		// reset stateful variables
		self.workspaces = {};
		self.windows = {};
		self.dead_windows = [];
		self.bounds = {};
		self._bound_keybindings = {};
	};

	var Bounds = function(monitor) {
		this.monitor = monitor;
		this.update();
	};
	Bounds.prototype.update = function()
	{
		let panel_height = Main.panel.actor.height;
		this.pos = {
			x: this.monitor.x,
			y: this.monitor.y + panel_height
		};
		this.size = {
			x: this.monitor.width,
			y: this.monitor.height - panel_height
		};
	};

	// Turn on the extension.  Grabs the screen size to set up boundaries
	// in the process.
	self.enable = function() {
		self.log.info("shellshape enable() called");
		self._reset_state();
		self.enabled = true;
		let screen = self.screen = global.screen;
		//TODO: multiple monitor support
		var monitorIdx = screen.get_primary_monitor();
		self.monitor = screen.get_monitor_geometry(monitorIdx);
		self.bounds = new Bounds(self.monitor);
		self._do(self._init_prefs, "init preference bindings");
		self._do(self._init_keybindings, "init keybindings");
		self._do(self._init_overview, "init overview ducking");
		self._do(self._init_workspaces, "init workspaces");
		self._do(self._init_indicator, "init indicator");
		self.log.info("shellshape enabled");
	};

	// Unbinds keybindings
	// NOTE: remove_keybinding should really take a schema,
	// but they don't yet.
	// see: https://bugzilla.gnome.org/show_bug.cgi?id=666513
	self._unbind_keys = function() {
		var display = self.current_display();
		for (k in self._bound_keybindings) {
			if(!self._bound_keybindings.hasOwnProperty(k)) continue;
			var desc = "unbinding key " + k;
			self._do(function() {
				self.log.debug(desc);
				if (Main.wm.removeKeybinding) {
					Main.wm.removeKeybinding(k);
				} else {
					display.remove_keybinding(k);
				}
			}, desc);
		}
	};

	// Disconnect all tracked signals from the given object (not necessarily `self`)
	// see `connect_and_track()`
	self.disconnect_tracked_signals = function(owner) {
		if(owner._bound_signals == null) return;
		for(var i=0; i<owner._bound_signals.length; i++) {
			var sig = owner._bound_signals[i];
			this._do(function() {
				sig[0].disconnect(sig[1]);
			}, "disconnecting signal " + i + " of " + owner._bound_signals.length + " (from object " + sig[0] + ")");
		}
		delete owner._bound_signals;
	};

	// Disconnects from *all* workspaces.  Disables and removes
	// them from our cache
	self._disconnect_workspaces = function() {
		for (var k in self.workspaces) {
			if (self.workspaces.hasOwnProperty(k)) {
				self.remove_workspace(k);
			}
		}
	};

	// Disable the extension.
	self.disable = function() {
		self.log.info("shellshape disable() called");
		self._do(function() { ShellshapeIndicator.disable();}, "disable indicator");
		self._do(self._disconnect_workspaces, "disable workspaces");
		self._do(self._unbind_keys, "unbind keys");
		self._do(function() { self.disconnect_tracked_signals(self); }, "disconnect signals");
		self._reset_state();
		self.log.info("shellshape disabled");
	};

	// If we got here, then nothing exploded while initializing the extension.
	self.log.info("shellshape initialized!");
};

Signals.addSignalMethods(Ext.prototype);

// initialization
function init() {
	// inject the get_mouse_position function
	Tiling.get_mouse_position = function() {
		let display = Gdk.Display.get_default();
		let device_manager = display.get_device_manager();
		let pointer = device_manager.get_client_pointer();
		let [screen, pointerX, pointerY] = pointer.get_position();
		return {x: pointerX, y: pointerY};
	};

	let ext = new Ext();
	return ext;
}

function main() {
	init().enable();
};
