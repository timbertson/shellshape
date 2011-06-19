Screen = {
	width: 800,
	height: 600,
}

function Window() { this._init(); }
(function() {
	var dim = 0.8;
	var bright = 1;
	var active_border = "#FFFFFF";
	var inactive_border = "#000000";
	function random(min, max) {
		return Math.round(Math.random() * (max - min) + min);
	};

	function randomColor() {
		var min = 50;
		var max = 250;
		var rnd = function() { return random(min, max); };
		var pad = function(chr, len, str) { while(str.length < len) { str = chr + str; }; return str; };
		var toHex = function(num) { return pad("0", 2, num.toString(16)); };
		return "#" + $.map([rnd(), rnd(), rnd()], toHex).join("");
	};

	var winCount = 1;
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
	function logstack(msg) {
		msg = msg ? msg + ": " : "";
		// console.log(msg + "Stack contains: " + $.map(stack, function(w) { return w.title; }).join(","));
		return "";
	}

	Window.cycle = function(direction) {
		if(direction == 1) {
			stack[stack.length-1].sendToBack();
		} else {
			stack[0].bringToFront();
		}
	};
	Window.prototype = {
		_init: function() {
			var self = this;
			self.title = "Window " + winCount;
			self.elem = $("<div class=\"window\"><h3>" + self.title + "</h3></div>");
			winCount += 1;
			$("#screen").append(self.elem);
			var size = 300;
			var left = random(0, Screen.width - size);
			var top = random(0, Screen.height - size);
			self.elem.resizable({handles: 'all'}).draggable();
			self.elem.mouseover(function() { self.activate(); });
			// self.elem.mouseout(function() { self.deactivate(); });
			self.elem.css({background: randomColor(), position:"absolute", width:size, height:size, left:left, top:top, border: "2px solid black", opacity:dim});
			self.elem.mousedown(function() { self.bringToFront(); });
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
		,index:function() {
			var idx = stack.indexOf(this);
			if (idx < 0) throw("window not in stack! I am " + this.title + ", windows are " + logstack());
			return idx;
		}
		,toString: function() {
			return "<Window: " + this.title + ">";
		}
		,close: function() {
			this._removeFromStack();
			this.elem.detach();
			restack()
		}
		,_removeFromStack: function() {
			stack.splice(this.index(), 1);
		}
		,toggleFrontmost: function() {
			if(this.index() == stack.length - 1) {
				this.sendToBack();
			} else {
				this.bringToFront();
			}
		}
		,sendToBack: function() {
			this._removeFromStack();
			stack.unshift(this);
			restack();
			// Window.active.deactivate()
			// this.activate()
		}
		,bringToFront: function() {
			this._removeFromStack();
			stack.push(this);
			restack();
		}
		,isMinimized: function() {
			return false;
		}
		,beforeRedraw: function(func) { func(); }
		,activate: function() {
			if(Window.active) { Window.active.deactivate() }
			this.elem.css({"border-color": active_border, opacity: bright});
			Window.active = this;
		}
		,deactivate: function() {
			this.elem.css({"border-color": inactive_border, opacity: dim});
			Window.active = null;
		}
		,move: function(x, y) {
			this.elem.css({left:x, top:y});
		}
		,resize: function(w, h) {
			this.elem.css({width:w-4, height:h-4});
		}
		,toggle_maximize: function() {
			if(this.maximized) {
				this.unmaximize();
			} else {
				this.maximize();
			}
			this.maximized = !this.maximized;
		}
		,maximize: function() {
			this.unmaximize_args = [this.xpos(), this.ypos(), this.width(), this.height()];
			this.move_resize(10, 10, Screen.width - 20, Screen.height - 20);
		}
		,unmaximize: function() {
			this.move_resize.apply(this, this.unmaximize_args);
		}
		,move_resize: function(x, y, w, h) {
			$("h3", this.elem).text(this.title + " @ " + Math.round(x) + "," + Math.round(y) + " (" + Math.round(w) + "x" + Math.round(h) +")");
			this.move(x, y);
			this.resize(w, h);
		}
		,width: function() { return this.elem.outerWidth() + 2; }
		,height: function() { return this.elem.outerHeight() + 2; }
		,xpos: function() { return this.elem.position().left + 1; }
		,ypos: function() { return this.elem.position().top + 1; }
		,is_active: function() { return Window.active === this; }
	};
})();

var tiling;
$(function() {
	// prevent jquery from catching our exceptions
	window.setTimeout(function() {
		Screen.width = 800;
		Screen.height = 500;
		$("#screen").css({background: "#dddddd", border: "5px solid #5595ee", width:Screen.width + "px", height:Screen.height + "px", position:"absolute"});
		tiling = new HorizontalTiledLayout(0, 0, Screen.width, Screen.height);
		function new_window() {
			var win = new Window();
			tiling.add(win);
			win.delegate = tiling;
			tiling.tile(win);
		}
		$(document).keydown(function(evt) {
			console.log("key " + evt.keyCode);
			if(evt.shiftKey) {
				switch(evt.keyCode) {
					case 84: tiling.untile(Window.active); break; // t
					case 74: tiling.cycle(1); break; // j
					case 75: tiling.cycle(-1); break; // k
					case 32: tiling.swap_active_with_main(); break; // space
				}
			} else {
				switch(evt.keyCode) {
					case 13: new_window(); break; // enter
					case 65: Window.active.toggleFrontmost(); break; // a
					case 90: Window.active.toggle_maximize(); break; // z
					case 84: tiling.tile(Window.active); break; // t
					case 188: tiling.add_main_window_count(1); break; // , (<)
					case 190: tiling.add_main_window_count(-1); break; // . (>)
					case 74: tiling.select_cycle(1); break; // j
					case 75: tiling.select_cycle(-1); break; // k
					case 72: tiling.adjust_main_window_area(-0.1); break; // h
					case 76: tiling.adjust_main_window_area(0.1); break; // l
					case 85: tiling.adjust_current_window_size(0.1); break; //u
					case 73: tiling.adjust_current_window_size(-0.1); break; //i
					case 81: tiling.on_window_kill(Window.active); Window.active.close(); break; // q
				}
			}
		});
		new_window();
		new_window();
		new_window();
	}, 0);
});


function log(s) { console.log(s); };
