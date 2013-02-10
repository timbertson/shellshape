const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

var ShellshapeSettings; // set in init()

function init() {
	// extension.js (via log4javascript) inits /tmp/shellshape.log, which
	// is a pain since prefs.js runs in a new process, and
	// overwrites the useful log file with a basically empty one.
	GLib.unsetenv("SHELLSHAPE_DEBUG");
	let Extension = imports.misc.extensionUtils.getCurrentExtension();
	ShellshapeSettings = Extension.imports.shellshape_settings;
}

function make_combo(obj) {
	var pref = obj.pref;
	var options = obj.options;

	let combo = new Gtk.ComboBoxText();

	for (var i=0; i<options.length; i++) {
		let [id, text] = options[i];
		combo.append(id, text);
	}

	let active = pref.get();
	for (var i=0; i<options.length; i++) {
		if (options[i][0] == active) {
			combo.set_active(i);
			break;
		}
	}

	combo.connect('changed', function(combo) {
		var idx = combo.get_active();
		pref.set(options[idx][0]);
	});
	return combo;
};

function buildPrefsWidget() {
	let config = new ShellshapeSettings.Prefs();
	let frame = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
		border_width: 10
	});

	let vbox = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
		spacing: 14
	});

	let label = new Gtk.Label({
		label: "<b>Tiling:</b>",
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);

	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({ label: "Maximum number of windows to auto-tile:" });
		let adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 20,
			step_increment: 1
		});
		let scale = new Gtk.HScale({
			digits:0,
			adjustment: adjustment,
			value_pos: Gtk.PositionType.RIGHT
		});

		hbox.add(label);
		hbox.pack_end(scale, true, true, 0);
		vbox.add(hbox);

		var pref = config.MAX_AUTOTILE;
		scale.set_value(pref.get());
		scale.connect('value-changed', function(sw) {
			var oldval = pref.get();
			var newval = sw.get_value();
			if (newval != pref.get()) {
				pref.set(newval);
			}
		});
	})();


	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({
			label: "Default layout:\n<small>NOTE: only affects newly-created workspaces,\nrestart the shell to apply globally.</small>",
				use_markup: true
		});

		let combo_box = make_combo({
			pref: config.DEFAULT_LAYOUT,
			options: [
				['floating', 'Floating'],
				['vertical', 'Vertical'],
				['horizontal', 'Horizontal']]
		});

		hbox.add(label);
		hbox.pack_end(combo_box, false, false, 0);
		vbox.add(hbox);
	})();



	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({ label: "Padding between tiles (px)" });
		let adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 20,
			step_increment: 1
		});
		let scale = new Gtk.HScale({
			digits:0,
			adjustment: adjustment,
			value_pos: Gtk.PositionType.RIGHT
		});

		hbox.add(label);
		hbox.pack_end(scale, true, true, 0);
		vbox.add(hbox);

		var pref = config.PADDING;
		scale.set_value(pref.get());
		scale.connect('value-changed', function(sw) {
			var oldval = pref.get();
			var newval = sw.get_value();
			if (newval != pref.get()) {
				pref.set(newval);
			}
		});
	})();


	vbox.add(new Gtk.HSeparator());
	let label = new Gtk.Label({
		label: ("<b>Window decorations:</b>\n" +
			"<small>" +
			"This feature is <i>EXPERIMENTAL</i> and may not always work.\n" +
			"It might even crash Gnome Shell. Mostly it works, but you have been warned!" +
			"</small>"),
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);
	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({
			label: "Remove window decorations to save space:"
		});

		var pref = config.UNDECORATE_TILES;
		var enable = new Gtk.Switch();
		enable.connect('notify::active', function() {
			pref.set(enable.get_active());
		});
		enable.set_active(pref.get());

		hbox.add(label);
		hbox.pack_end(enable, false, false, 0);
		vbox.add(hbox);
	})();

	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});
		let label = new Gtk.Label({
			label: "Decoration mode: (requires restart)"
		});

		var combo_box = make_combo({
			pref: config.UNDECORATE_MODE,
			options: [
				['border', "Remove titlebar, keep shadow"],
				['none', "Remove all decorations"]]
		});

		hbox.add(label);
		hbox.pack_end(combo_box, false, false, 0);
		vbox.add(hbox);
	})();



	let label = new Gtk.HSeparator();
	vbox.add(label);

	let label = new Gtk.Label({
		label: "<b>Advanced settings:</b>",
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);

	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({
			label: "Edit keyboard bindings" +
				"\n<small>(make sure you have dconf-editor installed)\n" +
				"Navigate to org/gnome/shell/extensions/net/gfxmonk/shellshape</small>",
			use_markup: true});
		let button = new Gtk.Button({
			label: 'dconf-editor'
		});
		let error_msg = new Gtk.Label();
		button.connect('clicked', function(sw) {
			try {
				// The magic sauce that lets dconf-editor see our local schema:
				let envp = ShellshapeSettings.envp_with_shellshape_xdg_data_dir();
				GLib.spawn_async(null, ['dconf-editor'], envp, GLib.SpawnFlags.SEARCH_PATH, null);
			} catch(e) {
				error_msg.set_label("ERROR: Could not launch dconf-editor. Is it installed?");
				throw e;
			}
		});

		hbox.add(label);
		hbox.pack_end(button, false, false, 0);
		vbox.add(hbox);
		vbox.add(error_msg);

	})();



	frame.add(vbox);

	frame.show_all();
	return frame;
}
