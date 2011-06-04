var ArrayUtil, Axis, BaseSplit, HALF, HorizontalTiledLayout, MultiSplit, Split, Tile, TiledWindow, j;
var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
  for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor;
  child.__super__ = parent.prototype;
  return child;
}, __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
Axis = {
  other: function(axis) {
    if (axis === 'y') {
      return 'x';
    } else {
      return 'y';
    }
  }
};
j = function(s) {
  return JSON.stringify(s);
};
HALF = 0.5;
ArrayUtil = {
  divideAfter: function(num, items) {
    return [items.slice(0, num), items.slice(num)];
  },
  moveItem: function(array, start, end) {
    var removed;
    removed = array.splice(start, 1)[0];
    array.splice(end, 0, removed);
    return array;
  }
};
Tile = {
  copyRect: function(rect) {
    return {
      pos: {
        x: rect.pos.x,
        y: rect.pos.y
      },
      size: {
        x: rect.size.x,
        y: rect.size.y
      }
    };
  },
  splitRect: function(rect, axis, ratio) {
    var newRect, newSizeA, newSizeB;
    if (ratio > 1 || ratio < 0) {
      throw "invalid ratio: " + ratio + " (must be between 0 and 1)";
    }
    newSizeA = rect.size[axis] * ratio;
    newSizeB = rect.size[axis] - newSizeA;
    newRect = Tile.copyRect(rect);
    rect = Tile.copyRect(rect);
    rect.size[axis] = newSizeA;
    newRect.size[axis] = newSizeB;
    newRect.pos[axis] += newSizeA;
    return [rect, newRect];
  },
  addDiffToRect: function(rect, diff) {
    return {
      pos: Tile.pointAdd(rect.pos, diff.pos),
      size: Tile.pointAdd(rect.size, diff.size)
    };
  },
  ensureRectExists: function(rect) {
    rect.size.x = Math.max(1, rect.size.x);
    rect.size.y = Math.max(1, rect.size.y);
    return rect;
  },
  zeroRect: function(rect) {
    return rect.pos.x === 0 && rect.pos.y === 0 && rect.size.x === 0 && rect.size.y === 0;
  },
  minmax: function(a, b) {
    return [Math.min(a, b), Math.max(a, b)];
  },
  midpoint: function(a, b) {
    var max, min, _ref;
    _ref = this.minmax(a, b), min = _ref[0], max = _ref[1];
    return Math.round(min + ((max - min) / 2));
  },
  within: function(val, a, b) {
    var max, min, _ref;
    _ref = this.minmax(a, b), min = _ref[0], max = _ref[1];
    return val > min && val < max;
  },
  moveRectWithin: function(original_rect, bounds) {
    var extent, max, min, movement_required, rect, resize_required;
    min = Math.min;
    max = Math.max;
    movement_required = {
      x: 0,
      y: 0
    };
    resize_required = {
      x: 0,
      y: 0
    };
    rect = Tile.copyRect(original_rect);
    rect.size.x = min(rect.size.x, bounds.size.x);
    rect.size.y = min(rect.size.y, bounds.size.y);
    rect.pos.x = max(rect.pos.x, bounds.pos.x);
    rect.pos.y = max(rect.pos.y, bounds.pos.y);
    extent = function(rect, axis) {
      return rect.pos[axis] + rect.size[axis];
    };
    rect.pos.x -= max(0, extent(rect, 'x') - extent(bounds, 'x'));
    rect.pos.y -= max(0, extent(rect, 'y') - extent(bounds, 'y'));
    return {
      pos: this.pointDiff(original_rect.pos, rect.pos),
      size: this.pointDiff(original_rect.size, rect.size)
    };
  },
  pointDiff: function(a, b) {
    return {
      x: b.x - a.x,
      y: b.y - a.y
    };
  },
  pointAdd: function(a, b) {
    return {
      x: a.x + b.x,
      y: a.y + b.y
    };
  },
  rectCenter: function(rect) {
    return {
      x: this.midpoint(rect.pos.x, rect.pos.x + rect.size.x),
      y: this.midpoint(rect.pos.y, rect.pos.y + rect.size.y)
    };
  },
  pointIsWithin: function(point, rect) {
    return this.within(point.x, rect.pos.x, rect.pos.x + rect.size.x) && this.within(point.y, rect.pos.y, rect.pos.y + rect.size.y);
  },
  joinRects: function(a, b) {
    var pos, size, sx, sy;
    pos = {
      x: Math.min(a.pos.x, b.pos.x),
      y: Math.min(a.pos.y, b.pos.y)
    };
    sx = Math.max((a.pos.x + a.size.x) - pos.x, (b.pos.x + b.size.x) - pos.x);
    sy = Math.max((a.pos.y + a.size.y) - pos.y, (b.pos.y + b.size.y) - pos.y);
    size = {
      x: sx,
      y: sy
    };
    return {
      pos: pos,
      size: size
    };
  }
};
BaseSplit = (function() {
  function BaseSplit(axis) {
    this.axis = axis;
    this.ratio = HALF;
  }
  BaseSplit.prototype.adjust_ratio = function(diff) {
    return this.ratio = Math.min(1, Math.max(0, this.ratio + diff));
  };
  BaseSplit.prototype.save_last_rect = function(rect) {
    return this.last_size = rect.size[this.axis];
  };
  BaseSplit.prototype.adjust_ratio_px = function(diff) {
    var current_px, new_px, new_ratio;
    log("adjusting ratio " + this.ratio + " by " + diff + " px");
    current_px = this.ratio * this.last_size;
    log("current ratio makes for " + current_px + " px (assiming last size of " + this.last_size);
    new_px = current_px + diff;
    log("but we want " + new_px);
    new_ratio = new_px / this.last_size;
    if (!Tile.within(new_ratio, 0, 1)) {
      throw new ("failed ratio: " + new_ratio);
    }
    log("which makes a new ratio of " + new_ratio);
    return this.ratio = new_ratio;
  };
  return BaseSplit;
})();
Split = (function() {
  function Split() {
    Split.__super__.constructor.apply(this, arguments);
  }
  __extends(Split, BaseSplit);
  Split.prototype.layout_one = function(rect, windows) {
    var first_window, remaining, window_rect, _ref;
    this.save_last_rect(rect);
    first_window = windows.shift();
    if (windows.length === 0) {
      first_window.set_rect(rect);
      return [{}, []];
    }
    _ref = Tile.splitRect(rect, this.axis, this.ratio), window_rect = _ref[0], remaining = _ref[1];
    first_window.set_rect(window_rect);
    return [remaining, windows];
  };
  Split.prototype.toString = function() {
    return "Split with ratio " + this.ratio;
  };
  return Split;
})();
MultiSplit = (function() {
  __extends(MultiSplit, BaseSplit);
  function MultiSplit(axis, primaryWindows) {
    this.primaryWindows = primaryWindows;
    MultiSplit.__super__.constructor.call(this, axis);
  }
  MultiSplit.prototype.split = function(bounds, windows) {
    var left_rect, left_windows, right_rect, right_windows, _ref, _ref2, _ref3;
    this.save_last_rect(bounds);
    _ref = ArrayUtil.divideAfter(this.primaryWindows, windows), left_windows = _ref[0], right_windows = _ref[1];
    if (left_windows.length > 0 && right_windows.length > 0) {
      _ref2 = Tile.splitRect(bounds, this.axis, this.ratio), left_rect = _ref2[0], right_rect = _ref2[1];
    } else {
      _ref3 = [bounds, bounds], left_rect = _ref3[0], right_rect = _ref3[1];
    }
    return [[left_rect, left_windows], [right_rect, right_windows]];
  };
  MultiSplit.prototype.in_primary_partition = function(idx) {
    return idx < this.primaryWindows;
  };
  return MultiSplit;
})();
HorizontalTiledLayout = (function() {
  var STOP, is_managed;
  STOP = '_stop_iter';
  is_managed = function(tile) {
    return tile.managed;
  };
  function HorizontalTiledLayout(screen_width, screen_height) {
    this.bounds = {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: screen_width,
        y: screen_height
      }
    };
    this.tiles = [];
    this.mainAxis = 'x';
    this.mainSplit = new MultiSplit(this.mainAxis, 1);
    this.splits = {
      left: [],
      right: []
    };
  }
  HorizontalTiledLayout.prototype.each_tiled = function(func) {
    return this.each(function(tile, idx) {
      if (is_managed(tile)) {
        return func(tile, idx);
      }
    });
  };
  HorizontalTiledLayout.prototype.each = function(func) {
    var i, ret, _ref;
    for (i = 0, _ref = this.tiles.length; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
      ret = func(this.tiles[i], i);
      if (ret === STOP) {
        return true;
      }
    }
    return false;
  };
  HorizontalTiledLayout.prototype.contains = function(win) {
    return this.indexOf(win) !== -1;
  };
  HorizontalTiledLayout.prototype.indexOf = function(win) {
    var idx;
    idx = -1;
    this.each(function(tile, i) {
      if (tile.window === win) {
        return idx = i;
      }
    });
    return idx;
  };
  HorizontalTiledLayout.prototype.tile_for = function(win) {
    var idx;
    idx = this.indexOf(win);
    if (idx < 0) {
      throw "couldn't find window: " + window;
    }
    return this.tiles[idx];
  };
  HorizontalTiledLayout.prototype.managed_tiles = function() {
    var tile, _i, _len, _ref, _results;
    _ref = this.tiles;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      tile = _ref[_i];
      if (is_managed(tile)) {
        _results.push(tile);
      }
    }
    return _results;
  };
  HorizontalTiledLayout.prototype.layout = function() {
    var left, right, _ref;
    _ref = this.mainSplit.split(this.bounds, this.managed_tiles()), left = _ref[0], right = _ref[1];
    this.layout_side.apply(this, __slice.call(left).concat([this.splits.left]));
    return this.layout_side.apply(this, __slice.call(right).concat([this.splits.right]));
  };
  HorizontalTiledLayout.prototype.layout_side = function(rect, windows, splits) {
    var axis, extend_to, previous_split, split, window, zip, _i, _len, _ref, _ref2, _ref3, _results;
    axis = Axis.other(this.mainAxis);
    extend_to = function(size, array, generator) {
      var _results;
      _results = [];
      while (array.length < size) {
        _results.push(array.push(generator()));
      }
      return _results;
    };
    zip = function(a, b) {
      var i, _ref, _results;
      _results = [];
      for (i = 0, _ref = Math.min(a.length, b.length); (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
        _results.push([a[i], b[i]]);
      }
      return _results;
    };
    extend_to(windows.length, splits, function() {
      return new Split(axis);
    });
    previous_split = null;
    _ref = zip(windows, splits);
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], window = _ref2[0], split = _ref2[1];
      window.top_split = previous_split;
      _ref3 = split.layout_one(rect, windows), rect = _ref3[0], windows = _ref3[1];
      if (window.just_moved) {
        window.ensure_within(this.bounds);
        window.just_moved = false;
      }
      window.bottom_split = windows.length > 0 ? split : null;
      _results.push(previous_split = split);
    }
    return _results;
  };
  HorizontalTiledLayout.prototype.add_main_window_count = function(i) {
    this.mainSplit.primaryWindows += i;
    return this.layout();
  };
  HorizontalTiledLayout.prototype._modify_tiles = function(fn) {
    var i, new_tiles, orig_tiles, _ref;
    orig_tiles = this.managed_tiles().slice();
    fn.apply(this);
    new_tiles = this.managed_tiles();
    for (i = 0, _ref = Math.max(orig_tiles.length, new_tiles.length); (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
      if (orig_tiles[i] !== new_tiles[i]) {
        this._mark_tiles_as_moved(new_tiles.slice(i));
        break;
      }
    }
    return this.layout();
  };
  HorizontalTiledLayout.prototype.tile = function(win) {
    this._modify_tiles(function() {
      return this.tile_for(win).tile();
    });
    return this.layout();
  };
  HorizontalTiledLayout.prototype.select_cycle = function(offset) {
    return this.active_tile(__bind(function(tile, idx) {
      log("Active tile == " + idx + ", " + tile.window.title);
      return this.tiles[this.wrap_index(idx + offset)].activate();
    }, this));
  };
  HorizontalTiledLayout.prototype.wrap_index = function(idx) {
    while (idx < 0) {
      idx += this.tiles.length;
    }
    while (idx >= this.tiles.length) {
      idx -= this.tiles.length;
    }
    return idx;
  };
  HorizontalTiledLayout.prototype.add = function(win) {
    if (this.contains(win)) {
      return;
    }
    log("adding window to layout: " + win);
    this._modify_tiles(function() {
      var tile;
      tile = new TiledWindow(win);
      return this.tiles.push(tile);
    });
    return this.layout();
  };
  HorizontalTiledLayout.prototype.active_tile = function(fn) {
    var found;
    found = this.each(function(tile, i) {
      if (tile.window.is_active()) {
        fn(tile, i);
        return STOP;
      }
    });
    if (!found) {
      return log("could not find active window!");
    }
  };
  HorizontalTiledLayout.prototype.cycle = function(int) {
    return this.active_tile(__bind(function(tile, idx) {
      return this._cycle(idx, int);
    }, this));
  };
  HorizontalTiledLayout.prototype._cycle = function(idx, direction) {
    var new_pos;
    new_pos = this.wrap_index(idx + direction);
    return this._swap_windows_at(idx, new_pos);
  };
  HorizontalTiledLayout.prototype.adjust_main_window_area = function(diff) {
    this.mainSplit.adjust_ratio(diff);
    return this.layout();
  };
  HorizontalTiledLayout.prototype.adjust_current_window_size = function(diff) {
    return this.active_tile(__bind(function(tile) {
      this.adjust_split_for_tile({
        tile: tile,
        diff_ratio: diff,
        axis: Axis.other(this.mainAxis)
      });
      return this.layout();
    }, this));
  };
  HorizontalTiledLayout.prototype.adjust_split_for_tile = function(opts) {
    var adjust, axis, diff_px, diff_ratio, tile;
    axis = opts.axis, diff_px = opts.diff_px, diff_ratio = opts.diff_ratio, tile = opts.tile;
    adjust = function(split, inverted) {
      if (diff_px != null) {
        return split.adjust_ratio_px(inverted ? -diff_px : diff_px);
      } else {
        return split.adjust_ratio(inverted ? -diff_ratio : diff_ratio);
      }
    };
    if (axis === this.mainAxis) {
      return adjust(this.mainSplit, !this.mainSplit.in_primary_partition(this.tiles.indexOf(tile)));
    } else {
      if (tile.bottom_split != null) {
        return adjust(tile.bottom_split, false);
      } else if (tile.top_split != null) {
        return adjust(tile.top_split, true);
      }
    }
  };
  HorizontalTiledLayout.prototype.swap_active_with_main = function() {
    return this.active_tile(__bind(function(tile, idx) {
      var current_main;
      if (idx === 0) {
        return;
      }
      current_main = this.tiles[0];
      return this._swap_windows_at(0, idx);
    }, this));
  };
  HorizontalTiledLayout.prototype.untile = function(win) {
    return this._modify_tiles(function() {
      return this.tile_for(win).release();
    });
  };
  HorizontalTiledLayout.prototype._remove_tile_at = function(idx) {
    var removed;
    removed = this.tiles[idx];
    this._modify_tiles(function() {
      this.tiles.splice(idx, 1);
      return removed.release();
    });
    this.layout();
    return removed;
  };
  HorizontalTiledLayout.prototype.on_window_created = function(win) {
    return this.add(win);
  };
  HorizontalTiledLayout.prototype.on_window_killed = function(win) {
    return this._remove_tile_at(this.indexOf(win));
  };
  HorizontalTiledLayout.prototype.on_window_moved = function(win) {
    var idx, tile;
    idx = this.indexOf(win);
    tile = this.tiles[idx];
    this.swap_moved_tile_if_necessary(tile, idx);
    tile.update_offset();
    return this.layout();
  };
  HorizontalTiledLayout.prototype.on_split_resize_start = function(win) {
    this.split_resize_start_rect = Tile.copyRect(this.tiles[this.indexOf(win)].window_rect());
    return log("starting resize of split.. " + (j(this.split_resize_start_rect)));
  };
  HorizontalTiledLayout.prototype.on_window_resized = function(win) {
    var diff, tile;
    tile = this.tiles[this.indexOf(win)];
    if (this.split_resize_start_rect != null) {
      diff = Tile.pointDiff(this.split_resize_start_rect.size, tile.window_rect().size);
      log("split resized! diff = " + (j(diff)));
      if (diff.x !== 0) {
        this.adjust_split_for_tile({
          tile: tile,
          diff_px: diff.x,
          axis: 'x'
        });
      }
      if (diff.y !== 0) {
        this.adjust_split_for_tile({
          tile: tile,
          diff_px: diff.y,
          axis: 'y'
        });
      }
      this.split_resize_start_rect = null;
    } else {
      tile.update_offset();
    }
    this.layout();
    return true;
  };
  HorizontalTiledLayout.prototype.swap_moved_tile_if_necessary = function(tile, idx) {
    var center;
    center = Tile.rectCenter(tile.window_rect());
    return this.each_tiled(__bind(function(swap_candidate, swap_idx) {
      log("(midpoint " + (j(center)) + ") within " + (j(swap_candidate.rect)) + "?");
      if (swap_idx === idx) {
        return;
      }
      if (Tile.pointIsWithin(center, swap_candidate.rect)) {
        log("YES - swapping idx " + idx + " and " + swap_idx);
        this._swap_windows_at(idx, swap_idx);
        return STOP;
      }
    }, this));
  };
  HorizontalTiledLayout.prototype._swap_windows_at = function(idx1, idx2) {
    return this._modify_tiles(function() {
      var _orig;
      _orig = this.tiles[idx2];
      this.tiles[idx2] = this.tiles[idx1];
      return this.tiles[idx1] = _orig;
    });
  };
  HorizontalTiledLayout.prototype._mark_tiles_as_moved = function(tiles) {
    var tile, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = tiles.length; _i < _len; _i++) {
      tile = tiles[_i];
      _results.push(tile.just_moved = true);
    }
    return _results;
  };
  HorizontalTiledLayout.prototype.log_state = function(lbl) {
    var dump_win;
    dump_win = function(w) {
      return log("   - " + j(w.rect));
    };
    log(" -------------- layout ------------- ");
    log(" // " + lbl);
    log(" - total windows: " + this.tiles.length);
    log("");
    log(" - main windows: " + this.mainsplit.primaryWindows);
    this.main_windows().map(dump_win);
    log("");
    log(" - minor windows: " + this.tiles.length - this.mainsplit.primaryWindows);
    this.minor_windows().map(dump_win);
    return log(" ----------------------------------- ");
  };
  return HorizontalTiledLayout;
})();
TiledWindow = (function() {
  function TiledWindow(win) {
    this.window = win;
    this.original_rect = this.window_rect();
    this.rect = {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 0,
        y: 0
      }
    };
    this.reset_offset();
    this.maximized_rect = null;
    this.volatile = false;
    this.managed = false;
  }
  TiledWindow.prototype.tile = function() {
    this.managed = true;
    return this.reset_offset();
  };
  TiledWindow.prototype.reset_offset = function() {
    return this.offset = {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 0,
        y: 0
      }
    };
  };
  TiledWindow.prototype.snap_to_screen = function() {
    return true;
  };
  TiledWindow.prototype.update_offset = function() {
    var rect, win;
    rect = this.rect;
    win = this.window_rect();
    this.offset = {
      pos: Tile.pointDiff(rect.pos, win.pos),
      size: Tile.pointDiff(rect.size, win.size)
    };
    return log("updated tile offset to " + (j(this.offset)));
  };
  TiledWindow.prototype.window_rect = function() {
    return {
      pos: {
        x: this.window.xpos(),
        y: this.window.ypos()
      },
      size: {
        x: this.window.width(),
        y: this.window.height()
      }
    };
  };
  TiledWindow.prototype.toggle_maximize = function(rect) {
    if (this.maximized_rect) {
      return this.unmaximize();
    } else {
      return this.maximize(rect);
    }
  };
  TiledWindow.prototype.maximize = function(rect) {
    this.maximized_rect = rect;
    return this.layout();
  };
  TiledWindow.prototype.unmaximize = function() {
    this.maximized_rect = null;
    return this.layout();
  };
  TiledWindow.prototype._resize = function(size) {
    return this.rect.size = {
      x: size.x,
      y: size.y
    };
  };
  TiledWindow.prototype._move = function(pos) {
    return this.rect.pos = {
      x: pos.x,
      y: pos.y
    };
  };
  TiledWindow.prototype.set_rect = function(r) {
    this._resize(r.size);
    this._move(r.pos);
    return this.layout();
  };
  TiledWindow.prototype.ensure_within = function(screen_rect) {
    var change_required, combined_rect;
    combined_rect = Tile.addDiffToRect(this.rect, this.offset);
    change_required = Tile.moveRectWithin(combined_rect, screen_rect);
    if (!Tile.zeroRect(change_required)) {
      log("old offset = " + (j(this.offset)));
      log("moving tile " + (j(change_required)) + " to keep it onscreen");
      this.offset = Tile.addDiffToRect(this.offset, change_required);
      log("now offset = " + (j(this.offset)));
      return this.layout();
    }
  };
  TiledWindow.prototype.layout = function() {
    var pos, rect, size, _ref;
    rect = this.maximized_rect || Tile.addDiffToRect(this.rect, this.offset);
    _ref = Tile.ensureRectExists(rect), pos = _ref.pos, size = _ref.size;
    log("laying out window @ " + j(pos) + " :: " + j(size));
    return this.window.move_resize(false, pos.x, pos.y, size.x, size.y);
  };
  TiledWindow.prototype.set_volatile = function() {
    return this.volatile = true;
  };
  TiledWindow.prototype.release = function() {
    this.set_rect(this.original_rect);
    return this.managed = false;
  };
  TiledWindow.prototype.activate = function() {
    this.window.activate();
    return this.window.bringToFront();
  };
  return TiledWindow;
})();
if (typeof log == "undefined" || log === null) {
  if (typeof reqire != "undefined" && reqire !== null) {
    log = require('util').log;
  } else {
    if (typeof console != "undefined" && console !== null) {
      log = function(s) { console.log(s); };
    } else {
      log = function(s) { };
    }
  }
}