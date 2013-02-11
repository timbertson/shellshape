const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.log4javascript.log4javascript;
const Tiling = Extension.imports.tiling;
const ShellshapeSettings = Extension.imports.shellshape_settings;


let _duck_overview = function(fn) {
	return function() {
		var _this = this;
		var _args = arguments;
		this.extension.perform_when_overview_is_hidden(function() {
			return fn.apply(_this, _args);
		});
	}
};

let _duck_turbulence = function(fn) {
	return function() {
		let _this = this;
		let _args = arguments;
		this._turbulence.add_action(function() {
			return fn.apply(_this, _args);
		});
	};
};

// TubulentState allows actions to be delayed - applied when the turbulence is
// over, but ONLY if this instance was not affected ("shaken").
function TurbulentState() {
	this.active = false;
	this.pending = [];
	this.log = Log.getLogger("shellshape.workspace.turbulence");
};
TurbulentState.prototype = {
	enter: function() {
		this.active = true;
		this.affected = false;
	},
	shake: function() { // is perhaps taking the metaphor too far ;)
		this.affected = true;
	},
	add_action: function(f) {
		if(this.active) {
			this.pending.push(f);
		} else {
			f();
		}
	},
	leave: function() {
		if(this.affected) {
			this.log.debug("ignoring " + this.pending.length + " actions due to turbulence");
			this.active = false;
			if(this.cleanup) this.cleanup();
		} else {
			for (var i=0; i<this.pending.length; i++) {
				this.pending[i]();
			}
		}
		this.pending = [];
	}
}

