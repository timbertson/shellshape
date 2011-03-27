var Axis = {
	other: function(axis) { return axis == 'y' ? 'x' : 'y'; }
}

function _(s) {
	return JSON.stringify(s);
};

var HALF = 0.5;

var Tile = {
	copyRect: function(rect) {
		return {pos:{x:rect.pos.x, y:rect.pos.y}, size:{x:rect.size.x, y:rect.size.y}};
	}
	,splitRect: function(rect, axis, ratio) {
		log("#splitRect: splitting rect of " + _(rect) + " along the " + axis + " axis with ratio " + ratio);
		if(ratio > 1 || ratio < 0) {
			throw("invalid ratio: " + ratio + " (must be between 0 and 1)");
		}
		var newSizeA = rect.size[axis] * ratio;
		var newSizeB = rect.size[axis] - newSizeA;

		var newRect = Tile.copyRect(rect);
		rect = Tile.copyRect(rect);
		rect.size[axis] = newSizeA;
		newRect.size[axis] = newSizeB;
		newRect.pos[axis] += newSizeA;
		log("rect copy: " + _(rect));
		log("newRect: " + _(newRect));
		return [rect, newRect];
	}
	,joinRects: function(a, b) {
		var pos = {
		    x: Math.min(a.pos.x, b.pos.x),
		    y: Math.min(a.pos.y, b.pos.y)};

		var sx = Math.max((a.pos.x + a.size.x) - pos.x, (b.pos.x + b.size.x) - pos.x);
		var sy = Math.max((a.pos.y + a.size.y) - pos.y, (b.pos.y + b.size.y) - pos.y);
		var size = {x: sx, y: sy};
		return {pos: pos, size: size};
	}
}

