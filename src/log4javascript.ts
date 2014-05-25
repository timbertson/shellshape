// shim that loads the real log4javascript
// if possible, otherwise uses a stub
var GLib = imports.gi.GLib;

var log4javascript;

function _init_logging() {
	var Log = log4javascript;
	var root_logger = Log.getLogger("shellshape");
	var appender = new GjsAppender();
	appender.setLayout(new Log.PatternLayout("%-5p: %m"));
	var shellshape_debug = GLib.getenv("SHELLSHAPE_DEBUG");

	var root_level = Log.Level.INFO;
	root_logger.addAppender(appender);

	if(shellshape_debug) {
		var FileAppender = imports.log4javascript_file_appender.FileAppender;
		var fileAppender = new FileAppender("/tmp/shellshape.log");
		fileAppender.setLayout(new Log.PatternLayout("%d{HH:mm:ss,SSS} %-5p [%c]: %m"));
		root_logger.addAppender(fileAppender);

		if(shellshape_debug == "true" || shellshape_debug == "all" || shellshape_debug == "1") {
			root_level = Log.Level.DEBUG;
			root_logger.info("set log level DEBUG for shellshape.*");
		} else {
			var debug_topics = shellshape_debug.split(",");
			debug_topics.map(function(topic) {
				var log_name = "shellshape." + topic;
				var logger = Log.getLogger(log_name);
				logger.setLevel(Log.Level.DEBUG);
				root_logger.info("set log level DEBUG for " + log_name);
			});
		}
		root_logger.info(" ---- Shellshape starting ---- ");
	}
	root_logger.setLevel(root_level);
}

try {
	log4javascript = imports.log4javascript.log4javascript;
	var GjsAppender = imports.log4javascript_gjs_appender.GjsAppender;
	_init_logging();
} catch(e) {
	global.log("Failed to init log4javascript: " + e + " - using a stub instead");
	var noop = function() {};
	log4javascript = {
		getLogger: function() { return log4javascript; },
		error: global.log,
		warn: global.log,
		info: noop,
		debug: noop,
	};
}


