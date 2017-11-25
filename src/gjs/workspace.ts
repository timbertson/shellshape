/// <reference path="common.ts" />
/// <reference path="extension_impl.ts" />
/// <reference path="tiling.ts" />
/// <reference path="mutter_window.ts" />
module Workspace {

	var Mainloop = imports.mainloop;
	var Lang = imports.lang;
	var Meta = imports.gi.Meta;
	var WindowProperties = MutterWindow.WindowProperties;

	export interface Change {
		pending: boolean
	}

	interface GrabOpResponder {
		after_grab: Function
		unexpected?: Function
	}

	function _duck_overview<T extends Function>(fn:T):T {
		return <T>function() {
			var _this = this;
			var _args = arguments;
			this.extension.perform_when_overview_is_hidden(function() {
				return fn.apply(_this, _args);
			});
		}
	};

	function _duck_turbulence<T extends Function>(fn:T):T {
		return <T>function() {
			var _this = this;
			var _args = arguments;
			this.turbulence.add_action(function() {
				return fn.apply(_this, _args);
			});
		};
	};

	function _duck_grab_op<T extends Function>(fn:T):T {
		return <T>function() {
			var _this = this;
			var _args = arguments;
			return this._duck_grab_op(function() {
				return fn.apply(_this, _args);
			});
		};
	};

	var move_ops = [Meta.GrabOp.MOVING];
	var resize_ops = [
			Meta.GrabOp.RESIZING_SE,
			Meta.GrabOp.RESIZING_S,
			Meta.GrabOp.RESIZING_SW,
			Meta.GrabOp.RESIZING_N,
			Meta.GrabOp.RESIZING_NE,
			Meta.GrabOp.RESIZING_NW,
			Meta.GrabOp.RESIZING_W,
			Meta.GrabOp.RESIZING_E
	];
	var all_grab_ops = move_ops.concat(resize_ops);


	// TubulentState allows actions to be delayed - applied when the turbulence is
	// over, but ONLY if this instance was not affected ("shaken").
	class TurbulentState {
		log: Logger
		active:boolean
		pending: Function[]
		affected = false
		cleanup: Function // may be null

