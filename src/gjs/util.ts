/// <reference path="common.ts" />
/// <reference path="logging.ts" />

// provides a few static utility methods for
// functions without access ot internal extension state
module Util {
	export var log: Logger = Logging.getLogger('shellshape');

	// Utility function over GObject.connect(). Keeps track
	// of each added connection in `owner.bound_signals`,
	// for later cleanup in disconnect_tracked_signals().
	// Also logs any exceptions that occur.
	export function connect_and_track(owner:SignalOwner, subject:GObject, name:string, cb:Function, after?:boolean):void {
		var method = after ? 'connect_after':'connect';
		owner.bound_signals.push({
				subject: subject,
				binding: subject[method](name, function(this:any) {
					var t = this;
					try {
						return cb.apply(t,arguments);
					} catch(e) {
						Util.log.error("Uncaught error in " + name + " signal handler: " + e + "\n" + e.stack);
						throw e;
					}
				})
		});
	}

	// Disconnect all tracked signals from the given object.
	// Used for reverting signals bound via `connect_and_track()`
	export function disconnect_tracked_signals(owner:SignalOwner, subject?:GObject) {
		if (arguments.length > 1 && !subject) {
			throw new Error("disconnect_tracked_signals called with null subject");
		}
		var count=0;
		for(var i=owner.bound_signals.length-1; i>=0; i--) {
			var sig = owner.bound_signals[i];
			if (subject == null || subject === sig.subject) {
				sig.subject.disconnect(sig.binding);
				// delete signal
				owner.bound_signals.splice(i, 1);
				count++;
			}
		}
		if(count>0) {
			Util.log.debug("disconnected " + count + " listeners from " +
					owner + (subject == null ? "" : (" on " + subject)));
		}
	}
}
