/// <reference path="common.ts" />
/// <reference path="logging.ts" />
/// <reference path="tiling.ts" />
/// <reference path="util.ts" />
module MutterWindow {

	var Main = imports.ui.main;
	var Lang = imports.lang;
	var Meta = imports.gi.Meta;
	var Shell = imports.gi.Shell;

	export class WindowProperties {
		// This seems to be a good set, from trial and error...
		static tileable_window_types = [
			Meta.WindowType.NORMAL,
			Meta.WindowType.DIALOG,
			Meta.WindowType.TOOLBAR,
			Meta.WindowType.UTILITY,
			Meta.WindowType.SPLASHSCREEN
		];

		// TODO: expose this as a preference if it gets used much
		static blacklist_classes = [
			'Conky'
		]

		static id(w:MetaWindow) {
			if(!w || !w.get_stable_sequence) {
				Util.log.error("Non-window object: " + w);
				return null;
			}
			return w.get_stable_sequence();
		}

		private static is_resizeable(w:MetaWindow):boolean {
			return w.resizeable;
		}

		private static window_type(w:MetaWindow):number {
			try {
				return w['window-type'];
			} catch (e) {
				//TODO: shouldn't be necessary
				Util.log.error("Failed to get window type for window " + w + ", error was:", e);
				return -1;
			}
		}

		private static window_class(w:MetaWindow):string {
			return w.get_wm_class();
		}

		private static is_shown_on_taskbar(w:MetaWindow) {
			return !w.is_skip_taskbar();
		}

		private static floating_window(w:MetaWindow):boolean {
			//TODO: add check for w.below when mutter exposes it as a property;
			return w.above;
		}
		
		private static on_all_workspaces(w:MetaWindow):boolean {
			return w.is_on_all_workspaces();
		}
		
		static should_auto_tile(w:MetaWindow):boolean {
			return this.can_be_tiled(w) && this.is_resizeable(w) && !(this.floating_window(w));
		}

		static can_be_tiled(w:MetaWindow):boolean {
			if (w.is_skip_taskbar()) {
				// this.log.debug("uninteresting window: " + this);
				return false;
			}
			if (this.on_all_workspaces(w)) {
				return false;
			}
			var window_class = this.window_class(w);
			var blacklisted = WindowProperties.blacklist_classes.indexOf(window_class) != -1;
			if(blacklisted)
			{
				Util.log.debug("window class " + window_class + " is blacklisted");
				return false;
			}

			var window_type = this.window_type(w);
			var result = this.tileable_window_types.indexOf(window_type) != -1;
			// this.log.debug("window " + this + " with type == " + window_type + " can" + (result ? "" : " NOT") + " be tiled");
			return result;
		}

		static get_actor(w:MetaWindow):GObject {
			try {
				// terribly unobvious name for "this MetaWindow's associated MetaWindowActor"
				return w.get_compositor_private();
			} catch (e) {
				// not implemented for some special windows - ignore them
				Util.log.warn("couldn't call get_compositor_private for window " + w, e);
				if(w.get_compositor_private) {
					Util.log.warn("But the function exists! aborting...");
					throw(e);
				}
			}
			return null;
		}
	}

	export class Window implements Tiling.Window, SignalOwner {
		meta_window: any
		ext: any
		log: Logger
		tile_preference: any
		bound_signals = []

		constructor(meta_window, ext) {
			this.meta_window = meta_window;
			this.ext = ext;
			this.log = Logging.getLogger("shellshape.window");
			this.tile_preference = null;
		}

		id() {
			return WindowProperties.id(this.meta_window);
		}

		bring_to_front() {
			// NOOP (TODO: remove)
		}
		is_active() {
			return this.ext.current_window() === this;
		}
		activate() {
			this._activate();
		}
		private _activate(time?:number) {
			Main.activateWindow(this.meta_window, time);
		}
		is_minimized() {
			return this.meta_window.minimized;
		}
		minimize() {
			this.meta_window.minimize();
		}
		unminimize() {
			this.meta_window.unminimize();
		}
		maximize() {
			this.meta_window.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
		}
		activate_before_redraw(reason) {
			var time = global.get_current_time();
			if (time === 0) {
				this.log.debug("activate_before_redraw() when time==0 (probably during initialization) - disregarding");
				return;
			}

			var self = this;
			//TODO: idle seems to be the only LaterType that reliably works; but
			// it causes a visual flash. before_redraw would be better, but that
			// doesn't seem to be late enough in the layout cycle to move windows around
			// (which is what this hook is used for).
			Meta.later_add(
				Meta.LaterType.IDLE, //when
				function() {
					// self.log.debug("Activating window " + self + " (" + reason + ")");
					self._activate(time);
				},
				null, //data
				null //notify
			);
		}
		move_to_workspace(new_index) {
			this.meta_window.change_workspace_by_index(new_index, false, global.get_current_time());
		}
		move_resize(r:Tiling.Rect) {
			this.meta_window.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
			var pos = r.pos;
			var size = r.size;
			this.meta_window.move_resize_frame(true, pos.x, pos.y, size.x, size.y);
		}
		set_tile_preference(new_pref) {
			if (this.tile_preference === new_pref) {
				this.log.debug("window already had tile preference of " + new_pref);
				return;
			}
			this.log.debug("window adopting tile preference of " + new_pref + " - " + this);
			this.tile_preference = new_pref;
		}
		get_title() {
			return this.meta_window.get_title();
		}
		toString() {
			return ("<#Window with MetaWindow: " + this.get_title() + ">");
		}

		eq(other) {
			var eq = this.id() == other.id();
			if(eq && (this != other)) {
				this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
			}
			return eq;
		}

		// dimensions
		rect():Tiling.Rect {
			var r:any = this.meta_window.get_outer_rect();
			return {
				pos:  { x: r.x, y:r.y },
				size: { x: r.width, y:r.height }
			};
		}

		private get_actor() {
			return WindowProperties.get_actor(this.meta_window);
		}

		// proxy signals through to actor. If we attach signals directly to the actor, it
		// disappears before we can detach them and we leak BoundSignal objects.
		connect(name:string, cb) {
			var actor = this.get_actor();
			return actor.connect.apply(actor, arguments);
		}
		disconnect(sig) {
			var actor = this.get_actor();
			if (!actor) {
				this.log.debug("Can't disconnect signal - actor is destroyed");
				return;
			}
			return actor.disconnect.apply(actor, arguments);
		}
	}
}
