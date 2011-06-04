// shellshape -- a tiling window manager extension for gnome-shell

const Lang = imports.lang;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

const Extension = imports.ui.extensionSystem.extensions['shellshape@gfxmonk.net'];
const tiling = Extension.tiling;
const real_mutter = Extension.real_mutter;
const Window = real_mutter.Window;
const Workspace = real_mutter.Workspace;


const Ext = function Ext() {
	let self = this;
	self.workspaces = {};
	self.windows = {};
	//TODO: non-primaty monitor!
	self.monitor = global.get_primary_monitor();
	self.screen = global.screen;
	self.Screen = {width: self.monitor.width, height:self.monitor.height - Main.panel.actor.height};


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
		log("getting workspace for MetaWorkspace: " + metaWorkspace);
		let workspace = self.workspaces[metaWorkspace];
		if(typeof(workspace) == "undefined") {
			log(tiling.HorizontalTiledLayout);
			var layout = new tiling.HorizontalTiledLayout(self.Screen.width, self.Screen.height);
			log("creating new workspace for ws " + metaWorkspace);
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
			log("Creating new window for metaWindow");
			win = self.windows[metaWindow] = new Window(metaWindow, self);
		}
		return win;
	};

	self.currentMetaWorkspace = function currentMetaWorkspace() {
		return global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
	};

	self.currentLayout = function currentLayout() {
		log("currentLayout:: metaWorkspace = " + self.currentMetaWorkspace());
		log("currentLayout:: workspace = " + self.getWorkspace(self.currentMetaWorkspace()));
		log("currentLayout:: layout = " + self.getWorkspace(self.currentMetaWorkspace()).layout);
		return self.getWorkspace(self.currentMetaWorkspace()).layout;
	};

	self.currentDisplay = function currentDisplay() {
		return global.screen.get_display();
	};

	self.currentWindow = function currentWindow() {
		let win = self.getWindow(self.currentDisplay()['focus-window']);
		log("currently focussed window == " + win);
		return win;
	};


	self._init_keybindings = function _init_keybindings() {
		log("adding keyboard handlers for Shellshape");
		handle('t',       function() { self.currentLayout().tile(self.currentWindow())});
		handle('shift_t', function() { self.currentLayout().untile(self.currentWindow()); });
		handle('comma',   function() { self.currentLayout().add_main_window_count(1); });
		handle('dot',     function() { self.currentLayout().add_main_window_count(-1); });
		handle('j',       function() { self.currentLayout().select_cycle(1); });
		handle('k',       function() { self.currentLayout().select_cycle(-1); });
		handle('shift_j', function() { self.currentLayout().cycle(1); });
		handle('shift_k', function() { self.currentLayout().cycle(-1); });
		handle('space',   function() { self.currentLayout().swap_active_with_main(); });
		handle('h',       function() { self.currentLayout().adjust_main_window_area(-0.1); });
		handle('l',       function() { self.currentLayout().adjust_main_window_area(0.1); });
		handle('u',       function() { self.currentLayout().adjust_current_window_size(0.1); });
		handle('i',       function() { self.currentLayout().adjust_current_window_size(-0.1); });
		log("Done adding keyboard handlers for Shellshape");
	};
	
	self.removeWorkspace = function(metaWorkspace) {
		delete self.workspaces[metaWorkspace];
	};

	self.removeWindow = function(metaWindow) {
		delete self.windows[metaWindow];
	};

	self._init_workspaces = function() {
		self.screen = global.screen;
		self.screen.connect('workspace-added', self.getWorkspace);
		self.screen.connect('workspace-added', self.removeWorkspace);

		// add existing workspaces
		// (yay, iteration!)
		for (let i = 0; i < self.screen.n_workspaces; i++) {
			self.getWorkspace(self.screen.get_workspace_by_index(i));
		}
	};

	self._do(self._init_keybindings);
	self._do(self._init_workspaces);
};


// initialization
function main() {
	log("shellshape initialized!");

	//TODO: move into separate extension
	St.set_slow_down_factor(0.75);

	let ext = new Ext();
}
