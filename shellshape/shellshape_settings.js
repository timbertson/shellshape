const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();

const SCHEMA_ROOT = 'org.gnome.shell.extensions.net.gfxmonk.shellshape';
const KEYBINDINGS = SCHEMA_ROOT + '.keybindings';
const PREFS = SCHEMA_ROOT + '.prefs';

function get_local_gsettings(schema_path) {
	self.log.info("initting schemas");
	const GioSSS = Gio.SettingsSchemaSource;

	let schemaDir = Extension.dir.get_child('xdg').get_child('data').get_child('glib-2.0').get_child('schemas');
	var schemaSource;

	if(!(schemaDir.query_exists(null))) {
		global.log("no directory at: " + schemaDir.get_path() + " - assuming schemas globally installed");
		schemaSource = GioSSS.get_default();
	} else {
		global.log("loading schema from: " + schemaDir.get_path());
		schemaSource = GioSSS.new_from_directory(
			schemaDir.get_path(),
			GioSSS.get_default(),
			false);
	}

	let schemaObj = schemaSource.lookup(schema_path, true);
	if (!schemaObj) {
		throw new Error(
			'Schema ' + schema_path +
			' could not be found for extension ' +
			Extension.metadata.uuid
		);
	}
	return new Gio.Settings({ settings_schema: schemaObj });
};

function Keybindings() {
	var self = this;
	var settings this.settings = get_local_gsettings(KEYBINDINGS);
	this.each = function(fn, ctx) {
		var keys = settings.list_children();
		for (let i=0; i < keys.length; i++) {
			let key = keys[i];
			let setting = {
				key: key,
				get: function() { return settings.get_string_array(key); },
				set: function(v) { settings.set_string_array(key, v); },
			};
			fn.call(ctx, setting);
		}
	};
};

function Prefs() {
	var self = this;
	var settings = this.settings = get_local_gsettings(PREFS);
	this.DESCRIPTIVE_INDICATOR = {
		key: 'descriptive-indicator',
		get: function() { return settings.get_boolean(this.key); },
		set: function(v) { settings.set_boolean(this.key, v); }
	};
};
