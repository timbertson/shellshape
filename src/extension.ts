// shellshape -- a tiling window manager extension for gnome-shell

/// <reference path="common.ts" />
/// <reference path="logging.ts" />
/// <reference path="tiling.ts" />
/// <reference path="indicator.ts" />
/// <reference path="workspace.ts" />
/// <reference path="mutter_window.ts" />
/// <reference path="shellshape_settings.ts" />
/// <reference path="indicator.ts" />
/// <reference path="tiling.ts" />

var Lang: Lang = imports.lang;

module Extension {
	var Main = imports.ui.main;
	var Shell = imports.gi.Shell;
	var St = imports.gi.St;
	var Mainloop = imports.mainloop;
	var Signals = imports.signals;

	var ExtensionUtils = imports.misc.extensionUtils;
	var Extension = ExtensionUtils.getCurrentExtension();
	var Window = MutterWindow.Window;
	var GLib = imports.gi.GLib;
	var Gio = imports.gi.Gio;
	var KEYBINDING_BASE = 'org.gnome.shell.extensions.net.gfxmonk.shellshape.keybindings';


	var LAYOUTS = {
		'floating': Tiling.FloatingLayout,
		'vertical': Tiling.VerticalTiledLayout,
		'horizontal': Tiling.HorizontalTiledLayout,
		'fullscreen': Tiling.FullScreenLayout
	};

	export interface Emitter {
		emit(name:string)
	}

	interface WorkspaceCB {
		(ws:Workspace.Workspace):void
	}

	export class Ext implements SignalOwner, Emitter {
		private enabled: boolean
		private log: Logger
		private prefs: any
		private screen_padding: number
		bound_signals: BoundSignal[] = []
		_do: {(action:Function, desc:string, fail?:boolean):any}
		connect_and_track: {(owner:SignalOwner, subject:GObject, name:string, cb:Function)}
		disconnect_tracked_signals: {(owner:SignalOwner, subject?:GObject)}
		get_workspace:{(ws:MetaWorkspace):Workspace.Workspace}
		private update_workspaces:{(defensive?:boolean)}
		get_workspace_at:{(idx:number):Workspace.Workspace}
		private workspaces: Workspace.Workspace[];
		private bounds: Tiling.Bounds
		get_window: {(meta_window:MetaWindow, create_if_necessary?:boolean)}
		private windows: { [index: string] : MutterWindow.Window; }
		private dead_windows: MutterWindow.Window[]
		private mark_window_as_active:{(win: MutterWindow.Window):void}
		private remove_window:{(win: MutterWindow.Window):void}
		private gc_windows:{():void}
		private current_workspace:{():Workspace.Workspace}
		private current_meta_workspace:{():MetaWorkspace}
		private current_layout:{():Tiling.BaseLayout}
		private on_all_workspaces:{(cb:WorkspaceCB):void}
		private current_display:{():any}
		private current_window:{():MutterWindow.Window}
		private switch_workspace:{(offset:number, window?:MutterWindow.Window)}
		private _init_overview:{():void}
		private _init_keybindings:{():void}
		private _init_workspaces:{():void}
		private _init_prefs:{():void}
		private _init_indicator:{():void}
		private _init_screen:{():void}
		private _unbind_keys:{():void}
		private _disconnect_workspaces:{():void}
		screen:any
		private _reset_state:{():void}
		private _bound_keybindings:{[index: string]:boolean}
		private _pending_actions:Function[] = []
		emit:{(name):void}
		private perform_when_overview_is_hidden:{(action:Function):void}
		private change_layout:{(any)}
		private focus_window:MutterWindow.Window
		enable:{():void}
		disable:{():void}


		constructor() {
			var self:Ext = this;
			self.enabled = false;
			self.log = Logging.getLogger("shellshape.extension");
			self.prefs = new ShellshapeSettings.Prefs();
			ShellshapeSettings.initTranslations();
			self.screen_padding = 0;

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
					self.log.debug("+ start action: " + desc);
					action();
					return null;
				} catch (e) {
					self.log.error("Uncaught error in " + desc + ": " + e + "\n" + e.stack);
					if(fail) throw e;
					return e;
				}
			};

