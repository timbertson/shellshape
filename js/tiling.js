(function() {
  var ArrayUtil, Axis, HALF, HorizontalTiledLayout, MultiSplit, Split, Tile, TiledWindow, exports, j, log;
  var __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
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
  Split = (function() {
    function Split(axis) {
      this.axis = axis;
      this.ratio = HALF;
    }
    Split.prototype.layout_one = function(rect, windows) {
      var first_window, remaining, window_rect, _ref;
      first_window = windows.shift();
      if (windows.length === 0) {
        first_window.set_rect(rect);
        return [{}, []];
      }
      _ref = Tile.splitRect(rect, this.axis, this.ratio), window_rect = _ref[0], remaining = _ref[1];
      first_window.set_rect(window_rect);
      return [remaining, windows];
    };
    Split.prototype.adjust_ratio = function(diff) {
      this.ratio = Math.min(1, Math.max(0, this.ratio + diff));
      return log("ratio is now " + this.ratio);
    };
    Split.prototype.toString = function() {
      return "Split with ratio " + this.ratio;
    };
    return Split;
  })();
  MultiSplit = (function() {
    function MultiSplit(axis, primaryWindows) {
      this.axis = axis;
      this.primaryWindows = primaryWindows;
      this.ratio = HALF;
    }
    MultiSplit.prototype.adjust_ratio = function(diff) {
      return this.ratio = Math.min(1, Math.max(0, this.ratio + diff));
    };
    MultiSplit.prototype.split = function(bounds, windows) {
      var left_rect, left_windows, right_rect, right_windows, _ref, _ref2, _ref3;
      _ref = ArrayUtil.divideAfter(this.primaryWindows, windows), left_windows = _ref[0], right_windows = _ref[1];
      if (left_windows.length > 0 && right_windows.length > 0) {
        _ref2 = Tile.splitRect(bounds, this.axis, this.ratio), left_rect = _ref2[0], right_rect = _ref2[1];
      } else {
        _ref3 = [bounds, bounds], left_rect = _ref3[0], right_rect = _ref3[1];
      }
      return [[left_rect, left_windows], [right_rect, right_windows]];
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
      var i, _ref, _results;
      _results = [];
      for (i = 0, _ref = this.tiles.length; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
        _results.push(is_managed(this.tiles[i]) ? func(this.tiles[i], i) : void 0);
      }
      return _results;
    };
    HorizontalTiledLayout.prototype.each = function(func) {
      var i, _ref, _results;
      _results = [];
      for (i = 0, _ref = this.tiles.length; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
        _results.push(func(this.tiles[i], i));
      }
      return _results;
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
      return _.select(this.tiles, is_managed);
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
        window.bottom_split = windows.length > 0 ? split : null;
        _results.push(previous_split = split);
      }
      return _results;
    };
    HorizontalTiledLayout.prototype.add_main_window_count = function(i) {
      this.mainSplit.primaryWindows += i;
      return this.layout();
    };
    HorizontalTiledLayout.prototype.tile = function(win) {
      this.tile_for(win).tile();
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
      var tile;
      if (this.contains(win)) {
        return;
      }
      log("adding window " + win);
      tile = new TiledWindow(win);
      this.tiles.push(tile);
      return this.layout();
    };
    HorizontalTiledLayout.prototype.active_tile = function(fn) {
      var first;
      first = true;
      return this.each(function(tile, i) {
        if (tile.window.is_active()) {
          log(first);
          if (!first) {
            return;
          }
          first = false;
          return fn(tile, i);
        }
      });
    };
    HorizontalTiledLayout.prototype.cycle = function(int) {
      return this.active_tile(__bind(function(tile, idx) {
        return this._cycle(idx, int);
      }, this));
    };
    HorizontalTiledLayout.prototype._cycle = function(idx, direction) {
      var new_pos;
      new_pos = this.wrap_index(idx + direction);
      log("moving tile at " + idx + " to " + new_pos);
      ArrayUtil.moveItem(this.tiles, idx, new_pos);
      return this.layout();
    };
    HorizontalTiledLayout.prototype.adjust_main_window_area = function(diff) {
      this.mainSplit.adjust_ratio(diff);
      return this.layout();
    };
    HorizontalTiledLayout.prototype.adjust_current_window_size = function(diff) {
      return this.active_tile(__bind(function(tile) {
        log("btm split: " + tile.bottom_split);
        log("top split: " + tile.top_split);
        if (tile.bottom_split) {
          tile.bottom_split.adjust_ratio(diff);
        } else if (tile.top_split) {
          tile.top_split.adjust_ratio(-diff);
        }
        return this.layout();
      }, this));
    };
    HorizontalTiledLayout.prototype.swap_active_with_main = function() {
      return this.active_tile(__bind(function(tile, idx) {
        var current_main;
        if (idx === 0) {
          return;
        }
        current_main = this.tiles[0];
        this.tiles[0] = this.tiles[idx];
        this.tiles[idx] = current_main;
        return this.layout();
      }, this));
    };
    HorizontalTiledLayout.prototype.untile = function(win) {
      this.tile_for(win).release();
      return this.layout();
    };
    HorizontalTiledLayout.prototype._remove_tile_at = function(idx) {
      var removed;
      removed = this.tiles[idx];
      this.tiles.splice(idx, 1);
      removed.release();
      return removed;
    };
    HorizontalTiledLayout.prototype.on_window_created = function(win) {
      return this.add(win);
    };
    HorizontalTiledLayout.prototype.on_window_killed = function(win) {
      return this._remove_tile_at(this.indexOf(win));
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
      this.original_rect = {
        pos: {
          x: win.xpos(),
          y: win.ypos()
        },
        size: {
          x: win.width(),
          y: win.height()
        }
      };
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
      this.maximized_rect = null;
      this.managed = false;
    }
    TiledWindow.prototype.tile = function() {
      return this.managed = true;
    };
    TiledWindow.prototype.move = function(pos) {
      return this.window.move(false, pos.x, pos.y);
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
    TiledWindow.prototype.resize = function(size) {
      return this.window.resize(false, size.x, size.y);
    };
    TiledWindow.prototype.set_rect = function(r) {
      return this.window.move_resize(false, r.pos.x, r.pos.y, r.size.x, r.size.y);
    };
    TiledWindow.prototype.layout = function() {
      return this.set_rect(this.maximized_rect || this.rect);
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
  if (typeof reqire != "undefined" && reqire !== null) {
    log = require('util').log;
  } else {
    log = function(s) {
      if (typeof console != "undefined" && console !== null) {
        return console.log(s);
      }
    };
  }
  if ((typeof window != "undefined" && window !== null) && !(typeof exports != "undefined" && exports !== null)) {
    exports = window;
  }
  exports.HorizontalTiledLayout = HorizontalTiledLayout;
  exports.Axis = Axis;
  exports.Tile = Tile;
  exports.Split = Split;
  exports.MultiSplit = MultiSplit;
  exports.TiledWindow = TiledWindow;
  exports.ArrayUtil = ArrayUtil;
}).call(this);
