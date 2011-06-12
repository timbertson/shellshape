const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
function Workspace() {
	this._init.apply(this, arguments)
}
Workspace.prototype = {
	_init : function(metaWorkspace, layout, ext) {
		var self = this;
		this.autoTile = false;
		this.metaWorkspace = metaWorkspace;
		this.layout = layout;
		this.extension = ext;
		this.metaWorkspace.connect('window-added', Lang.bind(this, this.onWindowCreate));
		this.metaWorkspace.connect('window-removed', Lang.bind(this, this.onWindowRemove));
		this.metaWindows().map(Lang.bind(this, this.onWindowCreate));
	},

	tileAll : function() {
		this.autoTile = !this.autoTile;
		this.log("tileAll - autoTile turned to " + this.autoTile);
		this.metaWindows().map(Lang.bind(this, function(metaWindow) {
			if(this.autoTile) {
				this.layout.tile(this.extension.getWindow(metaWindow));
			} else {
				this.layout.untile(this.extension.getWindow(metaWindow));
			}
		}));
	},

	onWindowCreate: function(workspace, metaWindow) {
		if (this.isNormalWindow(metaWindow)) {
			var win = this.extension.getWindow(metaWindow);
			this.log("onWindowCreate for " + win);
			this.layout.on_window_created(win);
			//TODO: connect signals to layout.on_window_moved and on_window_resized
			// (and disconnect those signals in onWindowRemove)
			// There are 'position-changed' and 'size-changed' signals on a mutter window actor,
			// but the metaWindow doesn't seem to have a reference to its actor.
			let winSignals = [];
			// winSignals.push(metaWindow.actor.connect('position-changed', Lang.bind(this, function() {
			// 	this.layout.on_window_moved(win);
			// })));

			// winSignals.push(metaWindow.actor.connect('size-changed', Lang.bind(this, function() {
			// 	this.layout.on_window_resized(win);
			// })));
			win.workspaceSignals = winSignals;

			if(this.autoTile) {
				win.beforeRedraw(Lang.bind(this, function() { this.layout.tile(win); }));
				this.layout.tile(win);
			}
		}
	},

	log: function(desc) {
		var wins = this.metaWindows();
		log("Workspace#" + desc + " // Workspace id ??? has " + wins.length + " metaWindows: \n" + wins.map(function(w) { return " - " + w; }));
	},

	// activate: function() { this.metaWorkspace.activate(true); },

	onWindowRemove: function(workspace, metaWindow) {
		if (this.isNormalWindow(metaWindow)) {
			var window = this.extension.getWindow(metaWindow);
			this.log("onWindowRemove for " + window);
			if(window.workspaceSignals !== undefined) {
				log("Disconnecting " + window.workspaceSignals.length + " workspace-managed signals from window");
				window.workspaceSignals.map(function(signal) { signal.disconnect(); });
			}
			this.layout.on_window_killed(window);
			this.extension.removeWindow(metaWindow);
		}
	},

	isNormalWindow: function(metaWindow) {
		return metaWindow.get_window_type() == Meta.WindowType.NORMAL;
	},

	metaWindows: function() {
		var wins = this.metaWorkspace.list_windows();
		wins = wins.filter(Lang.bind(this, this.isNormalWindow));
		return wins;
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
		this.maximized = false;
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
	,beforeRedraw: function(func) {
		log("adding func before redraw: " + func);
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
	,maximize: function() {
		let maximize_border = 15;
		this.unmaximize_args = [this.xpos(), this.ypos(), this.width(), this.height()];
		this.move_resize(
				this.ext.screenDimensions.offset_x + maximize_border,
				this.ext.screenDimensions.offset_y + maximize_border,
				this.ext.screenDimensions.width - maximize_border * 2,
				this.ext.screenDimensions.height - maximize_border * 2);
	}
	,moveToWorkspace: function(newIndex) {
		this.metaWindow.change_workspace_by_index(newIndex, false, global.get_current_time());
	}
	,unmaximize: function() {
		this.move_resize.apply(this, this.unmaximize_args);
	}
	,move_resize: function(x, y, w, h) {
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

