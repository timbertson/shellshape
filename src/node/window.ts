/// <reference path="common.ts" />
/// <reference path="tiling.ts" />

module MockWindow {
	var log = Logging.getLogger("window");
	var fail = function(m) { throw new Error("not implemented: " + m); };
	var _idc = 0;
	var active = null;

	export class Window implements Tiling.Window {
		private _rect:Tiling.Rect = {
			pos: { x: 0, y:0 },
			size: { x: 0, y:0 },
		};
		private _id: number;
		title: string;
		tile_preference = null;
		private _minimized = false;

		constructor(title:string) {
			this.title = title;
			this._id = ++_idc;
		}

		id() { return this._id; }

		toString() {
			return "<Window: " + this.title + ">";
		}

		// index() {
		// 	var idx = stack.indexOf(this);
		// 	if (idx < 0) throw("window not in stack! I am " + this.title + ", windows are " + logstack());
		// 	return idx;
		// }
		// close() {
		// 	this._removeFromStack();
		// 	this.elem.detach();
		// 	restack()
		// }
		set_tile_preference(pref){
			this.tile_preference = pref;
		}
		get_title() { return this.title }
		bring_to_front() {fail('bring_to_front')}
		is_minimized() { return this._minimized;}
		before_redraw(func) { func(); }
		activate() { active = this }
		deactivate() { active = null }
		move(x, y) { fail('move') }
		resize(w, h) { fail('resize') }
		toggle_maximize() { fail('toggle_maximize') }
		maximize() { fail('maximize') }
		unmaximize() { fail('unmaximize') }
		minimize() { this._minimized = true; }
		unminimize() { fail('unminimize') }
		activate_before_redraw() { this.activate() }
		move_to_workspace() { fail('move_to_workspace') }
		move_resize(rect) { this._rect = rect }
		width() { fail('width') }
		height() { fail('height') }
		xpos() { fail('xpos') }
		ypos() { fail('ypos') }
		is_active() { return active === this }
		rect() { return this._rect }
	}
}
