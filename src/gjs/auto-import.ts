/// <reference path="common.ts" />

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

var ENABLED = (GLib.getenv("GJS_AUTOIMPORT") == "1");
function setEnabled(newval) {
	ENABLED = newval;
}

function myLog(msg) {
	log('[gjs-autoimport] ' + msg);
}

function importAbsolute(path) {
	myLog("importing " + path);
	let oldSearchPath = imports.searchPath.slice();
	try {
		imports.searchPath = ["/"];
		return imports[path];
	} finally {
		imports.searchPath = oldSearchPath;
	}
}

function makeImporter(basePath, scope, moduleName) {
	let initial = importAbsolute(basePath + "/" + moduleName);
	let impl = function() {
		// first time round, just return `initial`. But replace `impl` so that next time
		// we'll do a full reimport
		impl = function() {
			let canonicalPath = initial.__file__;
			let tempPath = GLib.get_tmp_dir()
			let temp = Gio.File.new_for_path(tempPath).get_child('gjs-autoimport');
			if(!temp.query_exists(null)) {
				myLog("creating " + temp.get_path())
				temp.make_directory(null);
			}
			let genName = (function() {
				let i = 0;
				return function(base) {
					i++;
					return base + '@' + scope + '-' + i;
				}
			})();

			// only do initial setup once
			impl = function() {
				let candidate = genName(moduleName);
				let candidateFilename = candidate + ".js";
				// myLog("Checking candidate file: " + candidate);
				let candidateFile = temp.get_child(candidateFilename);
				if (candidateFile.query_exists(null)) {
					GLib.unlink(candidateFile.get_path());
					// myLog("Removing existing: " + candidate);
				}
				candidateFile.make_symbolic_link(canonicalPath, null);
				return importAbsolute(temp.get_child(candidate).get_path());
			}
			return impl();
		};
		return initial;
	};
	return function() {
		return impl();
	};
}

function wrapExtension(getExtension, scope) {
	if(!ENABLED) {
		myLog("Note: set GJS_AUTOIMPORT to \"!\" to enable reimports.");
		return getExtension().init();
	}

	var currentInstance = null;
	var notify = function() {
		notify = function() {
			try {
				imports.ui.main.notify('Extension ' + scope + ' reloaded from disk');
			} catch(e) {
				myLog("notify failed");
			}
		}
	}
	return {
		enable: function() {
			currentInstance = getExtension().init();
			currentInstance.enable();
			notify();
		},
		disable: function() {
			if (currentInstance !== null) {
				currentInstance.disable();
				currentInstance = null;
			}
		}
	}
}

function wrapExtensionModule(extension, name) {
	if (!name) name = 'extension-impl';
	let basePath = extension.path;
	let scope = extension.uuid;
	let getExtension = makeImporter(basePath, scope, name);
	return wrapExtension(getExtension, scope);
}
