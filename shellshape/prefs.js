const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const Config = imports.misc.config;
const Gettext = imports.gettext.domain('shellshape');
const _ = Gettext.gettext;

var ShellshapeSettings; // set in init()

function init() {
	// extension.js (via log4javascript) inits /tmp/shellshape.log, which
	// is a pain since prefs.js runs in a new process, and
	// overwrites the useful log file with a basically empty one.
	GLib.unsetenv("SHELLSHAPE_DEBUG");
	let Extension = imports.misc.extensionUtils.getCurrentExtension();
	ShellshapeSettings = Extension.imports.shellshape_settings;
	initTranslations("shellshape");
}

function initTranslations(domain) {
    let extension = imports.misc.extensionUtils.getCurrentExtension();

    domain = domain || extension.metadata['gettext-domain'];

    // check if this extension was built with "make zip-file", and thus
    // has the locale files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell
    let localeDir = extension.dir.get_child('locale');
    if (localeDir.query_exists(null))
        imports.gettext.bindtextdomain(domain, localeDir.get_path());
    else
        imports.gettext.bindtextdomain(domain, Config.LOCALEDIR);
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
		label: _("<b>Tiling:</b>"),
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);

	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({ label: _("Maximum number of windows to auto-tile:") });
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
			label: _("Default layout:")+"\n<small>"+_("NOTE: only affects newly-created workspaces,\nrestart the shell to apply globally.")+"</small>",
				use_markup: true
		});
		let radio_box = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 2
		});
		let r_floating = new Gtk.RadioButton(  { label: _("Floating") });
		let r_vertical = new Gtk.RadioButton(  { label: _("Vertical"),   group: r_floating });
		let r_horizontal = new Gtk.RadioButton({ label: _("Horizontal"), group: r_floating });

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



	(function() {
		let hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		let label = new Gtk.Label({ label: _("Padding between tiles (px)") });
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



	let label = new Gtk.HSeparator();
	vbox.add(label);

	let label = new Gtk.Label({
		label: _("<b>Advanced settings:</b>"),
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
			label: _("Edit keyboard settings") +
				"\n<small>"+_("(make sure you have dconf-editor installed)")+"\n" +
				_("Navigate to")+" org/gnome/shell/extensions/net/gfxmonk/shellshape</small>",
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
				error_msg.set_label(_("ERROR: Could not launch dconf-editor. Is it installed?"));
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
