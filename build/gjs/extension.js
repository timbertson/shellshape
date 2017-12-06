var autoImport = (function() {
    var GLib = imports.gi.GLib;
    var Gio = imports.gi.Gio;
    var ENABLED = (GLib.getenv("GJS_AUTOIMPORT") == "1");
    function setEnabled(newval) {
        ENABLED = newval;
    }
    function myLog(msg) {
        log('[gjs-autoimport] ' + msg);
    }
    function importAbsolute(path) {
        myLog("importing " + path);
        var oldSearchPath = imports.searchPath.slice();
        try {
            imports.searchPath = ["/"];
            return imports[path];
        }
        finally {
            imports.searchPath = oldSearchPath;
        }
    }
    function makeImporter(basePath, scope, moduleName) {
        var initial = importAbsolute(basePath + "/" + moduleName);
        var impl = function () {
            // first time round, just return `initial`. But replace `impl` so that next time
            // we'll do a full reimport
            impl = function () {
                var canonicalPath = initial.__file__;
                var tempPath = GLib.get_tmp_dir();
                var temp = Gio.File.new_for_path(tempPath).get_child('gjs-autoimport');
                if (!temp.query_exists(null)) {
                    myLog("creating " + temp.get_path());
                    temp.make_directory(null);
                }
                var genName = (function () {
                    var i = 0;
                    return function (base) {
                        i++;
                        return base + '@' + scope + '-' + i;
                    };
                })();
                // only do initial setup once
                impl = function () {
                    var candidate = genName(moduleName);
                    var candidateFilename = candidate + ".js";
                    // myLog("Checking candidate file: " + candidate);
                    var candidateFile = temp.get_child(candidateFilename);
                    if (candidateFile.query_exists(null)) {
                        GLib.unlink(candidateFile.get_path());
                        // myLog("Removing existing: " + candidate);
                    }
                    candidateFile.make_symbolic_link(canonicalPath, null);
                    return importAbsolute(temp.get_child(candidate).get_path());
                };
                return impl();
            };
            return initial;
        };
        return function () {
            return impl();
        };
    }
    function wrapExtension(getExtension, scope) {
        if (!ENABLED) {
            myLog("Note: set GJS_AUTOIMPORT to \"1\" to enable reimports.");
            return getExtension().init();
        }
        var currentInstance = null;
        var notify = function () {
            notify = function () {
                try {
                    imports.ui.main.notify('Extension ' + scope + ' reloaded from disk');
                }
                catch (e) {
                    myLog("notify failed");
                }
            };
        };
        return {
            enable: function () {
                currentInstance = getExtension().init();
                currentInstance.enable();
                notify();
            },
            disable: function () {
                if (currentInstance !== null) {
                    currentInstance.disable();
                    currentInstance = null;
                }
            }
        };
    }
    function wrapExtensionModule(extension, name) {
        if (!name) name = 'extension_impl';
        var basePath = extension.path;
        var scope = extension.uuid;
        var getExtension = makeImporter(basePath, scope, name);
        return wrapExtension(getExtension, scope);
    }

    return {
        makeImporter: makeImporter,
        wrapExtension: wrapExtension,
        wrapExtensionModule: wrapExtensionModule
    }
})();

function init() {
    var self = imports.misc.extensionUtils.getCurrentExtension();
    return autoImport.wrapExtensionModule(self);
}
