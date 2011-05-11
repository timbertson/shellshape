// shellshape -- a tiling window manager extension for gnome-shell

const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Mainloop = imports.mainloop;

const Extension = imports.ui.extensionSystem.extensions['shellshape@gfxmonk.net'];

// handler for when a panel is clicked
function _onPanelClick() {
	log('Panel clicked...');
}

// initialization
function main() {
	log("shellshape initialized!");
	const tiling = Extension.tiling;
	const real_mutter = Extension.real_mutter;
	const Window = real_mutter.Window;
	const Workspace = real_mutter.Workspace;

	Main.panel.actor.reactive = true;
	var Screen = {width: 1024, height:768};
	log("got layout!");
	log("connecting buttons and such");
	let workspaces = {};
	let windows = {};
	Main.panel.actor.connect('button-release-event', function() {
		try {
			function getWorkspace(metaWorkspace) {
				var workspace = workspaces[metaWorkspace];
				if(typeof(workspace) == "undefined") {
					log("creating new workspace");
					workspace = workspaces[metaWorkspace] = new Workspace(metaWorkspace);
				}
				return workspace;
			}

			function getLayout(workspace) {
				if(typeof(workspace.tiling_layout) == "undefined") {
					log("creating new layout");
					workspace.tiling_layout = new tiling.HorizontalTiledLayout(Screen.width, Screen.height);
					// workspace.tiling_layout = new HorizontalTiledLayout(Screen.width, Screen.height);
				}
				return workspace.tiling_layout;
			}

			function getWindow(metaWindow) {
				var win = windows[metaWindow];
				if(typeof(win) == "undefined") {
					win = windows[metaWindow] = new Window(metaWindow);
				}
				return win;
			}

			_onPanelClick();
			let metaWorkspace = global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
			let workspace = getWorkspace(metaWorkspace);
			let layout = getLayout(workspace);

			let display = global.screen.get_display();
			let currentWindow = getWindow(display['focus-window']);
			log("currently focussed window == " + currentWindow);
			layout.add(currentWindow);
		} catch (e) {
			log("ERROR in tiling: " + e);
			log("err = " + JSON.stringify(e));
		}

	});
}
