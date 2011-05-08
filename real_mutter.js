function Window() { this._init(); }
(function() {
	var winCount = 1;
	var stack = [];

	Window.cycle = function(direction) {
		if(direction == 1) {
			stack[stack.length-1].sendToBack();
		} else {
			stack[0].bringToFront();
		}
	};
	Window.prototype = {
		_init: function() {
		}
		,index:function() {
			var idx = stack.indexOf(this);
			if (idx < 0) throw("window not in stack! I am " + this.title + ", windows are " + logstack());
			return idx;
		}
		,close: function() {
		}
		,_removeFromStack: function() {
			stack.splice(this.index(), 1);
		}
		,toggleFrontmost: function() {
		}
		,sendToBack: function() {
		}
		,bringToFront: function() {
		}
		,activate: function() {
		}
		,deactivate: function() {
		}
		,move: function(user_action, x, y) {
		}
		,resize: function(user_action, w, h) {
		}
		,toggle_maximize: function() {
		}
		,maximize: function() {
		}
		,unmaximize: function() {
		}
		,move_resize: function(user_action, x, y, w, h) {
		}
		,width: function() { return this.elem.outerWidth() + 2; }
		,height: function() { return this.elem.outerHeight() + 2; }
		,xpos: function() { return this.elem.position().left + 1; }
		,ypos: function() { return this.elem.position().top + 1; }
		,is_active: function() { return Window.active === this; }
	};
})();

/*
$(function() {
	// prevent jquery from catching our exceptions
	window.setTimeout(function() {
		function new_window() {
			var win = new Window();
			tiling.on_window_created(win);
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
*/
