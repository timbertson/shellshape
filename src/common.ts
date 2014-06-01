declare var imports: any;

interface GObject {
	connect(name:String, cb:Function):GObjectSignal
	disconnect(GObjectSignal):void
}

interface MetaWorkspace extends GObject {
	list_windows():MetaWindow[]
	activate_with_focus(win:MetaWindow, time:number)
	activate(time:number)

	// NOTE: *only* use this method if you know the workspace
	// is currently in the active workspace list.
	// Otherwise, it'll crash gnome-shell.
	index():number
}

interface MetaWindow extends GObject {
	get_monitor():number
	get_workspace(): MetaWorkspace
	get_title():string
	get_stable_sequence():number
	get_compositor_private():GObject
	resizeable: boolean
	above: boolean
	is_skip_taskbar(): boolean
	is_on_all_workspaces(): boolean
	get_wm_class(): string
}

interface Screen extends GObject {
	get_workspace_by_index(n:number):MetaWorkspace
	get_active_workspace_index():number
	connect_after:Function
	get_display():any
	get_n_workspaces():number
	get_n_monitors():number
	get_primary_monitor():number
	get_monitor_geometry(idx:number):any
}

interface GObjectSignal {
	__is_gobject_signal: boolean // fake
}

interface SignalOwner {
	bound_signals: BoundSignal[]
}

interface BoundSignal {
	subject: GObject
	binding: GObjectSignal
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
interface Iterator<T> {
	(subject:T, index?:number):any
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
	if (!x) {
		throw new Error("assertion failed");
	}
	return x;
}

function as<T>(cons:any, obj:any):T {
	if (obj instanceof(cons)) {
		return <T>obj;
	}
	throw new Error("Object " + obj + " is the wrong type");
}
