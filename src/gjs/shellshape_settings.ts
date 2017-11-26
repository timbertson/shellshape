/// <reference path="common.ts" />
/// <reference path="logging.ts" />
module ShellshapeSettings {

	var Gio = imports.gi.Gio;
	var Glib = imports.gi.GLib;
	var Config = imports.misc.config;
	var ExtensionUtils = imports.misc.extensionUtils;
	var Ext = ExtensionUtils.getCurrentExtension();

	var SCHEMA_ROOT = 'org.gnome.shell.extensions.net.gfxmonk.shellshape';
	var KEYBINDINGS = SCHEMA_ROOT + '.keybindings';
	var PREFS = SCHEMA_ROOT + '.prefs';

	var log = Logging.getLogger("shellshape.settings");

	export function set_dconf_view() {
		get_local_gsettings('ca.desrt.dconf-editor.Settings')
			.set_string('saved-view',
				'/'+KEYBINDINGS.replace(/\./g,'/')+'/');
	}

	export function envp_with_shellshape_xdg_data_dir() {
		var xdg_data_base = Ext.dir.get_child('data');
		if(!xdg_data_base.query_exists(null)) {
			log.info("xdg dir doesn't exist - assuming global install");
			return null;
		}
		xdg_data_base = xdg_data_base.get_path();

		var XDG_DATA_DIRS = 'XDG_DATA_DIRS';
		var old_xdg_data = Glib.getenv(XDG_DATA_DIRS);
		var new_xdg_data = null;
		if(old_xdg_data != null) {
			var entries = old_xdg_data.split(':');
			if(entries.indexOf(xdg_data_base) == -1) {
				new_xdg_data = old_xdg_data + ':' + xdg_data_base;
			}
		} else {
			var default_xdg = "/usr/local/share/:/usr/share/";
			new_xdg_data = default_xdg + ":" + xdg_data_base;
		}

		//TODO: so much effort to modify one key in the environment,
		// surely there is an easier way...
		var strings = [];
		strings.push(XDG_DATA_DIRS + '=' + new_xdg_data);
		var keys = Glib.listenv();
		for(var i in keys) {
			var key = keys[i];
			if(key == XDG_DATA_DIRS) continue;
			var val = Glib.getenv(key);
			strings.push(key + '=' + val);
		};
		return strings;
	};

	function get_local_gsettings(schema_path) {
		log.info("initting schemas");
		var GioSSS = Gio.SettingsSchemaSource;

		var schemaDir = Ext.dir.get_child('data').get_child('glib-2.0').get_child('schemas');
		var schemaSource;

		if(!(schemaDir.query_exists(null))) {
			log.warn("no directory at: " + schemaDir.get_path() + " - assuming schemas globally installed");
			schemaSource = GioSSS.get_default();
		} else {
			log.warn("loading schema from: " + schemaDir.get_path());
			schemaSource = GioSSS.new_from_directory(
				schemaDir.get_path(),
				GioSSS.get_default(),
				false);
		}

		var schemaObj = schemaSource.lookup(schema_path, true);
		if (!schemaObj) {
			throw new Error(
				'Schema ' + schema_path +
				' could not be found for extension ' +
				Ext.metadata.uuid
			);
		}
		return new Gio.Settings({ settings_schema: schemaObj });
	};

	export class Keybindings {
		settings: any;

		constructor() {
			this.settings = get_local_gsettings(KEYBINDINGS);
		}

		each(fn, ctx) {
			const settings = this.settings;
			var keys = settings.list_children();
			for (var i=0; i < keys.length; i++) {
				var key = keys[i];
				var setting = {
					key: key,
					get: function() { return settings.get_string_array(key); },
					set: function(v) { settings.set_string_array(key, v); },
				};
				fn.call(ctx, setting);
			}
		}
	};

	abstract class Pref<T> {
		key: string;
		gsettings: any;

		constructor(key: string, gsettings: any) {
			this.key = key;
			this.gsettings = gsettings;
		}
		abstract get():T;
		abstract set(newval: T):void;
	}

	class BooleanPref extends Pref<boolean> {
		get() { return this.gsettings.get_boolean(this.key); }
		set(v: boolean) { return this.gsettings.set_boolean(this.key, v); }
	}

	class IntPref extends Pref<number> {
		get() { return this.gsettings.get_int(this.key); }
		set(v: number) { return this.gsettings.set_int(this.key, v); }
	}

	class StringPref extends Pref<string> {
		get() { return this.gsettings.get_string(this.key); }
		set(v: string) { return this.gsettings.set_string(this.key, v); }
	}

	export class Prefs {
		SHOW_INDICATOR: Pref<boolean>;
		MAX_AUTOTILE: Pref<number>;
		DEFAULT_LAYOUT: Pref<string>;
		PADDING: Pref<number>;
		SCREEN_PADDING: Pref<number>;
		settings: any;

		constructor() {
			var settings = this.settings = get_local_gsettings(PREFS);
			this.SHOW_INDICATOR = new BooleanPref('show-indicator', settings);
			this.MAX_AUTOTILE = new IntPref('max-autotiled-windows', settings);
			this.DEFAULT_LAYOUT = new StringPref('default-layout', settings);
			this.PADDING = new IntPref('tile-padding', settings);
			this.SCREEN_PADDING = new IntPref('screen-padding', settings);
		}
	};

	export function initTranslations(domain?:string) {
		domain = domain || Ext.metadata['gettext-domain'];

		// check if this extension was built with "make zip-file", and thus
		// has the locale files in a subfolder
		// otherwise assume that extension has been installed in the
		// same prefix as gnome-shell
		var localeDir = Ext.dir.get_child('locale');
		if (localeDir.query_exists(null)) {
			imports.gettext.bindtextdomain(domain, localeDir.get_path());
		} else {
			imports.gettext.bindtextdomain(domain, Config.LOCALEDIR);
		}
		log.info("translations initted for " + domain);
	}

}
