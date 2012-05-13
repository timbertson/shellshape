const Gtk = imports.gi.Gtk;

let Extension = imports.misc.extensionUtils.getCurrentExtension();
let ShellshapeSettings = Extension.imports.shellshape_settings;

function init() {
}

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
		let radio_box = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 2
		});
		let r_floating = new Gtk.RadioButton(  { label: ("Floating") });
		let r_vertical = new Gtk.RadioButton(  { label: ("Vertical"),   group: r_floating });
		let r_horizontal = new Gtk.RadioButton({ label: ("Horizontal"), group: r_floating });

		let layout_radios =
		{
			'floating': r_floating,
			'horizontal': r_horizontal,
			'vertical': r_vertical
		};

		var pref = config.DEFAULT_LAYOUT;
		let active = layout_radios[pref.get()];
		if(active) {
			active.set_active(true);
		}
		let init_radio = function(k) {
			let radio = layout_radios[k];
			radio.connect('toggled', function() {
				if(radio.get_active()) {
					pref.set(k);
				}
			});
			radio_box.add(radio);
		};
		init_radio('floating');
		init_radio('vertical');
		init_radio('horizontal');

		hbox.add(label);
		hbox.add(radio_box);
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
			label: "Edit keyboard settings" +
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
				imports.gi.GLib.spawn_async(null, ['dconf-editor'], envp, null, null);
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
