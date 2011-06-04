const Main = imports.ui.main;
const Lang = imports.lang;
function Workspace() {
	this._init.apply(this, arguments)
}
Workspace.prototype = {
	_init : function(metaWorkspace, layout, ext) {
		var self = this;
		this.metaWorkspace = metaWorkspace;
		this.layout = layout;
		this.extension = ext;
		this.metaWorkspace.connect('window-added', Lang.bind(this, this.onWindowCreate));
		this.metaWorkspace.connect('window-removed', Lang.bind(this, this.onWindowRemove));
		this.metaWindows().map(Lang.bind(this, this.onWindowCreate));
	},

	onWindowCreate: function(workspace, metaWindow) {
		log("window created: " + metaWindow);
		this.layout.on_window_created(this.extension.getWindow(metaWindow));
	},

	onWindowRemove: function(workspace, metaWindow) {
		log("window removed: " + metaWindow);
		//TODO: segfaults mutter...
		//this.layout.on_window_killed(this.extension.getWindow(metaWindow));
		this.extension.removeWindow(metaWindow);
	},

	metaWindows: function() {
		return this.metaWorkspace.list_windows();
	},

	// _isMyWindow : function (win) {
	// 	return (this.metaWorkspace == null || Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index())) &&
	// 		(!win.get_meta_window() || win.get_meta_window().get_monitor() == this.monitorIndex);
	// },
	_ignore_me: null
}

function Window(metaWindow, ext) { this._init(metaWindow, ext); }
var winCount = 1;
var stack = [];

Window.cycle = function(direction) {
	if(direction == 1) {
		stack[stack.length-1].sendToBack();
	} else {
		stack[0].bringToFront();
	}
};

Window.prototype = {
	_init: function(metaWindow, ext) {
		this.metaWindow = metaWindow;
		this.ext = ext;
		this.maximized = false; // TODO...
	}
	,bringToFront: function() {
		// NOOP
	}
	// ,get_meta_window: function() { return this.metaWindow;}
	,is_active: function() {
		return this.ext.currentWindow() === this;
	}
	,activate: function() {
		Main.activateWindow(this.metaWindow);
	}
	,toggle_maximize: function() {
		if(this.maximized) {
			this.unmaximize();
		} else {
			this.maximize();
		}
		this.maximized = !this.maximized;
	}
	,maximize: function() {
		this.unmaximize_args = [true, this.xpos(), this.ypos(), this.width(), this.height()];
		this.move_resize(true, 10, 10, this.ext.Screen.width - 20, this.ext.Screen.height - 20);
	}
	,unmaximize: function() {
		this.move_resize.apply(this, this.unmaximize_args);
	}
	,move_resize: function(user_action, x, y, w, h) {
		this.metaWindow.resize(user_action, w, h);
		this.metaWindow.move_frame(user_action, x, y);
	}
	,width: function() { return this._outer_rect().width; }
	,height: function() { return this._outer_rect().height; }
	,xpos: function() { return this._outer_rect().x; }
	,ypos: function() { return this._outer_rect().y; }
	,_outer_rect: function() { return this.metaWindow.get_outer_rect(); }
};

