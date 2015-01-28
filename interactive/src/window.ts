/// <reference path="common.ts" />
/// <reference path="tiling.ts" />
/// <reference path="jquery.d.ts" />

module BrowserWindow {
	export var Viewport : Tiling.Bounds = {
		pos: { x:0, y:0 },
		size: { x:800, y:600 },
		update: function() {},
	}

	var log = Logging.getLogger("window");
	var winCount = 0;
	export var active = null;
	var dim = 0.8;
	var bright = 1;
	var active_border = "#FFFFFF";
	var inactive_border = "#000000";
	function random(min, max) {
		return Math.round(Math.random() * (max - min) + min);
	};

	var stack = [];
	function restack() {
		$.each(stack, function(i, item) {
			item.elem.css({"z-index":i});
			if(i == stack.length - 1) {
				item.activate();
			}
		});
		logstack("restacked");
	}
// 	Window.cycle = function(direction) {
// 		if(direction == 1) {
// 			stack[stack.length-1].sendToBack();
// 		} else {
// 			stack[0].bring_to_front();
// 		}
// 	};
// 	Window.prototype = {
// 		_init: function() {
// 		}
// 	};

	function randomColor() {
		var min = 50;
		var max = 250;
		var rnd = function() { return random(min, max); };
		var pad = function(chr, len, str) { while(str.length < len) { str = chr + str; }; return str; };
		var toHex = function(num) { return pad("0", 2, num.toString(16)); };
		return "#" + $.map([rnd(), rnd(), rnd()], toHex).join("");
	};

	function logstack(msg?) {
		msg = msg ? msg + ": " : "";
		// console.log(msg + "Stack contains: " + $.map(stack, function(w) { return w.title; }).join(","));
		return "";
	}


	export class Window implements Tiling.Window {
		private _id: number;
		// private index: number;
		tile_preference: any;
		private elem: any;
		private title:string;
		private maximized: boolean;
		private unmaximize_args: number[];
		public delegate: any;

		constructor() {
			var self = this;
			this._id = ++winCount;
			self.title = "Window " + this._id;
			self.elem = $("<div class=\"window\"><h3>" + self.title + "</h3></div>");
			$("#screen").append(self.elem);
			var size = 300;
			var left = random(0, Viewport.size.x - size);
			var top = random(0, Viewport.size.y - size);
			self.elem.resizable({handles: 'all'}).draggable();
			self.elem.mouseover(function() { self.activate(); });
			// self.elem.mouseout(function() { self.deactivate(); });
			self.elem.css({background: randomColor(), position:"absolute", width:size, height:size, left:left, top:top, border: "2px solid black", opacity:dim});
			self.elem.mousedown(function() { self.bring_to_front(); });
			// self.elem.bind('resize', function(){self.delegate.on_window_resize(self)});
			// self.elem.bind('move', function(){self.delegate.on_window_move(self)});
			self.elem.bind('resizestop', function(){self.delegate.on_window_resized(self)});
			self.elem.bind('resizestart', function(evt) {
				if(evt.ctrlKey) {
					self.delegate.on_split_resize_start(self);
				}
			});
			self.elem.bind('dragstop', function(){self.delegate.on_window_moved(self)});
			self.delegate = {on_window_resize: function(){}, on_window_move: function(){}};
			self.maximized = false;
			stack.push(self);
			restack();
		}

		id() { return this._id; }

		toString() {
			return "<Window: " + this.title + ">";
		}
		index() {
			var idx = stack.indexOf(this);
			if (idx < 0) throw("window not in stack! I am " + this.title + ", windows are " + logstack());
			return idx;
		}
		close() {
			this._removeFromStack();
			this.elem.detach();
			restack()
		}
		set_tile_preference(){
			// not implemented
		}
		get_title() { return this.title }
		_removeFromStack() {
			stack.splice(this.index(), 1);
		}
		toggleFrontmost() {
			if(this.index() == stack.length - 1) {
				this.sendToBack();
			} else {
				this.bring_to_front();
			}
		}
		sendToBack() {
			this._removeFromStack();
			stack.unshift(this);
			restack();
			// Window.active.deactivate()
			// this.activate()
		}
		bring_to_front() {
			this._removeFromStack();
			stack.push(this);
			restack();
		}
		is_minimized() {
			return false;
		}
		before_redraw(func) { func(); }
		activate() {
			if(active) { active.deactivate() }
			this.elem.css({"border-color": active_border, opacity: bright});
			active = this;
		}
		deactivate() {
			this.elem.css({"border-color": inactive_border, opacity: dim});
			active = null;
		}
		move(x, y) {
			this.elem.css({left:x, top:y});
		}
		resize(w, h) {
			this.elem.css({width:w-4, height:h-4});
		}
		toggle_maximize() {
			if(this.maximized) {
				this.unmaximize();
			} else {
				this.maximize();
			}
			this.maximized = !this.maximized;
		}
		maximize() {
			this.unmaximize_args = [this.xpos(), this.ypos(), this.width(), this.height()];
			this.move_resize({
				pos: {x: 10, y: 10},
				size: { x: Viewport.size.x - 20, y: Viewport.size.y - 20}
			});
		}
		unmaximize() {
			this.move_resize.apply(this, this.unmaximize_args);
		}
		minimize() {
			log.debug("not yet implemented");
		}
		unminimize() {
			log.debug("not yet implemented");
		}
		activate_before_redraw() {
			this.activate();
		}
		move_to_workspace() {
			this.activate();
		}
		move_resize(rect) {
			$("h3", this.elem).text(this.title + " @ "
				+ Math.round(rect.pos.x) + ","
				+ Math.round(rect.pos.y) + " ("
				+ Math.round(rect.size.x) + "x"
				+ Math.round(rect.size.y) +")");
			this.move(rect.pos.x, rect.pos.y);
			this.resize(rect.size.x, rect.size.y);
		}

		width() { return this.elem.outerWidth() + 2; }
		height() { return this.elem.outerHeight() + 2; }
		xpos() { return this.elem.position().left + 1; }
		ypos() { return this.elem.position().top + 1; }
		is_active() { return active === this; }
		rect() {
			return {
				pos: {
					x: this.elem.position().left + 1,
					y: this.elem.position().top + 1,
				},
				size: {
					x: this.elem.outerWidth() + 2,
					y: this.elem.outerHeight() + 2,
				},
			};
		}
	}
}
