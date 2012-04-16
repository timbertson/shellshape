// shellshape -- a tiling window manager extension for gnome-shell

const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Tiling = Extension.imports.tiling;
const Window = Extension.imports.mutter_window.Window;
const Workspace = Extension.imports.workspace.Workspace;
const ShellshapeIndicator = Extension.imports.indicator.ShellshapeIndicator;
const Gdk = imports.gi.Gdk;
const Log = imports.log4javascript.log4javascript;
const GLib = imports.gi.GLib;
const KEYBINDING_BASE = 'org.gnome.shell.extensions.net.gfxmonk.shellshape.keybindings';


// Primary 'extension' object.  This is instantiated and enabled by the
// main() function declared at the bottom of this file.
const Ext = function Ext() {
	let self = this;
	self.log = Log.getLogger("shellshape.extension");

	// Utility method that safely executes a callback by catching any
	// exceptions and logging the traceback and a caller-provided
	// description of the action.
	self._do = function _do(action, desc) {
		try {
			action();
		} catch (e) {
			self.log.error("ERROR in tiling (" + desc + "): ", e);
			self.log.error(e.stack);
		}
	};


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
		var win = self.windows[meta_window];
		if(typeof(win) == "undefined" && create_if_necessary) {
			win = self.windows[meta_window] = new Window(meta_window, self);
		}
		return win;
	};

	// Remove a window from the extension's cache.
	self.remove_window = function(meta_window) {
		delete self.windows[meta_window];
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
			next_workspace.activate(true);
		}
	};


	// Utility method that binds a callback to a named keypress-action.
	// Called exclusively from _init_keybindings.
	function handle(name, func) {
		self._bound_keybindings[name] = true;
		var added = self.current_display().add_keybinding(name,
			KEYBINDING_BASE,
			Meta.KeyBindingFlags.NONE,
			function() {
				self._do(func, "handler for binding " + name);
			}
		);
		if(!added) {
			throw("failed to add keybinding handler for: " + name);
		}
	}

	// Bind keys to callbacks.
	self._init_keybindings = function _init_keybindings() {
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
		handle('set-layout-tiled-horizontal',   function() { self.change_layout(Tiling.HorizontalTiledLayout); });
		handle('set-layout-tiled-vertical',     function() { self.change_layout(Tiling.VerticalTiledLayout); });
		handle('set-layout-floating',           function() { self.change_layout(Tiling.FloatingLayout); });

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

	// Change the layout of the current workspace.
	self.change_layout = function(cls) {
		self.current_workspace().set_layout(cls);
		// This emits a gobject signal that others can watch.
		// ShellshapeIndicator uses it to update the "current layout" display.
		self.emit('layout-changed');
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


	// Connect callbacks to all workspaces
	self._init_workspaces = function() {
		self.screen = global.screen;
		function _init_workspace (i) {
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

	// Enable ShellshapeIndicator
	self._init_indicator = function() {
		ShellshapeIndicator.enable(self);
	};

	// Returns a string representation of the extension.
	self.toString = function() {
		return "<Shellshape Extension>";
	};

	// Resets the runtime state of the extension,
	// basically all of the things that will be
	// repopuplated in enable().
	self._reset_state = function() {
		// reset stateful variables
		self.workspaces = {};
		self.windows = {};
		self.bounds = {};
		self._bound_keybindings = {};
	};

	// Turn on the extension.  Grabs the screen size to set up boundaries
	// in the process.
	self.enable = function() {
		self.log.info("shellshape enable() called");
		self._reset_state();
		let screen = self.screen = global.screen;
		//TODO: multiple monitor support
		var monitorIdx = screen.get_primary_monitor();
		self.monitor = screen.get_monitor_geometry(monitorIdx);
		self.bounds.pos = {
			x: self.monitor.x,
			y: self.monitor.y + Main.panel.actor.height,
		};
		self.bounds.size = {
			x: self.monitor.width,
            y: self.monitor.height - Main.panel.actor.height,
		};
		self._do(self._init_keybindings, "init keybindings");
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
				display.remove_keybinding(k);
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

// Initializes logging.
// TODO -- should this be moved to its own .js file?
function _init_logging() {
	let root_logger = Log.getLogger("shellshape");
	let GjsAppender = imports.log4javascript_gjs_appender.GjsAppender;
	let appender = new GjsAppender();
	appender.setLayout(new Log.PatternLayout("%-5p: %m"));
	let shellshape_debug = GLib.getenv("SHELLSHAPE_DEBUG");
	let root_level = Log.Level.INFO;
	root_logger.addAppender(appender);

	if(shellshape_debug) {
		var FileAppender = imports.log4javascript_file_appender.FileAppender;
		let fileAppender = new FileAppender("/tmp/shellshape.log");
		fileAppender.setLayout(new Log.PatternLayout("%d{HH:mm:ss,SSS} %-5p [%c]: %m"));
		root_logger.addAppender(fileAppender);

		if(shellshape_debug == "true" || shellshape_debug == "all" || shellshape_debug == "1") {
			root_level = Log.Level.DEBUG;
			root_logger.info("set log level DEBUG for shellshape.*");
		} else {
			let debug_topics = shellshape_debug.split(",");
			debug_topics.map(function(topic) {
				let log_name = "shellshape." + topic;
				let logger = Log.getLogger(log_name);
				logger.setLevel(Log.Level.DEBUG);
				root_logger.info("set log level DEBUG for " + log_name);
			});
		}
		root_logger.info(" ---- Shellshape starting ---- ");
	}
	root_logger.setLevel(root_level);
}

// initialization
function init() {
	try {
		_init_logging();
	} catch (e) {
		print("ERROR in log initialization: " + e);
	}
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
