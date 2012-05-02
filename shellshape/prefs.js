const Gtk = imports.gi.Gtk;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let ShellshapeSettings = extension.imports.shellshape_settings;

let settings;

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.alternate-tab';

function init() {
	convenience.initTranslations(extension);
	settings = convenience.getSettings(extension, 'alternate-tab');
}

function buildPrefsWidget() {
	let config = ShellshapeSettings.get_config();
	let frame = new Gtk.Box({
		orientation: Gtk.Orientation.VERTICAL,
		border_width: 10
	});

	let label = new Gtk.Label({
		label: "<b>Display</b>",
		use_markup: true,
		xalign: 0
	});
	frame.add(label);

	let hbox = new Gtk.Box({
		orientation: Gtk.Orientation.HORIZONTAL
	});

	let showIndicatorLabel = new Gtk.Label({ text: "Show layout name in indicator" });
	let showIndicatorSwitch = new Gtk.Switch();

	hbox.add(showIndicatorLabel);
	hbox.add(showIndicatorSwitch);
	frame.add(hbox);

	(function() {
		var active = config.DESCRIPTIVE_INDICATOR.get();
		showIndicatorSwitch.set_active(active);
		showIndicatorSwitch.connect('active', function(sw) {
			var new_active = sw.get_active();
			if (new_active != active) {
				active = new_active;
				config.CONCISE_INDICATOR.set(active);
			}
		});
	})();

	frame.show_all();
	return frame;
}
