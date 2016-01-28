/// <reference path="common.ts" />
module Logging {
	// used elsewhere in the extension to enable additional safety
	// checks that "should never happen". Set to `true` when SHELLSHAPE_DEBUG=true|1|all
	export var PARANOID = false;

	var Lib = imports.misc.extensionUtils.getCurrentExtension().imports.lib;
	var log4js = Lib.log4javascript.log4javascript;
	export function getLogger(name:string):Logger { return log4js.getLogger(name); };
	export function init(main?:boolean) {
		var GLib = imports.gi.GLib;
		var root_logger = log4js.getLogger("shellshape");
		var GjsAppender = Lib.log4javascript_gjs_appender.init(log4js);
		var appender = new GjsAppender();
		appender.setLayout(new log4js.PatternLayout("%-5p: %m"));
		var shellshape_debug = GLib.getenv("SHELLSHAPE_DEBUG");

		var root_level = log4js.Level.INFO;
		root_logger.addAppender(appender);

		if(shellshape_debug) {
			var FileAppender = Lib.log4javascript_file_appender.init(log4js);
			if (main === true) {
				// only the main process should write shellshape.log
				// (prefs.js is loaded in a separate process, and we don't
				// want that to overwrite the real logs)
				var fileAppender = new FileAppender(GLib.getenv('SHELLSHAPE_LOG') || "/tmp/shellshape.log");
				fileAppender.setLayout(new log4js.PatternLayout("%d{HH:mm:ss,SSS} %-5p [%c]: %m"));
				root_logger.addAppender(fileAppender);
			}

			if(shellshape_debug == "true" || shellshape_debug == "all" || shellshape_debug == "1") {
				root_level = log4js.Level.DEBUG;
				Logging.PARANOID = true;
				root_logger.info("set log level DEBUG for shellshape.*");

				var NotificationAppender = function NotificationAppender() { };
				NotificationAppender.prototype = new log4js.Appender();
				NotificationAppender.prototype.layout = new log4js.PatternLayout("%c: %m");
				NotificationAppender.prototype.threshold = log4js.Level.ERROR;
				NotificationAppender.prototype.append = function(loggingEvent:any) {
					var formattedMessage = FileAppender.getFormattedMessage(this, loggingEvent);
					imports.ui.main.notify(formattedMessage);
				};

				var notificationAppender = new NotificationAppender();
				root_logger.addAppender(notificationAppender);

			} else {
				var debug_topics = shellshape_debug.split(",");
				debug_topics.map(function(topic) {
					var log_name = "shellshape." + topic;
					var logger = log4js.getLogger(log_name);
					logger.setLevel(log4js.Level.DEBUG);
					root_logger.info("set log level DEBUG for " + log_name);
				});
			}
		}
		root_logger.setLevel(root_level);
	}
}
