(function() {
  var Axis, HALF, HorizontalTiledLayout, MultiSplit, Split, Tile, TiledWindow, divideAfter, _;
  var __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  divideAfter = function(num, items) {
    return [items.slice(0, num), items.slice(num)];
  };
  Axis = {
    other: function(axis) {
      if (axis === 'y') {
        return 'x';
      } else {
        return 'y';
      }
    }
  };
  _ = function(s) {
    return JSON.stringify(s);
  };
  HALF = 0.5;
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
    return Split;
  })();
  MultiSplit = (function() {
    function MultiSplit(axis, primaryWindows) {
      this.axis = axis;
      this.primaryWindows = primaryWindows;
      this.ratio = HALF;
    }
    MultiSplit.prototype.split = function(bounds, windows) {
      var left_rect, left_windows, right_rect, right_windows, _ref, _ref2, _ref3;
      log("mainsplit: dividing " + windows.length + " after " + this.primaryWindows);
      _ref = divideAfter(this.primaryWindows, windows), left_windows = _ref[0], right_windows = _ref[1];
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
    HorizontalTiledLayout.prototype.each = function(func) {
      var i, _ref, _results;
      log(this.tiles.length);
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
        log("" + tile.window + " == " + win + ", " + i);
        if (tile.window === win) {
          return idx = i;
        }
      });
      log("found window " + win + " at idx " + idx);
      return idx;
    };
    HorizontalTiledLayout.prototype.find_tile = function(win) {
      var idx;
      idx = this.indexOf(win);
      if (idx < 0) {
        throw "couldn't find window: " + window;
      }
      return this.tiles[idx];
    };
    HorizontalTiledLayout.prototype.layout = function() {
      var left, right, _ref;
      _ref = this.mainSplit.split(this.bounds, this.tiles), left = _ref[0], right = _ref[1];
      this.layout_side.apply(this, __slice.call(left).concat([this.splits.left]));
      return this.layout_side.apply(this, __slice.call(right).concat([this.splits.right]));
    };
    HorizontalTiledLayout.prototype.layout_side = function(rect, windows, splits) {
      var axis, extend_to, split, window, zip, _i, _len, _ref, _ref2, _ref3, _results;
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
      _ref = zip(windows, splits);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        _ref2 = _ref[_i], window = _ref2[0], split = _ref2[1];
        _results.push((_ref3 = split.layout_one(rect, windows), rect = _ref3[0], windows = _ref3[1], _ref3));
      }
      return _results;
    };
    HorizontalTiledLayout.prototype.add_main_window_count = function(i) {
      this.mainSplit.primaryWindows += i;
      return this.layout();
    };
    HorizontalTiledLayout.prototype.add = function(win) {
      var tile;
      if (this.contains(win)) {
        return;
      }
      console.log("adding window " + win);
      tile = new TiledWindow(win);
      this.tiles.push(tile);
      return this.layout();
    };
    HorizontalTiledLayout.prototype.active_tile = function(fn) {
      return this.each(function(tile, i) {
        if (tile.window.is_active()) {
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
      var new_pos, removed;
      new_pos = idx + direction;
      if (new_pos < 0 || new_pos >= this.tiles.length) {
        log("pass...");
        return;
      }
      log("moving tile at " + idx + " to " + new_pos);
      removed = this.removeTileAt(idx);
      this.insertTileAt(new_pos, removed);
      return this.layout();
    };
    HorizontalTiledLayout.prototype.remove = function(win) {
      if (!this.contains(win)) {
        return;
      }
      this.removeTileAt(this.indexOf(win));
      return this.layout();
    };
    HorizontalTiledLayout.prototype.insertTileAt = function(idx, tile) {
      this.tiles.splice(idx, 0, tile);
      log("put tile " + tile + " in at " + idx);
      return log(this.tiles);
    };
    HorizontalTiledLayout.prototype.removeTileAt = function(idx) {
      var removed;
      log("removing tile " + idx + " from " + this.tiles);
      removed = this.tiles[idx];
      this.tiles.splice(idx, 1);
      removed.release();
      return removed;
    };
    HorizontalTiledLayout.prototype.log_state = function(lbl) {
      var dump_win;
      dump_win = function(w) {
        return log("   - " + _(w.rect));
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
    }
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
      return this.set_rect(this.original_rect);
    };
    return TiledWindow;
  })();
  window.HorizontalTiledLayout = HorizontalTiledLayout;
  window.Axis = Axis;
  window.Tile = Tile;
  window.Split = Split;
  window.MultiSplit = MultiSplit;
  window.TiledWindow = TiledWindow;
}).call(this);
