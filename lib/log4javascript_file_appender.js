const log4javascript = imports.log4javascript.log4javascript;
const Gio = imports.gi.Gio;
function FileAppender() {
	this.init.apply(this, arguments);
};

FileAppender.prototype = new log4javascript.Appender();
FileAppender.prototype.layout = new log4javascript.NullLayout();
FileAppender.prototype.threshold = log4javascript.Level.DEBUG;
FileAppender.prototype.init = function(filename) {
	this.filename = filename;
}

FileAppender.prototype.write = function() {
	// On first invocation, open the file.
	// Then replace the `write` function with the actual implementation.
	let f = Gio.file_new_for_path(this.filename);
	try {
		f.delete(null);
	} catch(e) {
		// ignore, file presumably doesn't exist
	}
	let stream = f.create(Gio.FileCreateFlags.NONE, null);
	let write = function(str) {
		str = str + "\n";
		stream.write(str, str.length, null);
	}
	this.write = write;
	write.apply(this, arguments);
}
FileAppender.prototype.append = function(loggingEvent) {
	var appender = this;

	var getFormattedMessage = function() {
		var layout = appender.getLayout();
		var formattedMessage = layout.format(loggingEvent);
		if (layout.ignoresThrowable() && loggingEvent.exception) {
			formattedMessage += "\n  " + loggingEvent.getThrowableStrRep();
		}
		return formattedMessage;
	};

	this.write(getFormattedMessage());
};
