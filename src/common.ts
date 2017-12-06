declare var imports: any;

interface logFn {
	(message: string): void;
}
declare var log: logFn;

interface GObject {
	connect(name:String, cb:Function):GObjectSignal
	disconnect(signal:GObjectSignal):void
}

interface MetaRect {
	x: number
	y: number
	width: number
	height: number
}

interface MetaWorkspace extends GObject {
	list_windows():MetaWindow[]
	activate_with_focus(win:MetaWindow, time:number):void
	activate(time:number):void
	get_work_area_for_monitor(idx: number): MetaRect

	// NOTE: *only* use this method if you know the workspace
	// is currently in the active workspace list.
	// Otherwise, it'll crash gnome-shell.
	index():number
}

interface MetaWindow extends GObject {
	get_monitor():number
	get_frame_rect(): MetaRect
	get_workspace(): MetaWorkspace
	get_title():string
	get_stable_sequence():number
	get_compositor_private():GObject
	resizeable: boolean
	above: boolean
	minimized: boolean
	maximized: number
	minimize: VoidFunc
	unminimize: VoidFunc
	unmaximize(flags:number): void
	maximize(flags:number): void
	change_workspace_by_index(idx: number, append: boolean):void
	get_maximized(): number
	move_resize_frame(userOp: boolean, x: number, y: number, w: number, h: number):void
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
	create_app_launch_context(...args: any[]):any
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
interface IterFunc<T> {
	(subject:T, index:number):any
}
interface Predicate<T> {
	(subject:T):boolean
}
interface VoidFunc1<T> {
	(subject:T):void
}
interface VoidFunc {
	():void
}

interface Logger {
	error: Void_Varargs
	warn: Void_Varargs
	info: Void_Varargs
	debug: Void_Varargs
}

interface Lang {
	bind(subject:Object, fn:Function):Function
}

function assert<T extends Object>(x:T) {
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
