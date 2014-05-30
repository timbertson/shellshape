/// <reference path="common.ts" />
/// <reference path="logging.ts" />
/// <reference path="tiling.ts" />
module MutterWindow {

var Main = imports.ui.main;
var Lang = imports.lang;
var Meta = imports.gi.Meta;
var Shell = imports.gi.Shell;

export class Window implements Tiling.Window, SignalOwner {
	meta_window: any
	ext: any
	log: Logger
	tile_preference: any
	bound_signals = []

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

	static GetId(w:MetaWindow) {
		if(!w || !w.get_stable_sequence) {
			Log.getLogger("shellshape.window").error("Non-window object: " + w);
			return null;
		}
		return w.get_stable_sequence();
	}

	constructor(meta_window, ext) {
		this.meta_window = meta_window;
		this.ext = ext;
		this.log = Log.getLogger("shellshape.window");
		this.tile_preference = null;
	}

	static get_actor(meta_window:MetaWindow):GObject {
		try {
			// terribly unobvious name for "this MetaWindow's associated MetaWindowActor"
			return meta_window.get_compositor_private();
		} catch (e) {
			// not implemented for some special windows - ignore them
			global.log("WARN: couldn't call get_compositor_private for window " + meta_window, e);
			if(meta_window.get_compositor_private) {
				global.log("But the function exists! aborting...");
				throw(e);
			}
		}
		return null;
	}

	get_actor():GObject {
		return Window.get_actor(this.meta_window);
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
	move_resize(x, y, w, h) {
		this.meta_window.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
		this.meta_window.move_resize_frame(true, x, y, w, h);
	}
	set_tile_preference(new_pref) {
		this.log.debug("window adopting tile preference of " + new_pref + " - " + this);
		this.tile_preference = new_pref;
	}
	get_title() {
		return this.meta_window.get_title();
	}
	toString() {
		return ("<#Window with MetaWindow: " + this.get_title() + ">");
	}

	// functions for determining whether the window should
	// be tiled by default, or can be tiled at all.
	is_resizeable() {
		return this.meta_window.resizeable;
	}
	window_type() {
		try {
			return this.meta_window['window-type'];
		} catch (e) {
			//TODO: shouldn't be necessary
			this.log.error("Failed to get window type for window " + this.meta_window + ", error was:", e);
			return -1;
		}
	}
	window_class() {
		return this.meta_window.get_wm_class();
	}
	is_shown_on_taskbar() {
		return !this.meta_window.is_skip_taskbar();
	}
	floating_window() {
		//TODO: add check for this.meta_window.below when mutter exposes it as a property;
		return this.meta_window.above;
	}
	on_all_workspaces() {
		return this.meta_window.is_on_all_workspaces();
	}
	should_auto_tile() {
		return this.can_be_tiled() && this.is_resizeable() &&
			!(this.floating_window() || this.on_all_workspaces());
	}
	can_be_tiled() {
		if (this.meta_window.skip_taskbar) {
			// this.log.debug("uninteresting window: " + this);
			return false;
		}
		var window_class = this.window_class();
		var blacklisted = Window.blacklist_classes.indexOf(window_class) != -1;
		if(blacklisted)
		{
			this.log.debug("window class " + window_class + " is blacklisted");
			return false;
		}

		var window_type = this.window_type();
		var result = Window.tileable_window_types.indexOf(window_type) != -1;
		// this.log.debug("window " + this + " with type == " + window_type + " can" + (result ? "" : " NOT") + " be tiled");
		return result;
	}
	id() {
		return Window.GetId(this.meta_window);
	}
	eq(other) {
		var eq = this.id() == other.id();
		if(eq && (this != other)) {
			this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
		}
		return eq;
	}

	// dimensions
	width() { return this._outer_rect().width; }
	height() { return this._outer_rect().height; }
	xpos() { return this._outer_rect().x; }
	ypos() { return this._outer_rect().y; }
	private _outer_rect() { return this.meta_window.get_outer_rect(); }
}
}
