/// <reference path="common.ts" />
/// <reference path="shellshape_settings.ts" />

// NOTE: this file should *not* be imported into extension.js,
// because it provides the roplevel symbols required
// for prefs.js (which clash with extension.js
//
// log4javascript inits /tmp/shellshape.log, which
// is a pain since prefs.js runs in a new process, and
// overwrites the useful log file with a basically empty one.

var Gtk = imports.gi.Gtk;
var GLib = imports.gi.GLib;

var Config = imports.misc.config;
var Gettext = imports.gettext.domain('shellshape');
var _ = Gettext.gettext;

function init() {
	Logging.init();
	ShellshapeSettings.initTranslations();
};

function buildPrefsWidget() {
	var config = new ShellshapeSettings.Prefs();
	var frame = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
		border_width: 10
	});

	var vbox = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
		spacing: 14
	});

	var label = new Gtk.Label({
		label: _("<b>General:</b>"),
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);

	(function() {
		var hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		var checkbutton = new Gtk.CheckButton({ label: _("Show indicator in status panel") });

		hbox.pack_end(checkbutton, true, true, 0);
		vbox.add(hbox);

		var pref = config.SHOW_INDICATOR;
		checkbutton.set_active(pref.get());
		checkbutton.connect('toggled', function(sw) {
			var oldval = pref.get();
			var newval = sw.get_active();
			if (newval != pref.get()) {
				pref.set(newval);
			}
		});
	})();

	var label = new Gtk.Label({
		label: _("<b>Tiling:</b>"),
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);

	(function() {
		var hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		var label = new Gtk.Label({ label: _("Maximum number of windows to auto-tile:") });
		var adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 20,
			step_increment: 1
		});
		var scale = new Gtk.HScale({
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
		var hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		var label = new Gtk.Label({ label: _("Default layout:"), });
		var radio_box = new Gtk.Box({
			orientation: Gtk.Orientation.VERTICAL,
			spacing: 2
		});
		var r_floating = new Gtk.RadioButton(  { label: _("Floating") });
		var r_vertical = new Gtk.RadioButton(  { label: _("Vertical"),   group: r_floating });
		var r_horizontal = new Gtk.RadioButton({ label: _("Horizontal"), group: r_floating });
		var r_fullscreen = new Gtk.RadioButton({ label: _("Full Screen"), group: r_floating });

		var layout_radios =
		{
			'floating': r_floating,
			'horizontal': r_horizontal,
			'vertical': r_vertical,
			'fullscreen': r_fullscreen
		};

		var pref = config.DEFAULT_LAYOUT;
		var active = layout_radios[pref.get()];
		if(active) {
			active.set_active(true);
		}
		var init_radio = function(k) {
			var radio = layout_radios[k];
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
		init_radio('fullscreen');

		hbox.add(label);
		hbox.add(radio_box);
		vbox.add(hbox);
	})();



	(function() {
		var hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		var label = new Gtk.Label({ label: _("Padding between tiles (px)") });
		var adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 20,
			step_increment: 1
		});
		var scale = new Gtk.HScale({
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

	//screenpadding
	(function() {
		var hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		var label = new Gtk.Label({ label: _("Padding around screen edge (px)") });
		var adjustment = new Gtk.Adjustment({
			lower: 0,
			upper: 20,
			step_increment: 1
		});
		var scale = new Gtk.HScale({
			digits:0,
			adjustment: adjustment,
			value_pos: Gtk.PositionType.RIGHT
		});

		hbox.add(label);
		hbox.pack_end(scale, true, true, 0);
		vbox.add(hbox);

		var pref = config.SCREEN_PADDING;
		scale.set_value(pref.get());
		scale.connect('value-changed', function(sw) {
			var oldval = pref.get();
			var newval = sw.get_value();
			if (newval != pref.get()) {
				pref.set(newval);
			}
		});
	})();


	var label = new Gtk.HSeparator();
	vbox.add(label);

	var label = new Gtk.Label({
		label: _("<b>Advanced settings:</b>"),
		use_markup: true,
		xalign: 0
	});
	vbox.add(label);
	(function() {
		var hbox = new Gtk.Box({
			orientation: Gtk.Orientation.HORIZONTAL,
			spacing: 20
		});

		var label = new Gtk.Label({
			label: _("Edit keyboard settings") +
				"\n<small>"+_("(make sure you have dconf-editor installed)")+"\n" +
				_("Navigate to")+" org/gnome/shell/extensions/net/gfxmonk/shellshape</small>",
			use_markup: true});
		var button = new Gtk.Button({
			label: 'dconf-editor'
		});
		var error_msg = new Gtk.Label();
		button.connect('clicked', function(sw) {
			try {
				// The magic sauce that lets dconf-editor see our local schema:
				var envp = ShellshapeSettings.envp_with_shellshape_xdg_data_dir();
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
