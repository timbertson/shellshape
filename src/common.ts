declare var imports: any;

interface Global {
	get_current_time(): number
	screen: any
	log: Function
	display: any
}

declare var global: Global;
declare var Lang: Lang;

interface Void_Varargs {
	(...args: any[]):void
}

interface Function {
	(...args: any[]):any
}

interface Logger {
	error: Void_Varargs
	warn: Void_Varargs
	info: Void_Varargs
	debug: Void_Varargs
}

interface LogModule {
	getLogger(name:string) : Logger
}

// Used in APIs to force users to either use
// Lang.bind, or cast to <FreeFunction> for anonymous
// functions that don't use `this`
interface FreeFunction extends Function {
		// but we need at least one attribute to force
		// the duck typer to reject non-bound functions
	__FreeFunction: boolean
}
interface Anon extends FreeFunction {}

interface Lang {
	bind(subject:Object, fn:Function):FreeFunction
}
