const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
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

// TODO: expose this as a preference if it gets used much
Window.blacklist_classes = [
	'Conky'
];

Window.prototype = {
	_init: function(meta_window, ext) {
		this._windowTracker = Shell.WindowTracker.get_default();
		this.meta_window = meta_window;
		this.ext = ext;
		this.log = Log.getLogger("shellshape.window");
		this.tile_preference = null;
		this.xid = null;
	
		// we could assume has_decorations = false on creation, but that
		// would (very occasionally) be wrong.
		this.has_decorations = undefined;
		this._wants_decorations = undefined;
	}
	,bring_to_front: function() {
		// NOOP (TODO: remove)
	}
	,set_xid: function(id) {
		if (this.xid == null) {
			this.log.debug("assigning X ID " + id + " for " + this);
		} else if (this.xid != id) {
			this.log.warn("X ID changed from " + this.xid + " -> " + id + " for " + this);
		}
		this.xid = id;
	}
	,redo_decorations: function() {
		this.log.debug("redoing decorations as: " + this._wants_decorations);
		this.set_decorations(this._wants_decorations, true);
	}
	,set_decorations: function(decorate, force) {
		if (decorate === undefined) return;
		this._wants_decorations = decorate;
		if (!this.ext.undecorate_tiles) {
			// don't actually undecorate anything
			// (and reinstate decorations if they are missing)
			decorate = true;
		}
		if (this.xid == null) {
			this.log.error("missing X id for " + this + ",  can't call set_decorations( " + decorate + ")");
			return;
		}
		if ((!force) && this.has_decorations === decorate) return;

		this.log.debug("Changing decorations of " + this + " to " + decorate);
		var self = this;

		/*
		xprop code below adapted from mathematicalcoffee's maximus-gnome-shell-extension
		For a description of _MOTIF_WM_HINTS,
		see MwmUtil.h from OpenMotif source (cvs.openmotif.org),
		*/
		var flag;
		if(decorate) {
			flag = '0x1';
		} else {
			flag = this.ext.undecorate_flag;
		}
		var cmd = [
			'xprop', '-id', String(this.xid),
			'-f', '_MOTIF_WM_HINTS', '32c',
			'-set', '_MOTIF_WM_HINTS',
			'0x2, 0x0, ' + flag + ', 0x0, 0x0'];
		this.log.debug("Running: " + cmd.join(' '));
		try {
			// spawn xprop command
			var [success, pid] = GLib.spawn_async(
				null, cmd, null,
				GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
				null
			);
			if (!success) throw new Error("spawn() returned " + success);
			this.has_decorations = decorate;

			// Monkey-patch move_resize to delay action until child_watch returns.
			// This works because only one place in the code is crazy enough to monkey-patch
			// move_resize. Figure out something smarter if we ever do that elsewhere...
			var args = null;
			GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function() {
				self.log.debug("xprop (pid " + pid + ") complete");
				delete self.move_resize; // go back to using move_resize from self.prototype
				if(args != null) {
					self.move_resize.apply(self, args);
				}
			}, null);

			self.move_resize = function move_resize_delay(/* args ... */){
				// if we do move_resize before the `xprop` call is complete,
				// the decoration change will cause us to end up with the
				// wrong dimensions. So we delay until `xprop` is done.
				self.log.debug("delaying move_resize() call");
				args = arguments;
			};
		} catch(e) {
			this.log.error("Failed to run xprop");
			throw e;
		}
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
	,set_tile_preference: function(new_pref) {
		this.log.debug("window adopting tile preference of " + new_pref + " - " + this);
		this.tile_preference = new_pref;
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
	,window_class: function() {
		return this.meta_window.get_wm_class();
	}
	,is_shown_on_taskbar: function() {
		return !this.meta_window.is_skip_taskbar();
	}
	,floating_window: function() {
		//TODO: add check for this.meta_window.below when mutter exposes it as a property;
		return this.meta_window.above;
	}
	,on_all_workspaces: function() {
		return this.meta_window.is_on_all_workspaces();
	}
	,should_auto_tile: function() {
		return this.can_be_tiled() && this.is_resizeable() &&
			!(this.floating_window() || this.on_all_workspaces());
	}
	,can_be_tiled: function() {
		if(!this._windowTracker.is_window_interesting(this.meta_window)) {
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
	,id: function() {
		return Window.GetId(this.meta_window);
	}
	,eq: function(other) {
		let eq = this.id() == other.id();
		if(eq && (this != other)) {
			this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
		}
		return eq;
	}

	// dimensions
	,width: function() { return this._outer_rect().width; }
	,height: function() { return this._outer_rect().height; }
	,xpos: function() { return this._outer_rect().x; }
	,ypos: function() { return this._outer_rect().y; }
	,_outer_rect: function() { return this.meta_window.get_outer_rect(); }
};

Window.GetId = function(w) {
	if(!w || !w.get_stable_sequence) {
		Log.getLogger("shellshape.window").error("Non-window object: " + w);
		return null;
	}
	return w.get_stable_sequence();
}