		constructor() {
			this.active = false;
			this.pending = [];
			this.log = Logging.getLogger("shellshape.workspace.turbulence");
		}
		enter() {
			this.active = true;
			this.affected = false;
		}
		shake() { // is perhaps taking the metaphor too far ;)
			this.affected = true;
		}
		add_action(f:Function) {
			if(this.active) {
				this.pending.push(f);
			} else {
				f();
			}
		}
		leave() {
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

	export class Default {
		static layout = Tiling.FloatingLayout
		static max_autotile:number = null
	}

	export class Workspace implements SignalOwner {
		log: Logger
		layout_state: Tiling.LayoutState
		meta_workspace: MetaWorkspace
		extension: Extension.Ext
		turbulence: any
		screen: any
		active_layout: any // class
		layout: Tiling.BaseLayout
		bound_signals = []
		private description:string // just used for toString(), but needs to be pre-baked
		_do: {(action:Function, desc:string, fail?:boolean):any}

		constructor(meta_workspace:MetaWorkspace, layout_state:Tiling.LayoutState, ext:Extension.Ext) {
			var self = this;
			assert(meta_workspace);
			assert(layout_state);
			assert(ext);
			this.log = Logging.getLogger("shellshape.workspace");
			this.layout_state = layout_state;
			this.meta_workspace = meta_workspace;
			this.extension = ext;
			this._do = ext._do;
			this.description = "<# Workspace at idx " + (meta_workspace.index()) + ": " + meta_workspace + " >";
			this.screen = ext.screen;
			this.set_layout(Default.layout);
			this.enable(true);
			this.turbulence = new TurbulentState();
			this.turbulence.cleanup = Lang.bind(this, this.check_all_windows);
			// add all initial windows
			this.meta_windows().map(function(win) { self.on_window_create(win); });
		}

		destroy() {
			var self:Workspace = this;
			self.disable();
			self.meta_windows().map(Lang.bind(self, function(win) {
				self._on_window_remove(win);
			}));
		}

		enable(initial?:boolean) {
			var self = this;
			Util.connect_and_track(this, this.meta_workspace, 'window-added', function(workspace, win) { self.on_window_create(win);});
			Util.connect_and_track(this, this.meta_workspace, 'window-removed', function(workspace, win) { self.on_window_remove(win);});

			if (!initial) {
				this.log.debug("Enabling " + this);
				this.check_all_windows(true);
			}
		}

		disable() {
			// disable workspace (can be re-enabled)
			var self = this;
			self.log.debug("Disabling " + self);
			Util.disconnect_tracked_signals(self);

			// NOTE: we don't actually untile or remove windows here.
			// They're kept in the current state in case we later re-enable() this
			// workspace object.
			self.layout.restore_original_positions();
			self.layout.each(function(tile:Tiling.TiledWindow) {
				var win = as<MutterWindow.Window>(MutterWindow.Window, tile.window);
				self.disconnect_window_signals(win);
			});
		}

		_reset_layout() {
			this.layout_state = this.layout_state.empty_copy();
			this.set_layout(Default.layout);
		}

		_take_layout_from(other) {
			this.turbulence.shake();
			if(!other) {
				this._reset_layout();
				return;
			}
			var keys = ['layout_state', 'layout', 'active_layout'];
			for(var i=0; i<keys.length; i++) {
				this[keys[i]] = other[keys[i]];
			}
			this.relayout();
		}

		private _relayout() { this.layout.layout(); }
		relayout = _duck_overview(this._relayout);

		// after turbulence, windows may have shuffled. we best make sure we own all windows that we should,
		// and that we don't own any windows that have moved to other workspaces.
		check_all_windows = _duck_grab_op(function(is_resuming?:boolean) {
			var self:Workspace = this;
			var win:MetaWindow;
			var changed = false;
			var expected_meta_windows:MetaWindow[] = self.meta_windows();
			var layout_windows:MutterWindow.Window[] = [];
			var layout_meta_windows:MetaWindow[] = [];

			self.layout.each(function(tile:Tiling.TiledWindow) {
				var win = as<MutterWindow.Window>(MutterWindow.Window, tile.window);
				layout_windows.push(win);
				layout_meta_windows.push(win.meta_window);
			});

			// check for windows in layout but not workspace window list
			for (var i=0; i<layout_meta_windows.length; i++) {
				win = layout_meta_windows[i];
				if(expected_meta_windows.indexOf(win) == -1 || !WindowProperties.can_be_tiled(win)) {
					self.log.debug("removing unexpected window from workspace " + self + ": " + win.get_title());
					self.on_window_remove(win, true);
					changed = true;
				} else {
					if (is_resuming) {
						// reattach all signal handlers
						self.connect_window_signals(layout_windows[i]);
					}
				}
			}

			// check for windows in workspace but not layout
			for (var i=0; i<expected_meta_windows.length; i++) {
				win = expected_meta_windows[i];
				if(layout_meta_windows.indexOf(win) == -1 && WindowProperties.can_be_tiled(win)) {
					changed = true;
					// we add new windows after a minor delay so that removal from the current workspace happens first
					// (as removal will wipe out all attached signals)
					Mainloop.idle_add(function () {
						// self.log.debug("adding missing window to workspace " + self + ": " + win.get_title());
						self.on_window_create(win);
						return false;
					});
				}
			}

			if (is_resuming && !changed) {
				// force a relayout on resume
				// (if changed is true, this will happen after new windows are dealt with)
				self.layout.layout();
			}
		})

		set_layout(cls) {
			if(!cls) throw new Error("invalid layout");
			this.active_layout = cls;
			this.layout = new cls(this.layout_state);
			this.log.debug("laying out according to new layout: " + this.layout);
			this.layout.layout();
		}

		default_layout_changed(old_layout, new_layout) {
			if (this.active_layout === old_layout) {
				this.set_layout(new_layout);
			}
		}

		toString() {
			return this.description;
		}

		_grab_op_signal_handler(change:Change, relevant_grabs, responder:GrabOpResponder) {
			// grab_ops occur continually throughout the course of a move / resize.
			// Unfortunately, there's no grab_op "end" signal. So on the first
			// grab_op we set change.pending, and keep triggering checks
			// (at the next available idle point) until the grab_op is over.
			var _handler = function(idle) {
				return Lang.bind(this, function() {
					var grab_op = global.screen.get_display().get_grab_op();
					if(relevant_grabs.indexOf(grab_op) != -1) {
						//wait for the operation to end...
						if(idle || !change.pending) {
							Mainloop.idle_add(idle_handler);
						}
						change.pending = true;
					} else {
						var change_happened = change.pending;
						// it's critical that this flag be reset before cb() happens, otherwise the
						// callback will (frequently) trigger a stream of feedback events.
						change.pending = false;
						if(grab_op == Meta.GrabOp.NONE) {
							if (change_happened) {
								this.log.debug("change event completed");
								responder.after_grab.call(this);
							} else {
								if(responder.unexpected) {
									responder.unexpected.call(this);
								}
							}
						}
					}
					return false;
				})
			};

			var op_handler = _handler.call(this, false);
			var idle_handler = _handler.call(this, true);
			return op_handler;
		}

		_duck_grab_op(cb:Function) {
			var change = {pending: false};
			var handler = this._grab_op_signal_handler(change, all_grab_ops, {after_grab: cb});
			// fire handler immediately
			handler();
			// if it isn't waiting, call the function immediately
			if (!change.pending) cb.call(this);
			else this.log.debug("ducking grab op...");
		}

		_with_ready_window(meta_window:MetaWindow, cb:VoidFunc) {
			// Trying to act too quickly on a window can cause race
			// conditions and segfaults, e.g. https://github.com/timbertson/shellshape/issues/169

			var self:Workspace = this;
			function attempt(remainingAttempts: number) {
				if (MutterWindow.WindowProperties.is_ready(meta_window)) {
					cb();
				} else {
					if (remainingAttempts === 0) {
						self.log.warn("Valid window unavailable for " + meta_window.get_title());
						return;
					}
					Mainloop.timeout_add(10, function() {
						attempt(remainingAttempts-1);
						return false;
					});
				}
			}
			attempt(50);
		}

		private connect_window_signals(win:MutterWindow.Window) {
			var self:Workspace = this;
			var emitter = win.meta_window;
			var bind_to_window_change = function(event_name, relevant_grabs, cb) {
				// we only care about events *after* at least one relevant grab_op,
				var signal_handler = self._grab_op_signal_handler({pending:false}, relevant_grabs, {
					after_grab: function() {
						if (self.screen.count > 1) {
							self.check_all_windows();
						}
						cb(win);
					},
					unexpected: function() {
						self.on_window_unexpected_change(win)
					},
				});

				Util.connect_and_track(self, emitter, event_name + '-changed', signal_handler);
			};

			bind_to_window_change('position', move_ops,     Lang.bind(self, self.on_window_moved, emitter));
			bind_to_window_change('size',     resize_ops,   Lang.bind(self, self.on_window_resized, emitter));
			Util.connect_and_track(self, win.meta_window, 'notify::minimized', Lang.bind(self, self.on_window_minimize_changed));
		}

		private disconnect_window_signals(win:MutterWindow.Window) {
			this.log.debug("Disconnecting signals from " + win);
			Util.disconnect_tracked_signals(this, win.meta_window);
		}

		on_window_create:{(w:MetaWindow, reason?:string):void} = _duck_turbulence(_duck_overview(function(meta_window:MetaWindow, reason?:string) {
			var self:Workspace = this;
			self._with_ready_window(meta_window, function() {
				var ws = meta_window.get_workspace();
				if(!WindowProperties.can_be_tiled(meta_window)) {
					// self.log.debug("can\'t be tiled");
					return;
				}

				if (!self.is_on_main_screen(meta_window)) {
					// self.log.debug("not on main screen");
					return;
				}

				if (ws !== self.meta_workspace) {
					self.log.info("window `" + meta_window.get_title() + "` moved workspace before it could be added to the current layout");
					return;
				}

				var win = self.extension.get_window(meta_window);

				self.log.debug("on_window_create for " + win);
				var added = self.layout.add(win, self.extension.focus_window);
				if (!added) {
					self.log.debug("window not added to layout (probably a duplicate)");
					return;
				}

				self.connect_window_signals(win);

				var tile_pref = win.tile_preference;
				var should_auto_tile;

				if(tile_pref === null) {
					should_auto_tile = WindowProperties.should_auto_tile(meta_window);
				} else {
					// if the window has a tiling preference (given by a previous user tile/untile action),
					// that overrides the default should_auto_tile logic
					self.log.debug("window has a tile preference, and it is " + String(tile_pref));
					should_auto_tile = tile_pref;
				}
				if(should_auto_tile && self.has_tile_space_left()) {
					self.layout.tile(win);
				}
			});
		}))

		has_tile_space_left() {
			var n = 0;
			this.layout.tiles.each_tiled(function() { n = n + 1; });
			var max = Default.max_autotile;
			this.log.debug("there are " + n + " windows tiled, of maximum " + max);
			return (n < max);
		}

		// These functions are bound to the workspace and not the layout directly, since
		// the layout may change at any moment
		// NOTE: these two get shellshape `Window` objects as their callback argument, *not* MetaWindow
		_on_window_moved(win) { this.layout.on_window_moved(win); }
		_on_window_resized(win) { this.layout.on_window_resized(win); }
		_on_window_unexpected_change(win) {
			var self = this;
			Mainloop.idle_add(function() {
				self.layout.override_external_change(win, false);
				Mainloop.timeout_add_seconds(1, function() {
					self.layout.override_external_change(win, true);
				});
			});
		}
		on_window_moved   = _duck_overview(this._on_window_moved)
		on_window_resized = _duck_overview(this._on_window_resized)
		on_window_unexpected_change = _duck_overview(this._on_window_unexpected_change)

		on_window_minimize_changed(meta_window) {
			this.log.debug("window minimization state changed for window " + meta_window);
			this.layout.layout();
		}

		_on_window_remove(meta_window, force?:boolean) {
			var self:Workspace = this;
			var win = self.extension.get_window(meta_window);

			var removed = self.layout.on_window_killed(win);
			if (removed) {
				self.log.debug("on_window_remove for " + win + " (" + self +")");
				self.disconnect_window_signals(win);
			} else if (force) {
				self.log.warn("Unable to remove window: " + win);
				self.layout.each(function(tile:Tiling.TiledWindow, idx) {
					var tileWindow = <MutterWindow.Window>tile.window;
					if (tileWindow === win) {
						self.log.error("Logical error: Found window match at index: " + idx);
					}
					if (tileWindow.meta_window === meta_window) {
						self.log.error("Logical error: Found meta_window match at index: " + idx);
					}
					// the above code should be impossible to trigger, but it does, so try again for paranoia:
					removed = self.layout.on_window_killed(win);
					if (removed) {
						self.log.error("Removing window the _second_ time worked");
					}
				});
			}
			if (removed) {
				self.extension.remove_window(win);
			}
		}
		on_window_remove:{(w:MetaWindow, force?:boolean):void} = _duck_turbulence(_duck_overview(this._on_window_remove));

		meta_windows():MetaWindow[] {
			var wins = this.meta_workspace.list_windows();
			wins = wins.filter(Lang.bind(this, this.is_on_main_screen));
			// this.log.debug("Windows on " + this + " = [" + wins.join(", ") + "]");
			return wins;
		}

		is_on_main_screen(meta_window:MetaWindow):boolean {
			if (this.screen.count <= 1 || meta_window.get_monitor() == this.screen.idx) {
				return true;
			} else {
				this.log.debug("ignoring window on non-primary monitor");
				return false;
			}
		}
	}
}
