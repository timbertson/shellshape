declare var process:any;
module Logging {
	export function getLogger(name:string):Logger {
		var noop = function() {};
		return (typeof process) !== 'undefined' && process.env['DEBUG'] === '1' ? {
			debug: console.log,
			info: console.log,
			warn: console.warn,
			error: console.error,
		} : {
			debug: noop,
			info: noop,
			warn: noop,
			error: noop,
		};
	};
}
