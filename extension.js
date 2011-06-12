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

	self.screenDimensions = {}
	self.screenDimensions.width = self.monitor.width;
	self.screenDimensions.offset_x = 0;
	self.screenDimensions.offset_y = Main.panel.actor.height;
	self.screenDimensions.height = self.monitor.height - self.screenDimensions.offset_y;

	// sneaky hacks: tile all windows on current workspace when the panel is clicked
	Main.panel.actor.reactive = true;
	Main.panel.actor.connect('button-release-event', function() {
		//self.currentWorkspace().tileAll();
	});

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
		log("currently focussed window == " + win);
		return win;
	};

	//TODO: move workspace
	self.switch_workspace = function switch_workspace(offset, window) {
		if(window !== undefined) {
			// move window to new workspace as well
		}
	};

	self._init_keybindings = function _init_keybindings() {
		log("adding keyboard handlers for Shellshape");
		var RESIZE_INCREMENT = 0.05;
		handle('t',           function() { self.currentLayout().tile(self.currentWindow())});
		handle('shift_t',     function() { self.currentLayout().untile(self.currentWindow()); });
		handle('comma',       function() { self.currentLayout().add_main_window_count(1); });
		handle('dot',         function() { self.currentLayout().add_main_window_count(-1); });
		handle('j',           function() { self.currentLayout().select_cycle(1); });
		handle('k',           function() { self.currentLayout().select_cycle(-1); });
		handle('shift_j',     function() { self.currentLayout().cycle(1); });
		handle('shift_k',     function() { self.currentLayout().cycle(-1); });
		handle('space',       function() { self.currentLayout().main().activate(); });
		handle('shift_space', function() { self.currentLayout().swap_active_with_main(); });
		handle('h',           function() { self.currentLayout().adjust_main_window_area(-RESIZE_INCREMENT); });
		handle('l',           function() { self.currentLayout().adjust_main_window_area(+RESIZE_INCREMENT); });
		handle('u',           function() { self.currentLayout().adjust_current_window_size(-RESIZE_INCREMENT); });
		handle('i',           function() { self.currentLayout().adjust_current_window_size(+RESIZE_INCREMENT); });
		handle('alt_j',       function() { self.switch_workspace(+1); });
		handle('alt_k',       function() { self.switch_workspace(-1); });
		handle('alt_shift_j', function() { self.switch_workspace(+1, self.currentWindow()); });
		handle('alt_shift_k', function() { self.switch_workspace(-1, self.currentWindow()); });
		handle('z',           function() { self.currentWindow().toggle_maximize(); });
		log("Done adding keyboard handlers for Shellshape");
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
