const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.log4javascript.log4javascript;

function Window(meta_window, ext) { this._init(meta_window, ext); }

// This seems to be a good set, from trial and error...
Window.tileable_window_types = [
	Meta.WindowType.NORMAL,
	Meta.WindowType.DIALOG,
	Meta.WindowType.TOOLBAR,
	Meta.WindowType.UTILITY,
	Meta.WindowType.SPLASHSCREEN
];

Window.prototype = {
	_init: function(meta_window, ext) {
		this.meta_window = meta_window;
		this.ext = ext;
		this.log = Log.getLogger("shellshape.window");
	}
	,bring_to_front: function() {
		// NOOP (TODO: remove)
	}
	,is_active: function() {
		return this.ext.current_window() === this;
	}
	,activate: function() {
		Main.activateWindow(this.meta_window);
	}
	,is_minimized: function() {
		return this.meta_window.minimized;
	}
	,minimize: function() {
		this.meta_window.minimize();
	}
	,unminimize: function() {
		this.meta_window.unminimize();
	}
	,before_redraw: function(func) {
		//TODO: idle seems to be the only LaterType that reliably works; but
		// it causes a visual flash. before_redraw would be better, but that
		// doesn't seem to be late enough in the layout cycle to move windows around
		// (which is what this hook is used for).
		Meta.later_add(
			Meta.LaterType.IDLE, //when
			func, //func
			null, //data
			null //notify
		)
	}
	,move_to_workspace: function(new_index) {
		this.meta_window.change_workspace_by_index(new_index, false, global.get_current_time());
	}
	,move_resize: function(x, y, w, h) {
		this.meta_window.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
		this.meta_window.move_resize_frame(true, x, y, w, h);
	}
	,get_title: function() {
		return this.meta_window.get_title();
	}
	,toString: function() {
		return ("<#Window with MetaWindow: " + this.get_title() + ">");
	}

	// functions for determining whether the window should
	// be tiled by default, or can be tiled at all.
	,is_resizeable: function() {
		return this.meta_window.resizeable;
	}
	,window_type: function() {
		try {
			return this.meta_window['window-type'];
		} catch (e) {
			//TODO: shouldn't be necessary
			this.log.error("Failed to get window type for window " + this.meta_window + ", error was:", e);
			return -1;
		}
	}
	,is_shown_on_taskbar: function() {
		return !this.meta_window.is_skip_taskbar();
	}
	,floating_window: function() {
		return this.meta_window.above || this.meta_window.below;
	}
	,should_auto_tile: function() {
		return this.can_be_tiled() && this.is_resizeable() && (!this.floating_window());
	}
	,can_be_tiled: function() {
		var window_type = this.window_type();
		var result = Window.tileable_window_types.indexOf(window_type) != -1;
		// this.log.debug("window " + this + " with type == " + window_type + " can" + (result ? "" : " NOT") + " be tiled");
		return result;
	}

	// dimensions
	,width: function() { return this._outer_rect().width; }
	,height: function() { return this._outer_rect().height; }
	,xpos: function() { return this._outer_rect().x; }
	,ypos: function() { return this._outer_rect().y; }
	,_outer_rect: function() { return this.meta_window.get_outer_rect(); }
};