			// Utility function over GObject.connect(). Keeps track
			// of each added connection in `owner.bound_signals`,
			// for later cleanup in disconnect_tracked_signals().
			// Also logs any exceptions that occur.
			self.connect_and_track = function(owner:SignalOwner, subject, name, cb) {
				if (!owner.bound_signals) owner.bound_signals = []; // XXX remove this
				owner.bound_signals.push({
						subject: subject,
						binding: subject.connect(name, function() {
							try {
								return cb.apply(this,arguments);
							} catch(e) {
								self.log.error("Uncaught error in " + name + " signal handler: " + e + "\n" + e.stack);
								throw e;
							}
						})
				});
			};


			/* -------------------------------------------------------------
			*           window / workspace object management
			* ------------------------------------------------------------- */

			// Given a `proxy GIName:Meta.Workspace`, return a corresponding
			// shellshape Workspace (as defined in shellshape/workspace.js).
			self.get_workspace = function get_workspace(meta_workspace:MetaWorkspace):Workspace.Workspace {
				assert(meta_workspace);
				var idx = meta_workspace.index();
				return self.get_workspace_at(meta_workspace.index());
			};

			self.get_workspace_at = function get_workspace_at(idx:number) {
				self.update_workspaces(true);
				var ws = self.workspaces[idx];
				assert(ws);
				return ws;
			};

