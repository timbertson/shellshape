// run shellshape tiling in a browser window (for testing)

/// <reference path="shim.ts" />
/// <reference path="tiling.ts" />
/// <reference path="logging.ts" />
/// <reference path="window.ts" />

var tiling;
$(function() {
	// prevent jquery from catching our exceptions
	window.setTimeout(function() {
		window.onerror = function(e) {
			alert("Error: " + e);
		}

		var Viewport = BrowserWindow.Viewport;

		Tiling.get_mouse_position = (function() {
			var pos = {x: 0, y:0};
			document.onmousemove = handleMouseMove;
			function handleMouseMove(event) {
					// Use event.pageX / event.pageY here
					pos.x = event.pageX;
					pos.y = event.pageY;
			};
			return function() { return pos; };
		})()

		Viewport.size.x = 800;
		Viewport.size.y = 500;
		var logger = Logging.getLogger("shellshape");

		$("#screen").css({background: "#dddddd", border: "5px solid #5595ee", width:Viewport.size.x + "px", height:Viewport.size.y + "px", position:"absolute"});
		var state = new Tiling.LayoutState(BrowserWindow.Viewport);

		tiling = new Tiling.VerticalTiledLayout(state);
		function new_window() {
			var win = new BrowserWindow.Window();
			tiling.add(win);
			win.delegate = tiling;
			tiling.tile(win);
		}
		$(document).keydown(function(evt) {
			logger.debug("key " + evt.keyCode + ", shift pressed = " + evt.shiftKey);
			if(evt.shiftKey) {
				switch(evt.keyCode) {
					case 74: tiling.cycle(1); break; // j
					case 75: tiling.cycle(-1); break; // k
					case 32: tiling.swap_active_with_main(); break; // space
					case 80: tiling.adjust_splits_to_fit(BrowserWindow.active); break; // p
				}
			} else {
				switch(evt.keyCode) {
					case 13: new_window(); break; // enter
					case 65: BrowserWindow.active.toggleFrontmost(); break; // a
					case 90: BrowserWindow.active.toggle_maximize(); break; // z
					case 80: tiling.tile(BrowserWindow.active); break; // p
					case 89: tiling.untile(BrowserWindow.active); break; // y
					case 187: tiling.scale_current_window(+Tiling.WINDOW_ONLY_RESIZE_INCREMENT); break; // = (+)
					case 189: tiling.scale_current_window(-Tiling.WINDOW_ONLY_RESIZE_INCREMENT); break; // = (+)
					case 188: tiling.add_main_window_count(1); break; // , (<)
					case 190: tiling.add_main_window_count(-1); break; // . (>)
					case 74: tiling.select_cycle(1); break; // j
					case 75: tiling.select_cycle(-1); break; // k
					case 72: tiling.adjust_main_window_area(-0.1); break; // h
					case 76: tiling.adjust_main_window_area(0.1); break; // l
					case 85: tiling.adjust_current_window_size(0.1); break; //u
					case 73: tiling.adjust_current_window_size(-0.1); break; //i
					case 81: tiling.on_window_kill(BrowserWindow.active); BrowserWindow.active.close(); break; // q
				}
			}
		});
		new_window();
		new_window();
		new_window();
	}, 0);
});

