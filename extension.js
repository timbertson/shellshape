// shellshape -- a tiling window manager extension for gnome-shell

const Lang = imports.lang;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Extension = imports.ui.extensionSystem.extensions['shellshape@gfxmonk.net'];
const tiling = Extension.tiling;
const real_mutter = Extension.real_mutter;
const Window = real_mutter.Window;
const Workspace = real_mutter.Workspace;
const ShellshapeIndicator = real_mutter.ShellshapeIndicator;
const Gdk = imports.gi.Gdk;

tiling.get_mouse_position = function() {
	let display = Gdk.Display.get_default();
	let deviceManager = display.get_device_manager();
	let pointer = deviceManager.get_client_pointer();
	let [screen, pointerX, pointerY] = pointer.get_position();
	return {x: pointerX, y: pointerY};
};

//TODO: add a panel indicator showing the current layout algorithm

const Ext = function Ext() {
	let self = this;
	self.workspaces = {};
	self.windows = {};
	//TODO: non-primaty monitor!
	self.monitor = global.get_primary_monitor();
	self.screen = global.screen;

	self.screenDimensions = {}
	self.screenDimensions.width = self.monitor.width;
	self.screenDimensions.offset_x = 0;
	self.screenDimensions.offset_y = Main.panel.actor.height;
	self.screenDimensions.height = self.monitor.height - self.screenDimensions.offset_y;

	self._do = function _do(action) {
		try {
			action();
		} catch (e) {
			log("ERROR in tiling: " + e);
			log("err = " + JSON.stringify(e));
		}
	};

	function handle(name, func) {
		Main.wm.setKeybindingHandler('key_win_' + name, function() {
			log("handling trigger " + name);
			self._do(func);
		});
	}

	self.getWorkspace = function getWorkspace(metaWorkspace) {
		let workspace = self.workspaces[metaWorkspace];
		if(typeof(workspace) == "undefined") {
			var layout = new tiling.HorizontalTiledLayout(
					self.screenDimensions.offset_x,
					self.screenDimensions.offset_y,
					self.screenDimensions.width,
					self.screenDimensions.height);
			workspace = self.workspaces[metaWorkspace] = new Workspace(metaWorkspace, layout, self);;
		}
		return workspace;
	};

	self.getWindow = function getWindow(metaWindow) {
		if(!metaWindow) {
			log("bad window: " + metaWindow);
			return null;
		}
		var win = self.windows[metaWindow];
		if(typeof(win) == "undefined") {
			win = self.windows[metaWindow] = new Window(metaWindow, self);
		}
		return win;
	};

	self.currentWorkspace = function currentWorkspace() {
		return self.getWorkspace(self.currentMetaWorkspace());
	};

	self.currentMetaWorkspace = function currentMetaWorkspace() {
		return global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
	};

	self.currentLayout = function currentLayout() {
		return self.getWorkspace(self.currentMetaWorkspace()).layout;
	};

	self.currentDisplay = function currentDisplay() {
		return global.screen.get_display();
	};

	self.currentWindow = function currentWindow() {
		let win = self.getWindow(self.currentDisplay()['focus-window']);
		// log("currently focused window == " + win);
		return win;
	};

	self.switch_workspace = function switch_workspace(offset, window) {
		let activateIndex = global.screen.get_active_workspace_index()
		let newIndex = activateIndex + offset;
		if(newIndex < 0 || newIndex > global.screen.get_n_workspaces()) {
			log("No such workspace; ignoring");
			return;
		}

		let nextWorkspace = global.screen.get_workspace_by_index(newIndex);
		if(window !== undefined) {
			window.moveToWorkspace(newIndex);
			nextWorkspace.activate_with_focus(window.metaWindow, global.get_current_time())
		} else {
			nextWorkspace.activate(true);
		}
	};

	self._init_keybindings = function _init_keybindings() {
		log("adding keyboard handlers for Shellshape");
		var BORDER_RESIZE_INCREMENT = 0.05;
		var WINDOW_ONLY_RESIZE_INGREMENT = BORDER_RESIZE_INCREMENT * 2;
		handle('p',           function() { self.currentLayout().tile(self.currentWindow())});
		handle('y',           function() { self.currentLayout().untile(self.currentWindow()); });
		handle('shift_p',     function() { self.currentLayout().adjust_splits_to_fit(self.currentWindow()); });
		handle('comma',       function() { self.currentLayout().add_main_window_count(1); });
		handle('dot',         function() { self.currentLayout().add_main_window_count(-1); });

		handle('j',           function() { self.currentLayout().select_cycle(1); });
		handle('k',           function() { self.currentLayout().select_cycle(-1); });
		/* (TODO: not yet functional) */ handle('tab',         function() { self.currentLayout().select_cycle(1); });
		/* (TODO: not yet functional) */ handle('shift_tab',   function() { self.currentLayout().select_cycle(-1); });

		handle('shift_j',     function() { self.currentLayout().cycle(1); });
		handle('shift_k',     function() { self.currentLayout().cycle(-1); });

		handle('space',       function() { self.currentLayout().main_window().activate(); });
		handle('shift_space', function() { self.currentLayout().swap_active_with_main(); });

		// layout changers
		handle('d',           function() { self.changeLayout(true); });
		handle('f',           function() { self.changeLayout(false); });

		// move a window's borders to resize it
		handle('h',           function() { self.currentLayout().adjust_main_window_area(-BORDER_RESIZE_INCREMENT); });
		handle('l',           function() { self.currentLayout().adjust_main_window_area(+BORDER_RESIZE_INCREMENT); });
		handle('u',           function() { self.currentLayout().adjust_current_window_size(-BORDER_RESIZE_INCREMENT); });
		handle('i',           function() { self.currentLayout().adjust_current_window_size(+BORDER_RESIZE_INCREMENT); });

		// resize a window without affecting others
		handle('shift_h',     function() { self.currentLayout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT, 'x'); });
		handle('shift_l',     function() { self.currentLayout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT, 'x'); });
		handle('shift_u',     function() { self.currentLayout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT, 'y'); });
		handle('shift_i',     function() { self.currentLayout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT, 'y'); });
		handle('minus',       function() { self.currentLayout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT); });
		handle('plus',        function() { self.currentLayout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT); });

		handle('alt_j',       function() { self.switch_workspace(+1); });
		handle('alt_k',       function() { self.switch_workspace(-1); });
		handle('alt_shift_j', function() { self.switch_workspace(+1, self.currentWindow()); });
		handle('alt_shift_k', function() { self.switch_workspace(-1, self.currentWindow()); });
		handle('z',           function() { self.currentLayout().toggle_maximize();});
		log("Done adding keyboard handlers for Shellshape");
	};

	self.changeLayout = function(doTile) {
		self.currentWorkspace().tileAll(doTile);
		self.emit('layout-changed');
	};
	
	self.removeWorkspace = function(metaWorkspace) {
		delete self.workspaces[metaWorkspace];
		//TODO: clean up windows in workspace? probably shouldn't happen given how GS works
	};

	self.removeWindow = function(metaWindow) {
		delete self.windows[metaWindow];
	};

	self._init_workspaces = function() {
		self.screen = global.screen;
		self.screen.connect('workspace-added', function(screen, workspace) { self.getWorkspace(workspace); });
		self.screen.connect('workspace-removed', self.removeWorkspace);

		// add existing workspaces
		// (yay, iteration!)
		for (let i = 0; i < self.screen.n_workspaces; i++) {
			self.getWorkspace(self.screen.get_workspace_by_index(i));
		}
	};

	self._init_indicator = function() {
		ShellshapeIndicator.init(self);
	};
	self.toString = function() {
		return "<Shellshape Extension>";
	};

	self._do(self._init_keybindings);
	self._do(self._init_workspaces);
	self._do(self._init_indicator);
};

Signals.addSignalMethods(Ext.prototype);

// initialization
function main() {
	log("shellshape initialized!");

	//TODO: move into separate extension
	St.set_slow_down_factor(0.75);

	let ext = new Ext();
}