			// Given a gome-shell meta window, return a shellshape Window object
			// and cache the result. Future calls with the same meta_window will
			// return the same wrapper.
			self.get_window = function get_window(meta_window:MetaWindow, create_if_necessary?:boolean) {
				create_if_necessary = create_if_necessary !== false; // default to true
				if(!meta_window) return null;
				var id = Window.GetId(meta_window);
				if(id == null) {
					self.log.error("window has no ID: " + meta_window);
					return null;
				}
				var win = self.windows[id];
				if(win == null && create_if_necessary) {
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
				var meta_window = win.meta_window;
				var id = Window.GetId(meta_window);
				self.dead_windows.push(win);
				if(self.dead_windows.length > 20) {
					self.gc_windows();
				}
			};

			self.mark_window_as_active = function(win) {
				var idx = self.dead_windows.indexOf(win);
				if(idx != -1) {
					self.dead_windows.splice(idx, 1);
				}
			};

			// garbage collect windows that have been marked as "dead"
			// (and haven't been revived since then).
			self.gc_windows = function() {
				if(self.dead_windows.length > 0) {
					self.log.info("Garbage collecting " + self.dead_windows.length + " windows");
				}
				for(var i=0; i<self.dead_windows.length; i++) {
					var win = self.dead_windows[i];
					delete self.windows[Window.GetId(win.meta_window)];
				}
				self.dead_windows = [];
			};

			// Returns a Workspace (shellshape/workspace.js) representing the
			// current workspace.
			self.current_workspace = function current_workspace() {
				return self.get_workspace_at(global.screen.get_active_workspace_index());
			};

			// Return a gnome-shell meta-workspace representing the current workspace.
			self.current_meta_workspace = function current_meta_workspace() {
				return global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
			};

			// Returns the Layout (shellshape/tiling.js,coffee) tied to the current
			// workspace.
			self.current_layout = function current_layout() {
				return self.current_workspace().layout;
			};

			// Perform an action on each workspace
			self.on_all_workspaces = function(cb) {
				var num_workspaces = global.screen.get_n_workspaces();
				for (var i=0; i< num_workspaces; i++) {
					cb(self.get_workspace_at(i));
				}
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
				var activate_index = global.screen.get_active_workspace_index()
				var new_index = activate_index + offset;
				if(new_index < 0 || new_index >= global.screen.get_n_workspaces()) {
					self.log.debug("No such workspace; ignoring");
					return;
				}

				var next_workspace = global.screen.get_workspace_by_index(new_index);
				if(window !== undefined) {
					window.move_to_workspace(new_index);
					next_workspace.activate_with_focus(window.meta_window, global.get_current_time())
				} else {
					// XXX should we explicitly find the active window on the new workspace?
					next_workspace.activate(global.get_current_time());
				}
			};

			/* -------------------------------------------------------------
			*   OVERVIEW ducking, and dealing with changes in workspaces
			*          and windows from within the overview mode.
			* ------------------------------------------------------------- */

			self._init_overview = function _init_overview() {
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
			// Note that this function is executed once at construction time, not during init()
			// (and is never unbound). It doesn't *do* anything while the extension is inactive,
			// but there's no correct way to undo a monkey-patching if other extensions also
			// monkey-patched the same function.
			(function() {
				return; // NOTE: DISABLED until bugs are ironed out.
				var src = imports.ui.workspaceThumbnail.ThumbnailsBox.prototype;
				var orig = src.acceptDrop;
				var replace = function(old_idx, new_idx) {
					self.log.debug("copying layout from workspace[" + old_idx + "] to workspace[" + new_idx + "]");
					if(old_idx == new_idx) return;
					self.get_workspace_at(new_idx)._take_layout_from(self.get_workspace_at(old_idx));
				};

				var replacement = function() {
					if(!self.enabled) return orig.apply(this, arguments);

					var _dropPlaceholderPos = this._dropPlaceholderPos;
					self.on_all_workspaces(function(ws) { ws.turbulence.enter(); });
					self.log.debug("acceptDrop start");
					var ret = orig.apply(this, arguments);
					self.log.debug("acceptDrop returned: " + String(ret));
					self.log.debug("_dropPlaceholderPos: " + String(_dropPlaceholderPos));
					if(ret === true && _dropPlaceholderPos != -1) {
						// a new workspace was inserted at _dropPlaceholderPos
						_dropPlaceholderPos = _dropPlaceholderPos + 0; // just in case it's null or something daft.
						self.log.debug("looks like a new workspace was inserted at position " + _dropPlaceholderPos);
						var num_workspaces = global.screen.get_n_workspaces();
						for (var i=num_workspaces - 1; i > _dropPlaceholderPos; i--) {
							replace(i-1, i);
						}
						self.get_workspace_at(_dropPlaceholderPos)._take_layout_from(null);

						// confusing things will happen if we ever get two workspaces referencing the
						// same layout, so make sure it hasn't happened:
						var layouts = [];
						for (var i=0; i<num_workspaces; i++) {
							var layout = self.get_workspace_at(i).layout;
							if(layouts.indexOf(layout) != -1) {
								throw new Error("Aliasing error! two workspaces ended up with the same layout: " + i + " and " + layouts.indexOf(layout));
							}
							layouts.push(layout);
						}
						self.emit('layout-changed');
					};
					self.log.debug("acceptDrop end");
					self.on_all_workspaces(function(ws) { ws.turbulence.leave(); });
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
				var Meta = imports.gi.Meta;
				var gsettings = new ShellshapeSettings.Keybindings().settings;

				// Utility method that binds a callback to a named keypress-action.
				function handle(name, func) {
					self._bound_keybindings[name] = true;
					var handler = function() { self._do(func, "handler for binding " + name); };
					var flags = Meta.KeyBindingFlags.NONE;
		
					// API for 3.8+ only
					var added = Main.wm.addKeybinding(
						name,
						gsettings,
						flags,
						Shell.KeyBindingMode.NORMAL | Shell.KeyBindingMode.MESSAGE_TRAY,
						handler);
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

			self.update_workspaces = function(defensive?:boolean) {
				defensive = defensive === true;
				var logm = defensive ? 'error' : 'debug';

				// modified from gnome-shell/js/ui/workspacesView.js
				var old_n = self.workspaces.length;
				var new_n = global.screen.get_n_workspaces();

				if (new_n > old_n) {
					// Assume workspaces are only added at the end
					self.log[logm]("new workspaces at index " + old_n + "-"+new_n);
					for (var w = old_n; w < new_n; w++) {
						var meta_workspace = global.screen.get_workspace_by_index(w);
						
						// TODO -- the bounds attribute is derived from the size
						// of the 'screen' and 'monitor' during the .enable() method.
						// That code overlooks the possibility of two monitors, so
						// any attempt at two monitors may have to be taken up here
						// as well.

						var state = new Tiling.LayoutState(self.bounds);
						self.workspaces[w] = new Workspace.Workspace(meta_workspace, state, self);
					}
				} else if (new_n < old_n) {
					// Assume workspaces are only removed sequentially
					// (e.g. 2,3,4 - not 2,4,7)
					var removedIndex;
					var removedNum = old_n - new_n;
					for (var w = 0; w < old_n; w++) {
						var meta_workspace = global.screen.get_workspace_by_index(w);
						if (self.workspaces[w].meta_workspace != meta_workspace) {
							removedIndex = w;
							break;
						}
					}
					self.log[logm]("removed workspaces at index " + removedIndex + "-"+(removedIndex + removedNum));

					var lostWorkspaces = self.workspaces.splice(removedIndex, removedNum);
					for (var l = 0; l < lostWorkspaces.length; l++) {
						lostWorkspaces[l]._disable();
					}
				}

				// TODO remove this when I get less paranoid that workspaces might
				// unexpectedly change indexes
				for (var i=0; i<new_n; i++) {
					var actualIdx = self.workspaces[i].index();
					if (actualIdx !== i) throw new Error("Workspace expected index " + i + ", but it's " + actualIdx);
				}
			};

			// Connect callbacks to all workspaces
			self._init_workspaces = function() {
				self.connect_and_track(self, global.screen, 'notify::n-workspaces', self.update_workspaces);
				self.update_workspaces();
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
				var initial = true;

				// default layout
				(function() {
					var default_layout = self.prefs.DEFAULT_LAYOUT;
					var update = function() {
						var name = default_layout.get();
						var new_layout = LAYOUTS[name];
						if(new_layout) {
							self.log.debug("updating default layout to " + name);
							if (!initial) {
								var old_layout = Workspace.Default.layout;
								self.on_all_workspaces(function(ws) {
									ws.default_layout_changed(old_layout, new_layout);
								});
							}
							Workspace.Default.layout = new_layout;
						} else {
							self.log.error("Unknown layout name: " + name);
						}
					};
					self.connect_and_track(self, default_layout.gsettings, 'changed::' + default_layout.key, update);
					update();
				})();


				// max-autotile
				(function() {
					var pref = self.prefs.MAX_AUTOTILE;
					var update = function() {
						var val = pref.get();
						self.log.debug("setting max-autotile to " + val);
						Workspace.Default.max_autotile = val;
					};
					self.connect_and_track(self, pref.gsettings, 'changed::' + pref.key, update);
					update();
				})();


				// padding
				(function() {
					var pref = self.prefs.PADDING;
					var update = function() {
						var val = pref.get();
						self.log.debug("setting padding to " + val);
						Tiling.BaseLayout.prototype.padding = val;
						if (!initial) {
							self.current_workspace().relayout();
						}
					};
					self.connect_and_track(self, pref.gsettings, 'changed::' + pref.key, update);
					update();
				})();

				// screen padding
				(function() {
					var pref = self.prefs.SCREEN_PADDING;
					var update = function() {
						var val = pref.get();
						self.log.debug("setting screen padding to " + val);
						// TODO: this is 2* to maintain consistency with inter-window padding (which is applied twice).
						// inter-window padding should be applied only once so that this isn't required.
						self.screen_padding = 2*val;
						if (!initial) {
							self.current_workspace().relayout();
						}
					};
					self.connect_and_track(self, pref.gsettings, 'changed::' + pref.key, update);
					update();
				})();
				
				initial = false;
			};

			/* -------------------------------------------------------------
			*                   setup / teardown
			* ------------------------------------------------------------- */

			// Enable ShellshapeIndicator
			self._init_indicator = function() {
				Indicator.ShellshapeIndicator.enable(self);
			};

			// Resets the runtime state of the extension,
			// basically all of the things that will be
			// repopuplated in enable().
			self._reset_state = function() {
				self.enabled = false;
				// reset stateful variables
				self.workspaces = [];
				self.windows = {};
				self.dead_windows = [];
				self.bounds = null;
				self._bound_keybindings = {};
			};

			var Screen = function() {
				this.bounds = new Bounds();
				this.update();
			};

			Screen.prototype.update = function() {
				this.count = global.screen.get_n_monitors();
				this.idx = global.screen.get_primary_monitor();
				this.bounds.update(global.screen.get_monitor_geometry(this.idx));
			};

			var Bounds = function() { };
			Bounds.prototype.update = function(newMonitor)
			{
				if (newMonitor) this.monitor = newMonitor;
				if (!this.monitor) throw new Error("monitor not yet set");
				var panel_height = Main.panel.actor.height;
				this.pos = {
					x: this.monitor.x + self.screen_padding,
					y: this.monitor.y + panel_height + self.screen_padding
				};
				this.size = {
					x: this.monitor.width - (2 * self.screen_padding),
					y: this.monitor.height - panel_height - (2 * self.screen_padding)
				};
			};

			// Turn on the extension.  Grabs the screen size to set up boundaries
			// in the process.
			self.enable = function() {
				self.log.info("shellshape enable() called");
				self._reset_state();
				self.enabled = true;

				self.screen = new Screen();
				self.bounds = self.screen.bounds;

				self._do(self._init_overview, "init overview ducking");
				self._do(self._init_prefs, "init preference bindings");
				self._do(self._init_keybindings, "init keybindings");
				self._do(self._init_workspaces, "init workspaces");
				self._do(self._init_screen, "init screen");
				self._do(self._init_indicator, "init indicator");
				self.log.info("shellshape enabled");
			};

			self._init_screen = function() {
				var update_monitor = function() {
					self.log.info("monitors changed");
					self.screen.update();
					self.on_all_workspaces(function(ws) {
						ws.check_all_windows();
						ws.relayout();
					});
				};

				var workspace_switched = function(screen, old_idx, new_idx, direction) {
					self.get_workspace_at(new_idx).check_all_windows();
				}

				var update_window_workspace = function(screen, idx, meta_window) {
					if (idx == self.screen.idx) {
						var ws = meta_window.get_workspace();
						if (ws) self.get_workspace(ws).check_all_windows();
						else self.log.info("update_workspace called for a window with no workspace: " + meta_window.get_title());
					}
				};

				// do a full update when monitors changed (dimensions, num_screens, main_screen_idx, relayout)
				self.connect_and_track(self, global.screen, 'monitors-changed', update_monitor);

				// sanity check workspaces when switching to them (TODO: remove this if it never fails)
				self.connect_and_track(self, global.screen, 'workspace-switched', workspace_switched);

				// window-entered-monitor and window-left-monitor seem really twitchy - they
				// can fire a handful of times in a single atomic window placement.
				// So we just use the hint to check window validity, rather than assuming
				// it's actually a new or removed window.
				self.connect_and_track(self, global.screen, 'window-entered-monitor', update_window_workspace);
				self.connect_and_track(self, global.screen, 'window-left-monitor', update_window_workspace);
			};

			// Unbinds keybindings
			// NOTE: remove_keybinding should really take a schema,
			// but they don't yet.
			// see: https://bugzilla.gnome.org/show_bug.cgi?id=666513
			self._unbind_keys = function() {
				var display = self.current_display();
				for (var k in self._bound_keybindings) {
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
			self.disconnect_tracked_signals = function(owner:SignalOwner, subject?:GObject) {
				for(var i=0; i<owner.bound_signals.length; i++) {
					var sig = owner.bound_signals[i];
					if (subject == null || subject === sig.subject) {
						sig.subject.disconnect(sig.binding);
						// delete signal
						owner.bound_signals.splice(i, 1);
						i--;
					}
				}
			};

			// Disconnects from *all* workspaces.  Disables and removes
			// them from our cache
			self._disconnect_workspaces = function() {
				for (var i=self.workspaces.length; i>=0; i--) {
					self.workspaces[i]._disable();
				}
				self.workspaces = [];
			};

			// Disable the extension.
			self.disable = function() {
				self.log.info("shellshape disable() called");
				self._do(function() { Indicator.ShellshapeIndicator.disable();}, "disable indicator");
				self._do(self._disconnect_workspaces, "disable workspaces");
				self._do(self._unbind_keys, "unbind keys");
				self._do(function() { self.disconnect_tracked_signals(self); }, "disconnect signals");
				self._reset_state();
				self.log.info("shellshape disabled");
			};

			// If we got here, then nothing exploded while initializing the extension.
			self.log.info("shellshape initialized!");
		}
	}

	Signals.addSignalMethods(Ext.prototype);
}

// export toplevel symbols
function init() {
	Logging.init(true);
	var Gdk = imports.gi.Gdk;
	// inject the get_mouse_position function
	Tiling.get_mouse_position = function() {
		var display = Gdk.Display.get_default();
		var device_manager = display.get_device_manager();
		var pointer = device_manager.get_client_pointer();
		var _pos = pointer.get_position();
		var _screen   = _pos[0];
		var pointerX = _pos[1];
		var pointerY = _pos[2];
		return {x: pointerX, y: pointerY};
	};

	var ext = new Extension.Ext();
	return ext;
}

function main() {
	init().enable();
};
