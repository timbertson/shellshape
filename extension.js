// shellshape -- a tiling window manager extension for gnome-shell

const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const Extension = imports.ui.extensionSystem.extensions['shellshape@gfxmonk.net'];
const tiling = Extension.tiling;
const real_mutter = Extension.real_mutter;

// handler for when a panel is clicked
function _onPanelClick() {
	log('Panel clicked...');
}


function _showHello() {
	let text = new St.Label({ style_class: 'helloworld-label', text: _("Hello, world!") });
	let monitor = global.get_primary_monitor();
	global.stage.add_actor(text);
	text.set_position(Math.floor (monitor.width / 2 - text.width / 2), Math.floor(monitor.height / 2 - text.height / 2));
	Mainloop.timeout_add(3000, function () { text.destroy(); });
}

// initialization
function main() {
	Main.panel.actor.reactive = true;
	var Screen = {width: 1024, height:768};
	var layout = new tiling.HorizontalTiledLayout(Screen.width, Screen.height);
	Main.panel.actor.connect('button-release-event', function() {
		_showHello();
		_onPanelClick();

		// sneak: get first window:
		let tracker = Shell.WindowTracker.get_default();
		let apps = tracker.get_running_apps ('');
		for(var i=0; i<apps.length; i++) {
			let app = apps[i];
			let wins = app.get_windows();
			log("application " + app.get_name() + " has " + wins.length + " windows");
			for(var j=0; j<wins.length; j++) {
				// see /home/tim/gnome-shell/source/mutter/src/core/window-private.h, line 64
				// also /home/tim/gnome-shell/source/mutter/src/include/boxes.h
				let win = wins[j];
				let rect = win.get_outer_rect()
				log("rect = " + rect);
				log("window is " + rect.width + "x" + rect.height);
			}
		}
	});
}