function HorizontalTiledLayout(w, h) { this._init(w, h); }
HorizontalTiledLayout.prototype = {
	_init : function(screen_width, screen_height) {
		this.bounds = {pos:{x:0, y:0}, size:{x:screen_width, y:screen_height}};
		this.tiles = [];
		this.layout = {
			regions: 2,
			major_axis: 'x',
			minor_axis: 'y',
			windows_in_main_region: 1,
			major_ratio: 0.5
		};
	}

	,each: function(func) {
		for(i=0; i<this.tiles.length; i++) {
			func.call(null, this.tiles[i], i);
		}
	}

	,contains : function(win) {
		return this.indexOf(win) != -1;
	}

	,indexOf: function(win) {
		var idx = -1;
		this.each(function(tile, i) { if(tile.window === win) { idx = i; } });
		return idx;
	}

	,add : function(win) {
		if(this.contains(win)) { return; }
		console.log("adding window " + win);
		var new_tile = new TiledWindow(win);
		if(this.tiles.length == 0) {
			new_tile.rect = Tile.copyRect(this.bounds);
			log(_(new_tile.rect));
			log(_(this.bounds));
			this.tiles.push(new_tile);
			new_tile.layout();
		} else {
			var splittable_tile = this.tiles[this.tiles.length - 1];

			//TODO...
			var axis = this.layout.minor_axis;
			if(this.tiles.length == this.layout.windows_in_main_region) {
				axis = this.layout.major_axis;
			}

			// log(_(splittable_tile));
			var tile_pair = Tile.splitRect(splittable_tile.rect, axis, 0.5);
			if(axis == this.layout.major_axis) {
				this.main_windows().map(function(win) { win.rect.size[axis] = tile_pair[0].size[axis]; win.layout() });
			}
			splittable_tile.rect = tile_pair[0];
			new_tile.rect = tile_pair[1];
			this.log_state("pre add");
			this.tiles.splice(this.tiles.length - 1, 1, splittable_tile, new_tile);
			this.log_state("post add");

			splittable_tile.layout();
			new_tile.layout();
		}
	}

	,main_windows: function() {
		return this.tiles.slice(0, this.layout.windows_in_main_region);
	}
	,minor_windows: function() {
		return this.tiles.slice(this.layout.windows_in_main_region);
	}
	,major_axis: function() { return this.layout.major_axis; }

	,set_major_ratio: function(new_ratio) {
		this.log_state("prior to setting major ratio to " + new_ratio);
		if(this.minor_windows().length > 0) {
			this.layout.major_ratio = new_ratio;
			var axis = this.major_axis();
			var sz = this.bounds.size[axis];
			var new_main_size = sz * new_ratio;
			var new_minor_size = sz - new_main_size;
			this.minor_windows().map(function(win) {
				win.rect.size[axis] = new_minor_size;
				win.rect.pos[axis] = new_main_size;
			});
			this.main_windows().map(function(win) {
				win.rect.size[axis] = new_main_size;
			});
			this.layout_all();
			this.log_state("ratio is now " + new_ratio + ", making split of " + new_main_size + " | " + new_minor_size);
		}
	}

	,add_main_window_count: function(addition) {
		addition = (addition > 0) ? 1 : -1;
		this.log_state("before adding " + addition + " to main window count")
		var old_num = this.layout.windows_in_main_region;
		this.layout.windows_in_main_region += addition;
		var new_num = this.layout.windows_in_main_region;
		if (addition > 0) {
			var win = this.remove_window_at(old_num);
			if(win != null) {
				var splittable_tile = this.tiles[old_num-1];
				log("splittable tile: " + _(splittable_tile))
				this.split_tile(splittable_tile, win, this.layout.minor_axis, HALF);
			}
		} else {
			// addition = -1
			var win = this.remove_window_at(new_num);
			if (win != null) {
				var splittable_tile = this.tiles[old_num];
				this.split_tile(splittable_tile, win, this.layout.minor_axis, HALF);
			}
		}
		this.log_state("after adding " + addition + " to main window count")
	}

	,remap: function() {
		// recalculate window layout
		
	}

	,remove: function(win) {
		if(!this.contains(win)) return;
		log("removing window: " + win);
		var idx = this.indexOf(win);
		this.tiles[idx].release();
		this.tiles.splice(idx, 1);
		this.remap();
	}

	,split_tile: function(splittable, additional, axis, ratio) {
		// var [splittable_rect, additional_rect] = Tile.splitRect(splittable.rect, axis, ratio);
		var _tuple = Tile.splitRect(splittable.rect, axis, ratio);
		var splittable_rect = _tuple[0];
		var additional_rect = _tuple[1];
		splittable.rect = splittable_rect;
		additional.rect = additional_rect;
		[splittable, additional].map(function(w) { w.layout(); });
	}

	,remove_window_at:function(idx) {
		if(this.tiles.length <= idx) {
			return null;
		}
		var removed = this.tiles[idx];
		this.tiles.splice(idx, 1);
		return removed;
	}

	,in_main_section: function(idx){
		return idx < this.layout.windows_in_main_region;
	}


	,layout_all: function() {
		this.tiles.map(function(w) { w.layout(); });
	}
	,log_state: function(lbl) {
		var dump_win = function(w) {
			log("   - " + _(w.rect));
		};

		log(" -------------- layout ------------- ");
		log(" // " + lbl);
		log(" - layout: " + _(this.layout));
		log(" - total windows: " + this.tiles.length);
		log("")
		log(" - main windows: " + this.main_windows().length);
		// log(_(this.tiles))
		this.main_windows().map(dump_win);
		log("")
		log(" - minor windows: " + this.minor_windows().length);
		this.minor_windows().map(dump_win);
		log(" ----------------------------------- ");
	}
}


function TiledWindow(win) { this._init(win); }
TiledWindow.prototype = {
	// notes:
	// - what is a unique key for a window? 
	//   sm_client_id?
	//   startup_id?
	//   net_wm_pid?

	_init : function(win) {
		this.window = win;
		this.original_rect = {pos: {x:win.xpos(), y:win.ypos()}, size: {x:win.width(), y:win.height()}};
		this.rect = {pos:{x:0, y:0}, size:{x:0, y:0}};
	}
	,move : function(pos) {
		this.window.move(false, pos.x, pos.y);
	}
	,resize : function(size) {
		this.window.resize(false, size.x, size.y);
	}
	,set_rect : function(r) {
		log("Setting rect to " + r)
		this.window.move_resize(false, r.pos.x, r.pos.y, r.size.x, r.size.y);
	}
	,layout: function() {
		this.set_rect(this.rect);
	}
	,release: function() {
		this.set_rect(this.original_rect);
	}
}

