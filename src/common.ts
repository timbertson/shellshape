declare var imports: any;

interface MetaWorkspace {
	list_windows():MetaWindow[]
	index():number
	activate_with_focus(win:MetaWindow, time:number)
	activate(time:number)
}

interface MetaWindow {
	get_monitor():number
	get_title():string
	get_stable_sequence():number
}

interface Screen {
	get_workspace_by_index(n:number):MetaWorkspace
	get_active_workspace_index():number
	connect_after:Function
	get_display():any
	get_n_workspaces():number
	get_n_monitors():number
	get_primary_monitor():number
	get_monitor_geometry(idx:number):any
	connect(name:String, cb:Function):GObjectSignal
	disconnect(GObjectSignal):void
}

interface GObjectSignal {
	__is_gobject_signal: boolean // fake
}

interface GObject {
	connect(name:String, cb:Function):GObjectSignal
	disconnect(GObjectSignal):void
}

interface Global {
	get_current_time(): number
	screen: Screen
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

function assert(x) {
	if (x == null) {
		throw new Error("unexpected null");
	}
	return x;
}
