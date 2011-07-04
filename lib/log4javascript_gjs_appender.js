const log4javascript = imports.log4javascript.log4javascript;
function GjsAppender() {};

GjsAppender.prototype = new log4javascript.Appender();
GjsAppender.prototype.layout = new log4javascript.NullLayout();
GjsAppender.prototype.threshold = log4javascript.Level.INFO;
GjsAppender.prototype.append = function(loggingEvent) {
	var appender = this;
	var getFormattedMessage = function() {
		var layout = appender.getLayout();
		var formattedMessage = layout.format(loggingEvent);
		if (layout.ignoresThrowable() && loggingEvent.exception) {
			formattedMessage += "\n  " + loggingEvent.getThrowableStrRep();
		}
		return formattedMessage;
	};

	print(getFormattedMessage());
};
