const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;

function Window(metaWindow, ext) { this._init(metaWindow, ext); }

Window.prototype = {
	_init: function(metaWindow, ext) {
		this.metaWindow = metaWindow;
		this.ext = ext;
	}
	,bringToFront: function() {
		// NOOP (TODO: remove)
	}
	,is_active: function() {
		return this.ext.currentWindow() === this;
	}
	,activate: function() {
		Main.activateWindow(this.metaWindow);
	}
	,isMinimized: function() {
		return this.metaWindow.minimized;
	}
	,beforeRedraw: function(func) {
		//TODO: idle seems to be the only LaterType that reliably works; but
		// it causes a visual flash. beforeRedraw would be better, but that
		// doesn't seem to be late enough in the layout cycle to move windows around
		// (which is what this hook is used for).
		Meta.later_add(
			Meta.LaterType.IDLE, //when
			func, //func
			null, //data
			null //notify
		)
	}
	,moveToWorkspace: function(newIndex) {
		this.metaWindow.change_workspace_by_index(newIndex, false, global.get_current_time());
	}
	,move_resize: function(x, y, w, h) {
		this.metaWindow.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
		this.metaWindow.move_resize_frame(true, x, y, w, h);
	}
	,get_title: function() {
		return this.metaWindow.get_title();
	}
	,toString: function() {
		return ("<#Window with MetaWindow: " + this.get_title() + ">");
	}
	,width: function() { return this._outer_rect().width; }
	,height: function() { return this._outer_rect().height; }
	,xpos: function() { return this._outer_rect().x; }
	,ypos: function() { return this._outer_rect().y; }
	,_outer_rect: function() { return this.metaWindow.get_outer_rect(); }
};