function Workspace() {
	this._init.apply(this, arguments)
}
Workspace.prototype = {
	default_layout: Tiling.FloatingLayout,
	max_autotile: null,

	_init : function(meta_workspace, layout_state, ext) {
		this.log = Log.getLogger("shellshape.workspace");
		this.layout_state = layout_state;
		this.meta_workspace = meta_workspace;
		this.extension = ext;
		this.set_layout(this.default_layout);
		this.extension.connect_and_track(this, this.meta_workspace, 'window-added', Lang.bind(this, this.on_window_create));
		this.extension.connect_and_track(this, this.meta_workspace, 'window-removed', Lang.bind(this, this.on_window_remove));
		this._turbulence = new TurbulentState();
		this._turbulence.cleanup = Lang.bind(this, this._check_all_windows);
		
		// Add all initial windows.
		// We temporarily disable on_windows_changed() so as not to call it once per every window
		this.on_windows_changed = function() {};
		this.meta_windows().map(Lang.bind(this, function(win) { this.on_window_create(null, win); }));
		delete this.on_windows_changed;
		this.on_windows_changed();
	},

	_disable: function() {
		var self = this;
		this.meta_windows().map(Lang.bind(this, function(win) { this.on_window_remove(null, win); }));
		this.extension.disconnect_tracked_signals(this);
		this.meta_workspace = null;
		this.extension = null;
	},

	_reset_layout: function() {
		this.layout_state = this.layout_state.empty_copy();
		this.set_layout(this.default_layout);
	},

	_take_layout_from: function(other) {
		this._turbulence.shake();
		if(!other) {
			this._reset_layout();
			return;
		}
		let keys = ['layout_state', 'layout', 'active_layout'];
		for(let i=0; i<keys.length; i++) {
			this[keys[i]] = other[keys[i]];
		}
		this.relayout();
	},

	relayout: _duck_overview(function() {
		this.layout.layout();
	}),

	// after turbulence, windows may have shuffled. we best make sure we own all windows that we should,
	// and that we don't own any windows that have moved to other workspaces.
	_check_all_windows: function() {
		let expected_meta_windows = this.meta_windows();
		let layout_meta_windows = [];
		this.layout.each(function(tile) {
			layout_meta_windows.push(tile.window.meta_window);
		});
		this.log.debug("workspace " + this + " is checking its window members...");

		// check for windows in layout but not workspace window list
		for (var i=0; i<layout_meta_windows.length; i++) {
			let win = layout_meta_windows[i];
			if(expected_meta_windows.indexOf(win) == -1) {
				this.log.debug("removing unexpected window from workspace " + this + ": " + win.get_title());
				this.on_window_remove(null, win);
			}
		}

		// check for windows in workspace but not layout
		for (var i=0; i<expected_meta_windows.length; i++) {
			let win = expected_meta_windows[i];
			if(layout_meta_windows.indexOf(win) == -1) {
				// we add new windows after a minor delay so that removal from the current workspace happens first
				// (as removal will wipe out all attached signals)
				Mainloop.idle_add(Lang.bind(this, function () {
					this.log.debug("adding missing window to workspace " + this + ": " + win.get_title());
					this.on_window_create(null, win);
					return false;
				}));
			}
		}

		this.log.debug("check complete");
	},

	set_layout: function(cls) {
		this.log.debug("Instantiating new layout class");
		this.active_layout = cls;
		this.layout = new cls(this.layout_state);
		this.log.debug("laying out according to new layout");
		this.layout.layout();
	},

	toString: function() {
		return "<# Workspace at idx " + this.meta_workspace.index() + ">";
	},

	on_window_create: _duck_turbulence(_duck_overview(function(workspace, meta_window) {
		var get_actor = Lang.bind(this, function() {
			try {
				// terribly unobvious name for "this MetaWindow's associated MetaWindowActor"
				return meta_window.get_compositor_private();
			} catch (e) {
				// not implemented for some special windows - ignore them
				this.log.warn("couldn't call get_compositor_private for window " + meta_window, e);
				if(meta_window.get_compositor_private) {
					this.log.error("But the function exists! aborting...");
					throw(e);
				}
			}
			return null;
		});
		let actor = get_actor();
		if (!actor) {
			// Newly-created windows are added to a workspace before
			// the compositor finds out about them...
			Mainloop.idle_add(Lang.bind(this, function () {
				if (get_actor() && meta_window.get_workspace() == this.meta_workspace) {
					this.on_window_create(workspace, meta_window);
				}
				return false;
			}));
			return;
		}

		var win = this.extension.get_window(meta_window);
		if(!win.can_be_tiled()) {
			return;
		}
		this.log.debug("on_window_create for " + win);
		this.layout.add(win, this.extension.focus_window);
		win.workspace_signals = [];

		let bind_to_window_change = Lang.bind(this, function(event_name, relevant_grabs, cb) {
			// we only care about events *after* at least one relevant grab_op,
			// this flag keeps track of that
			let change_pending = false;
			let signal_handler = Lang.bind(this, function() {
				let grab_op = global.screen.get_display().get_grab_op();
				if(relevant_grabs.indexOf(grab_op) != -1) {
					//wait for the operation to end...
					change_pending = true;
					Mainloop.idle_add(signal_handler);
				} else {
					let change_happened = change_pending;
					// it's critical that this flag be reset before cb() happens, otherwise the
					// callback will (frequently) trigger a stream of feedback events.
					change_pending = false;
					if(grab_op == Meta.GrabOp.NONE && change_happened) {
						this.log.debug("change event [" + event_name + "] happened for window " + win);
						cb(win);
					}
				}
				return false;
			});
			win.workspace_signals.push([actor, actor.connect(event_name + '-changed', signal_handler)]);
		});


		let move_ops = [Meta.GrabOp.MOVING];
		let resize_ops = [
				Meta.GrabOp.RESIZING_SE,
				Meta.GrabOp.RESIZING_S,
				Meta.GrabOp.RESIZING_SW,
				Meta.GrabOp.RESIZING_N,
				Meta.GrabOp.RESIZING_NE,
				Meta.GrabOp.RESIZING_NW,
				Meta.GrabOp.RESIZING_W,
				Meta.GrabOp.RESIZING_E
		];
		bind_to_window_change('position', move_ops,     Lang.bind(this, this.on_window_moved));
		bind_to_window_change('size',     resize_ops,   Lang.bind(this, this.on_window_resized));
		win.workspace_signals.push([meta_window, meta_window.connect('notify::minimized', Lang.bind(this, this.on_window_minimize_changed))]);

		let tile_pref = win.tile_preference;
		let should_auto_tile;

		if(tile_pref === null) {
			should_auto_tile = win.should_auto_tile();
		} else {
			// if the window has a tiling preference (given by a previous user tile/untile action),
			// that overrides the default should_auto_tile logic
			this.log.debug("window has a tile preference, and it is " + String(tile_pref));
			should_auto_tile = tile_pref;
		}
		this.on_windows_changed();
		if(should_auto_tile && this.has_tile_space_left()) {
			this.layout.tile(win);
		}
	})),

	has_tile_space_left: function() {
		let n = 0;
		this.layout.tiles.each_tiled(function() { n = n + 1; });
		let max = this.max_autotile;
		this.log.debug("there are " + n + " windows tiled, of maximum " + max);
		return (n < max);
	},

	// These functions are bound to the workspace and not the layout directly, since
	// the layout may change at any moment
	// NOTE: these two get shellshape `Window` objects as their callback argument, *not* MetaWindow
	on_window_moved:   _duck_overview(function(win) { this.layout.on_window_moved(win); }),
	on_window_resized: _duck_overview(function(win) { this.layout.on_window_resized(win); }),

	on_window_minimize_changed: function(meta_window) {
		this.log.debug("window minimization state changed for window " + meta_window);
		this.layout.layout();
	},

	on_window_remove: _duck_turbulence(_duck_overview(function(workspace, meta_window) {
		let window = this.extension.lookup_window(meta_window);
		this.log.debug("on_window_remove for " + window);
		if(window == null) return;
		if(window.workspace_signals !== undefined) {
			this.log.debug("Disconnecting " + window.workspace_signals.length + " workspace-managed signals from window");
			window.workspace_signals.map(Lang.bind(this, function(signal) {
				this.log.debug("Signal is " + signal + ", disconnecting from " + signal[0]);
				signal[0].disconnect(signal[1]);
			}));
		}
		this.layout.on_window_killed(window);
		this.extension.remove_window(window);

		// once this window has *actually* been removed, call
		// on_windows_changed
		Meta.later_add(
			Meta.LaterType.IDLE, //when
			Lang.bind(this, this.on_windows_changed), //func
			null, //data
			null //notify
		)
	})),

	meta_windows: function() {
		var wins = this.meta_workspace.list_windows();
		return wins;
	},

	on_windows_changed: function() {
		if (this.extension.track_xids) {
			this.annotate_xids();
		}
	},

	annotate_xids: function() {
		var self = this;
		// We rely on the fact that wnck and mutter, when
		// executed in the same event loop, should have an
		// identical ordering of windows (by their stack
		// order). We can then assign X ids to mutter IDs,
		// which is used for disabling window decorations.
		
		var xids_missing = false;
		var meta_windows = (function() {
			var wins = self.meta_windows();
			wins = global.display.sort_windows_by_stacking(wins);
			var result = [];

			for (var i=0;i<wins.length; i++) {
				var win = self.extension.lookup_window(wins[i]);
				if (win == null) continue;
				if (win.can_be_tiled()) {
					if(win.xid == null) xids_missing = true;
					result.push(win);
				}
			}
			return result;
		})();
		if (!xids_missing) {
			self.log.debug("no XIDs are missing - skipping annotate_xids()");
			return;
		}

		let Wnck = imports.gi.Wnck;
		var workspace_idx = self.meta_workspace.index();
		var wnck_windows = (function() {
			var result = [];
			var screen = Wnck.Screen.get_default();
			screen.force_update();
			var wins = screen.get_windows_stacked();
			for (var i = 0; i<wins.length; i++) {
				var w = wins[i];
				var wtype = w.get_window_type();
				if (
					wtype != Wnck.WindowType.NORMAL &&
					wtype != Wnck.WindowType.DIALOG &&
					wtype != Wnck.WindowType.UTILITY) continue;
				var ws = w.get_workspace();
				if (ws == null) continue;
				if (ws.get_number() != workspace_idx) continue;

				result.push(w);
			}
			return result;
		})();
		self.log.debug("Found " + wnck_windows.length + " wnck windows");
		if (wnck_windows.length == 0)
		{
			// not initialized yet.. we will try again later
			return;
		}


		if(meta_windows.length < wnck_windows.length) {
			self.log.debug("trimming excess wnck windows");
			// we have an excess of wnck windows. Trim them down:
			var wnck_idx = 0;
			var keep_dims = meta_windows.slice().map(function(w) {
				var rect = w._outer_rect();
				return [rect.x, rect.y, rect.width, rect.height];
			});
			wnck_windows = wnck_windows.filter(function(w) {
				var geom = w.get_geometry();
				for (var j=0; j<keep_dims.length; j++) {
					var target = keep_dims[j];
					if (String(geom) == String(target)) {
						// mark this dimension as used
						// The only false positive we can have with this check is when we get:
						//  - a WnckWindow which should be ignored, that appears below
						//    a relevant window with identical dimesions. In which case,
						//    screw it all...
						keep_dims.splice(j, 1);
						return true;
					}
				}
				self.log.debug("Dropping seemingly useless wnck_xid: " + w.get_xid());
			});
			self.log.debug("after wnck_filter, ended up with " + wnck_windows.length + " wnck windows");
		}

		if (meta_windows.length != wnck_windows.length) {
			self.log.error("Size mismatch between meta_windows (" + meta_windows.length + ") and wnck_windows (" + wnck_windows.length + ") lists. Can't figure out X IDs for " + self);
			//TODO: log get_window_type() as well
			self.log.error("WNCK windows: " + wnck_windows.map(function(w) {return w.get_xid();}).join("\n - "));
			self.log.error("mutter windows: " + meta_windows.join("\n - "));
			return;
		}

		for (var i=0; i<meta_windows.length; i++) {
			var id = wnck_windows[i].get_xid();
			var win = meta_windows[i];
			win.set_xid(id);
		}
	}
}
