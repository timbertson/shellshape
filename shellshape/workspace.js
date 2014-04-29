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

let _duck_grab_op = function(fn) {
	return function() {
		let _this = this;
		let _args = arguments;
		return this._duck_grab_op(function() {
			return fn.apply(_this, _args);
		});
	};
};

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
let all_grab_ops = move_ops.concat(resize_ops);


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
		if (!meta_workspace) {
			throw new Error("meta_workspace is null");
		}
		this.workspace_idx = this.meta_workspace.index();
		this.extension = ext;
		this.screen = ext.screen;
		this.set_layout(this.default_layout);
		this.extension.connect_and_track(this, this.meta_workspace, 'window-added', Lang.bind(this, this.on_window_create));
		this.extension.connect_and_track(this, this.meta_workspace, 'window-removed', Lang.bind(this, this.on_window_remove));
		this._turbulence = new TurbulentState();
		this._turbulence.cleanup = Lang.bind(this, this.check_all_windows);
		// add all initial windows
		this.meta_windows().map(Lang.bind(this, function(win) { this.on_window_create(null, win); }));
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
	check_all_windows: _duck_grab_op(function() {
		let expected_meta_windows = this.meta_windows();
		let layout_meta_windows = [];
		this.layout.each(function(tile) {
			layout_meta_windows.push(tile.window.meta_window);
		});

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
	}),

	set_layout: function(cls) {
		this.log.debug("Instantiating new layout class");
		this.active_layout = cls;
		this.layout = new cls(this.layout_state);
		this.log.debug("laying out according to new layout");
		this.layout.layout();
	},

	toString: function() {
		return "<# Workspace at idx " + this.workspace_idx + ">";
	},

	_grab_op_signal_handler : function(change, relevant_grabs, cb) {
		// grab_ops occur continually throughout the course of a move / resize.
		// Unfortunately, there's no grab_op "end" signal. So on the first
		// grab_op we set change.pending, and keep triggering checks
		// (at the next available idle point) until the grab_op is over.
		var _handler = function(idle) {
			return Lang.bind(this, function() {
				let grab_op = global.screen.get_display().get_grab_op();
				if(relevant_grabs.indexOf(grab_op) != -1) {
					//wait for the operation to end...
					if(idle || !change.pending) {
						Mainloop.idle_add(idle_handler);
					}
					change.pending = true;
				} else {
					let change_happened = change.pending;
					// it's critical that this flag be reset before cb() happens, otherwise the
					// callback will (frequently) trigger a stream of feedback events.
					change.pending = false;
					if(grab_op == Meta.GrabOp.NONE && change_happened) {
						this.log.debug("change event completed");
						cb.call(this);
					}
				}
				return false;
			})
		};

		var op_handler = _handler.call(this, false);
		var idle_handler = _handler.call(this, true);
		return op_handler;
	},

	_duck_grab_op: function(cb) {
		let change = {};
		let handler = this._grab_op_signal_handler(change, all_grab_ops, cb);
		// fire handler immediately
		handler();
		// if it isn't waiting, call the function immediately
		if (!change.pending) cb.call(this);
		else this.log.debug("ducking grab op...");
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

		if (!this.is_on_main_screen(meta_window)) {
			this.log.debug("not on main"); // NOCOMMIT
			return;
		}

		var win = this.extension.get_window(meta_window);
		if(!win.can_be_tiled()) {
			this.log.debug("can't be tiled"); // NOCOMMIT
			return;
		}

		this.log.debug("on_window_create for " + win);
		var added = this.layout.add(win, this.extension.focus_window);
		if (!added) {
			this.log.debug("window not added to layout (probably a duplicate)");
			return;
		}

		if (win.workspace_signals) {
			this.log.error("win.workspace_signals is already defined");
			this.disconnect_workspace_signals(win);
		}
		win.workspace_signals = [];

		let bind_to_window_change = Lang.bind(this, function(event_name, relevant_grabs, cb) {
			// we only care about events *after* at least one relevant grab_op,
			var self = this;
			let signal_handler = this._grab_op_signal_handler({}, relevant_grabs, function() {
				if (self.screen.count > 1) {
					self.check_all_windows();
				}
				cb(win);
			});
            try{
                win.workspace_signals.push([actor, actor.connect(event_name + '-changed', signal_handler)]);
            } catch (e) {
                win.workspace_signals.push([meta_window,
                    meta_window.connect(event_name + '-changed', signal_handler)]);
            }
		});

		bind_to_window_change('position', move_ops,     Lang.bind(this, this.on_window_moved, win));
		bind_to_window_change('size',     resize_ops,   Lang.bind(this, this.on_window_resized, win));
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

	disconnect_workspace_signals: function(win) {
		if(win.workspace_signals) {
			this.log.debug("Disconnecting " + win.workspace_signals.length + " workspace-managed signals from window");
			win.workspace_signals.map(Lang.bind(this, function(signal) {
				this.log.debug("Signal is " + signal + ", disconnecting from " + signal[0]);
				signal[0].disconnect(signal[1]);
			}));
			delete win.workspace_signals;
		}
	},

	on_window_remove: _duck_turbulence(_duck_overview(function(workspace, meta_window) {
		let win = this.extension.get_window(meta_window);
		this.log.debug("on_window_remove for " + win + " (" + this +")");
		this.disconnect_workspace_signals(meta_window);
		this.layout.on_window_killed(win);
		this.extension.remove_window(win);
	})),

	meta_windows: function() {
		var wins = this.meta_workspace.list_windows();
		wins = wins.filter(Lang.bind(this, this.is_on_main_screen));
		this.log.debug("Windows on " + this + " = [" + wins.join(", ") + "]");
		return wins;
	},

	is_on_main_screen: function(meta_window) {
		if (this.screen.count <= 1 || meta_window.get_monitor() == this.screen.idx) {
			return true;
		} else {
			this.log.debug("ignoring window on non-primary monitor");
			return false;
		}
	}
}
