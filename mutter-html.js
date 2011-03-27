Screen = {
	width: 800,
	height: 600,
}

function Window() { this._init(); }
(function() {
	var dim = 0.8;
	var bright = 1;
	var active_border = "#bb2222";
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
			} else {
				item.deactivate();
			}
		});
		logstack("restacked");
	}
	function logstack(msg) {
		msg = msg ? msg + ": " : "";
		console.log(msg + "Stack contains: " + $.map(stack, function(w) { return w.title; }).join(","));
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
			console.log("init window!");
			self.title = "Window " + winCount;
			self.elem = $("<div><h3>" + self.title + "</h3><p>...</p></div>");
			winCount += 1;
			$("body").append(self.elem);
			var size = 200;
			var left = random(0, Screen.width - size);
			var top = random(0, Screen.height - size);
			self.elem.resizable().draggable();
			self.elem.mouseover(function() { self.activate(); });
			self.elem.mouseout(function() { self.deactivate(); });
			self.elem.css({background: randomColor(), position:"absolute", width:size, height:size, left:left, top:top, border: "2px solid black", opacity:dim});
			self.elem.mousedown(function() { self.bringToFront(); });
			stack.push(self);
			restack();
		}
		,index:function() {
			var idx = stack.indexOf(this);
			if (idx < 0) throw("window not in stack! I am " + this.title + ", windows are " + logstack());
			return idx;
		}
		,_removeFromStack: function() {
			logstack();
			stack.splice(this.index(), 1);
			logstack();
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
		}
		,bringToFront: function() {
			this._removeFromStack();
			stack.push(this);
			restack();
		}
		,activate: function() {
			this.elem.css({"border-color": active_border, opacity: bright});
			Window.active = this;
		}
		,deactivate: function() {
			this.elem.css({"border-color": inactive_border, opacity: dim});
		}
		,move: function(user_action, x, y) {
			this.elem.css({left:x+5, top:y+5});
		}
		,resize: function(user_action, w, h) {
			this.elem.css({width:w-4, height:h-4});
		}
		,move_resize: function(user_action, x, y, w, h) {
			this.move(user_action, x, y);
			this.resize(user_action, w, h);
		}
		,width: function() { return this.elem.outerWidth(); }
		,height: function() { return this.elem.outerHeight(); }
		,xpos: function() { return this.elem.offset().left; }
		,ypos: function() { return this.elem.offset().top; }
	};
})();

var tiling;
$(function() {
	// Screen.width = $(document).width();
	// Screen.height = $(document).height();
	Screen.width = 500;
	Screen.height = 500;
	$("body").append($("<div style=\"background: #dddddd; border: 5px solid #5595ee; width:500px; height:500px;\"/>"));
	tiling = new HorizontalTiledLayout(Screen.width, Screen.height);
	$(document).keydown(function(evt) {
		console.log("key " + evt.keyCode);
		if(evt.shiftKey) {
			switch(evt.keyCode) {
				case 84: tiling.remove(Window.active); break; // t
			}
		} else {
			switch(evt.keyCode) {
				case 13: new Window(); break; // enter
				case 90: Window.active.toggleFrontmost(); break; // z
				case 84: tiling.add(Window.active); break; // t
				case 188: tiling.add_main_window_count(1); break; // , (<)
				case 190: tiling.add_main_window_count(-1); break; // . (>)
				case 74: Window.cycle(-1); break; // j
				case 75: Window.cycle(1); break; // k
			}
		}
	});
	new Window();
	new Window();
	new Window();
});


function log(s) { console.log(s); };
