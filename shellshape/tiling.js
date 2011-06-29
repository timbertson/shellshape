var ArrayUtil, Axis, BaseSplit, HALF, HorizontalTiledLayout, MultiSplit, STOP, Split, Tile, TileCollection, TiledWindow, contains, export_to, get_mouse_position, j;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
  for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor;
  child.__super__ = parent.prototype;
  return child;
}, __slice = Array.prototype.slice;
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
STOP = '_stop_iter';
ArrayUtil = {
  divide_after: function(num, items) {
    return [items.slice(0, num), items.slice(num)];
  },
  moveItem: function(array, start, end) {
    var removed;
    removed = array.splice(start, 1)[0];
    array.splice(end, 0, removed);
    return array;
  }
};
contains = function(arr, item) {
  return arr.indexOf(item) !== -1;
};
get_mouse_position = function() {
  throw "override get_mouse_position()";
};
Tile = {
  copy_rect: function(rect) {
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
  split_rect: function(rect, axis, ratio) {
    var new_rect, new_size_a, new_size_b;
    if (ratio > 1 || ratio < 0) {
      throw "invalid ratio: " + ratio + " (must be between 0 and 1)";
    }
    new_size_a = rect.size[axis] * ratio;
    new_size_b = rect.size[axis] - new_size_a;
    new_rect = Tile.copy_rect(rect);
    rect = Tile.copy_rect(rect);
    rect.size[axis] = new_size_a;
    new_rect.size[axis] = new_size_b;
    new_rect.pos[axis] += new_size_a;
    return [rect, new_rect];
  },
  add_diff_to_rect: function(rect, diff) {
    return {
      pos: Tile.point_add(rect.pos, diff.pos),
      size: Tile.point_add(rect.size, diff.size)
    };
  },
  ensure_rect_exists: function(rect) {
    rect.size.x = Math.max(1, rect.size.x);
    rect.size.y = Math.max(1, rect.size.y);
    return rect;
  },
  zero_rect: function(rect) {
    return rect.pos.x === 0 && rect.pos.y === 0 && rect.size.x === 0 && rect.size.y === 0;
  },
  shrink: function(rect, border_px) {
    return {
      pos: {
        x: rect.pos.x + border_px,
        y: rect.pos.y + border_px
      },
      size: {
        x: Math.max(0, rect.size.x - (2 * border_px)),
        y: Math.max(0, rect.size.y - (2 * border_px))
      }
    };
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
  move_rect_within: function(original_rect, bounds) {
    var extent, max, min, rect;
    min = Math.min;
    max = Math.max;
    rect = Tile.copy_rect(original_rect);
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
      pos: this.point_diff(original_rect.pos, rect.pos),
      size: this.point_diff(original_rect.size, rect.size)
    };
  },
  point_diff: function(a, b) {
    return {
      x: b.x - a.x,
      y: b.y - a.y
    };
  },
  point_add: function(a, b) {
    return {
      x: a.x + b.x,
      y: a.y + b.y
    };
  },
  rect_center: function(rect) {
    return {
      x: this.midpoint(rect.pos.x, rect.pos.x + rect.size.x),
      y: this.midpoint(rect.pos.y, rect.pos.y + rect.size.y)
    };
  },
  point_is_within: function(point, rect) {
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
TileCollection = (function() {
  function TileCollection() {
    this.sort_order = __bind(this.sort_order, this);;
    this.is_active = __bind(this.is_active, this);;
    this.is_tiled = __bind(this.is_tiled, this);;
    this.is_visible_and_untiled = __bind(this.is_visible_and_untiled, this);;
    this.is_visible = __bind(this.is_visible, this);;    this.items = [];
  }
  TileCollection.prototype.is_visible = function(item) {
    return !item.is_minimized();
  };
  TileCollection.prototype.is_visible_and_untiled = function(item) {
    return (!this.is_tiled(item)) && this.is_visible(item);
  };
  TileCollection.prototype.is_tiled = function(item) {
    return item.managed && this.is_visible(item);
  };
  TileCollection.prototype.is_active = function(item) {
    return item.is_active();
  };
  TileCollection.prototype.sort_order = function(item) {
    if (this.is_tiled(item)) {
      return 0;
    } else if (this.is_visible(item)) {
      return 1;
    } else {
      return 2;
    }
  };
  TileCollection.prototype.sorted_with_indexes = function() {
    var index, items_and_indexes, sorted, ts, _ref;
    items_and_indexes = [];
    ts = function() {
      return "" + this.item + "@" + this.index;
    };
    for (index = 0, _ref = this.items.length; (0 <= _ref ? index < _ref : index > _ref); (0 <= _ref ? index += 1 : index -= 1)) {
      items_and_indexes.push({
        item: this.items[index],
        index: index,
        toString: ts
      });
    }
    sorted = items_and_indexes.slice().sort(__bind(function(a, b) {
      var ordera, orderb;
      ordera = this.sort_order(a.item);
      orderb = this.sort_order(b.item);
      if (ordera === orderb) {
        return a.index - b.index;
      } else {
        return ordera - orderb;
      }
    }, this));
    return sorted;
  };
  TileCollection.prototype._wrap_index = function(idx, length) {
    while (idx < 0) {
      idx += length;
    }
    while (idx >= length) {
      idx -= length;
    }
    return idx;
  };
  TileCollection.prototype.filter = function(f, items) {
    var item, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = items.length; _i < _len; _i++) {
      item = items[_i];
      if (f(item)) {
        _results.push(item);
      }
    }
    return _results;
  };
  TileCollection.prototype.select_cycle = function(diff) {
    return this._with_active_and_neighbor_when_filtered(this.is_visible, diff, __bind(function(active, neighbor) {
      return neighbor.item.activate();
    }, this));
  };
  TileCollection.prototype.sorted_view = function(filter) {
    var f;
    f = __bind(function(obj) {
      return filter(obj.item);
    }, this);
    return this.filter(f, this.sorted_with_indexes());
  };
  TileCollection.prototype._with_active_and_neighbor_when_filtered = function(filter, diff, cb) {
    var filtered, filtered_active_idx, new_idx;
    filtered = this.sorted_view(filter);
    filtered_active_idx = this._index_where(filtered, __bind(function(obj) {
      return this.is_active(obj.item);
    }, this));
    if (filtered_active_idx === null) {
      return false;
    }
    new_idx = this._wrap_index(filtered_active_idx + diff, filtered.length);
    cb(filtered[filtered_active_idx], filtered[new_idx]);
    return true;
  };
  TileCollection.prototype.cycle = function(diff) {
    var done;
    done = this._with_active_and_neighbor_when_filtered(this.is_tiled, diff, __bind(function(active, neighbor) {
      return this.swap_at(active.index, neighbor.index);
    }, this));
    return done || this._with_active_and_neighbor_when_filtered(this.is_visible_and_untiled, diff, __bind(function(active, neighbor) {
      return this.swap_at(active.index, neighbor.index);
    }, this));
  };
  TileCollection.prototype._index_where = function(elems, cond) {
    var i, _ref;
    for (i = 0, _ref = elems.length; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
      if (cond(elems[i])) {
        return i;
      }
    }
    return null;
  };
  TileCollection.prototype._wrap_index_until = function(initial, offset, length, condition) {
    var index, _results;
    index = initial;
    _results = [];
    while (true) {
      index = this._wrap_index(index + offset, length);
      if (index === initial) {
        return initial;
      } else if (condition(index)) {
        return index;
      }
    }
    return _results;
  };
  TileCollection.prototype.swap_at = function(idx1, idx2) {
    var _orig;
    _orig = this.items[idx2];
    this.items[idx2] = this.items[idx1];
    return this.items[idx1] = _orig;
  };
  TileCollection.prototype.contains = function(item) {
    var ret;
    ret = false;
    this.each(__bind(function(tile) {
      if (item === tile) {
        ret = true;
        return STOP;
      }
    }, this));
    return ret;
  };
  TileCollection.prototype.push = function(item) {
    if (this.contains(item)) {
      return;
    }
    return this.items.push(item);
  };
  TileCollection.prototype.each = function(f) {
    var i, ret, _ref;
    for (i = 0, _ref = this.items.length; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
      ret = f(this.items[i], i);
      if (ret === STOP) {
        return true;
      }
    }
    return false;
  };
  TileCollection.prototype.each_tiled = function(f) {
    return this._filtered_each(this.is_tiled, f);
  };
  TileCollection.prototype._filtered_each = function(filter, f) {
    return this.each(__bind(function(tile, idx) {
      if (filter(tile)) {
        return f(tile, idx);
      }
    }, this));
  };
  TileCollection.prototype.active = function(f) {
    return this.each(__bind(function(item, idx) {
      if (this.is_active(item)) {
        f(item, idx);
        return STOP;
      }
    }, this));
  };
  TileCollection.prototype.for_layout = function() {
    return this.filter(this.is_tiled, this.items);
  };
  TileCollection.prototype.remove_at = function(idx) {
    return this.items.splice(idx, 1);
  };
  TileCollection.prototype.main = function(f) {
    return this.each(__bind(function(tile, idx) {
      if (this.is_tiled(tile)) {
        f(tile, idx);
        return STOP;
      }
    }, this));
  };
  return TileCollection;
})();
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
  BaseSplit.prototype.maintain_split_position_with_rect_difference = function(diff) {
    var unwanted_addition;
    unwanted_addition = this.ratio * diff;
    this.last_size += diff;
    log("adjusting by " + (-unwanted_addition) + " to accommodate for rect size change from " + (this.last_size - diff) + " to " + this.last_size);
    return this.adjust_ratio_px(-unwanted_addition);
  };
  BaseSplit.prototype.adjust_ratio_px = function(diff) {
    var current_px, new_px, new_ratio;
    log("adjusting ratio " + this.ratio + " by " + diff + " px");
    if (diff === 0) {
      return;
    }
    current_px = this.ratio * this.last_size;
    log("current ratio makes for " + current_px + " px (assuming last size of " + this.last_size);
    new_px = current_px + diff;
    log("but we want " + new_px);
    new_ratio = new_px / this.last_size;
    if (!Tile.within(new_ratio, 0, 1)) {
      throw "failed ratio: " + new_ratio;
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
    _ref = Tile.split_rect(rect, this.axis, this.ratio), window_rect = _ref[0], remaining = _ref[1];
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
  function MultiSplit(axis, primary_windows) {
    this.primary_windows = primary_windows;
    MultiSplit.__super__.constructor.call(this, axis);
  }
  MultiSplit.prototype.split = function(bounds, windows) {
    var left_rect, left_windows, right_rect, right_windows, _ref, _ref2, _ref3;
    this.save_last_rect(bounds);
    _ref = this.partition_windows(windows), left_windows = _ref[0], right_windows = _ref[1];
    if (left_windows.length > 0 && right_windows.length > 0) {
      _ref2 = Tile.split_rect(bounds, this.axis, this.ratio), left_rect = _ref2[0], right_rect = _ref2[1];
    } else {
      _ref3 = [bounds, bounds], left_rect = _ref3[0], right_rect = _ref3[1];
    }
    return [[left_rect, left_windows], [right_rect, right_windows]];
  };
  MultiSplit.prototype.partition_windows = function(windows) {
    return ArrayUtil.divide_after(this.primary_windows, windows);
  };
  MultiSplit.prototype.in_primary_partition = function(idx) {
    return idx < this.primary_windows;
  };
  return MultiSplit;
})();
HorizontalTiledLayout = (function() {
  function HorizontalTiledLayout(screen_offset_x, screen_offset_y, screen_width, screen_height) {
    this.bounds = {
      pos: {
        x: screen_offset_x,
        y: screen_offset_y
      },
      size: {
        x: screen_width,
        y: screen_height
      }
    };
    this.tiles = new TileCollection();
    this.main_axis = 'x';
    this.main_split = new MultiSplit(this.main_axis, 1);
    this.splits = {
      left: [],
      right: []
    };
  }
  HorizontalTiledLayout.prototype.each_tiled = function(func) {
    return this.tiles.each_tiled(func);
  };
  HorizontalTiledLayout.prototype.each = function(func) {
    return this.tiles.each(func);
  };
  HorizontalTiledLayout.prototype.contains = function(win) {
    return this.tiles.contains(win);
  };
  HorizontalTiledLayout.prototype.tile_for = function(win, func) {
    return this.tiles.each(function(tile, idx) {
      if (tile.window === win) {
        func(tile, idx);
        return STOP;
      }
    });
  };
  HorizontalTiledLayout.prototype.layout = function(accommodate_window) {
    var layout_windows, left, right, _ref;
    layout_windows = this.tiles.for_layout();
    if (accommodate_window != null) {
      this._change_main_ratio_to_accommodate(accommodate_window, this.main_split);
    }
    _ref = this.main_split.split(this.bounds, layout_windows), left = _ref[0], right = _ref[1];
    this.layout_side.apply(this, __slice.call(left).concat([this.splits.left], [accommodate_window]));
    return this.layout_side.apply(this, __slice.call(right).concat([this.splits.right], [accommodate_window]));
  };
  HorizontalTiledLayout.prototype.layout_side = function(rect, windows, splits, accommodate_window) {
    var accommodate_idx, axis, bottom_split, extend_to, other_axis, previous_split, split, top_splits, window, zip, _i, _len, _ref, _ref2, _ref3, _results;
    axis = Axis.other(this.main_axis);
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
    if (accommodate_window != null) {
      accommodate_idx = windows.indexOf(accommodate_window);
      if (accommodate_idx !== -1) {
        top_splits = splits.slice(0, accommodate_idx);
        bottom_split = splits[accommodate_idx];
        if (accommodate_idx === windows.length - 1) {
          bottom_split = void 0;
        }
        other_axis = Axis.other(this.main_axis);
        this._change_minor_ratios_to_accommodate(accommodate_window, top_splits, bottom_split);
      }
    }
    previous_split = null;
    _ref = zip(windows, splits);
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], window = _ref2[0], split = _ref2[1];
      window.top_split = previous_split;
      _ref3 = split.layout_one(rect, windows), rect = _ref3[0], windows = _ref3[1];
      window.ensure_within(this.bounds);
      window.bottom_split = windows.length > 0 ? split : null;
      _results.push(previous_split = split);
    }
    return _results;
  };
  HorizontalTiledLayout.prototype.add_main_window_count = function(i) {
    this.main_split.primary_windows += i;
    return this.layout();
  };
  HorizontalTiledLayout.prototype.tile = function(win) {
    return this.tile_for(win, __bind(function(tile) {
      tile.tile();
      return this.layout();
    }, this));
  };
  HorizontalTiledLayout.prototype.select_cycle = function(offset) {
    return this.tiles.select_cycle(offset);
  };
  HorizontalTiledLayout.prototype.add = function(win) {
    var tile;
    if (this.contains(win)) {
      return;
    }
    tile = new TiledWindow(win, this);
    return this.tiles.push(tile);
  };
  HorizontalTiledLayout.prototype.active_tile = function(fn) {
    return this.tiles.active(fn);
  };
  HorizontalTiledLayout.prototype.cycle = function(diff) {
    this.tiles.cycle(diff);
    return this.layout();
  };
  HorizontalTiledLayout.prototype.adjust_main_window_area = function(diff) {
    this.main_split.adjust_ratio(diff);
    return this.layout();
  };
  HorizontalTiledLayout.prototype.adjust_current_window_size = function(diff) {
    return this.active_tile(__bind(function(tile) {
      this.adjust_split_for_tile({
        tile: tile,
        diff_ratio: diff,
        axis: Axis.other(this.main_axis)
      });
      return this.layout();
    }, this));
  };
  HorizontalTiledLayout.prototype.scale_current_window = function(amount, axis) {
    return this.active_tile(__bind(function(tile) {
      tile.scale_by(amount, axis);
      tile.center_window();
      tile.ensure_within(this.bounds);
      return tile.layout();
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
    if (axis === this.main_axis) {
      return adjust(this.main_split, !this.main_split.in_primary_partition(this.tiles.indexOf(tile)));
    } else {
      if (tile.bottom_split != null) {
        return adjust(tile.bottom_split, false);
      } else if (tile.top_split != null) {
        return adjust(tile.top_split, true);
      }
    }
  };
  HorizontalTiledLayout.prototype.main_window = function() {
    return this.tiles.main();
  };
  HorizontalTiledLayout.prototype.swap_active_with_main = function() {
    return this.tiles.active(__bind(function(tile, idx) {
      return this.tiles.main(__bind(function(main_tile, main_idx) {
        this.tiles.swap_at(idx, main_idx);
        return this.layout();
      }, this));
    }, this));
  };
  HorizontalTiledLayout.prototype.untile = function(win) {
    return this.tile_for(win, __bind(function(tile) {
      tile.release();
      return this.layout();
    }, this));
  };
  HorizontalTiledLayout.prototype.on_window_killed = function(win) {
    return this.tile_for(win, __bind(function(tile, idx) {
      this.tiles.remove_at(idx);
      return this.layout();
    }, this));
  };
  HorizontalTiledLayout.prototype.on_window_moved = function(win) {
    return this.tile_for(win, __bind(function(tile, idx) {
      var moved;
      moved = this.swap_moved_tile_if_necessary(tile, idx);
      if (!moved) {
        tile.update_offset();
      }
      return this.layout();
    }, this));
  };
  HorizontalTiledLayout.prototype.on_split_resize_start = function(win) {
    this.split_resize_start_rect = Tile.copy_rect(this.tiles[this.indexOf(win)].window_rect());
    return log("starting resize of split.. " + (j(this.split_resize_start_rect)));
  };
  HorizontalTiledLayout.prototype.on_window_resized = function(win) {
    return this.tile_for(win, __bind(function(tile, idx) {
      var diff;
      if (this.split_resize_start_rect != null) {
        diff = Tile.point_diff(this.split_resize_start_rect.size, tile.window_rect().size);
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
    }, this));
  };
  HorizontalTiledLayout.prototype.adjust_splits_to_fit = function(win) {
    return this.tile_for(win, __bind(function(tile, idx) {
      if (!this.tiles.is_tiled(tile)) {
        return;
      }
      return this.layout(tile);
    }, this));
  };
  HorizontalTiledLayout.prototype._change_main_ratio_to_accommodate = function(tile, split) {
    var left, right, _ref;
    _ref = split.partition_windows(this.tiles.for_layout()), left = _ref[0], right = _ref[1];
    if (contains(left, tile)) {
      log("LHS adjustment for size: " + (j(tile.offset.size)) + " and pos " + (j(tile.offset.pos)));
      split.adjust_ratio_px(tile.offset.size[this.main_axis] + tile.offset.pos[this.main_axis]);
      tile.offset.size[this.main_axis] = -tile.offset.pos[this.main_axis];
    } else if (contains(right, tile)) {
      log("RHS adjustment for size: " + (j(tile.offset.size)) + " and pos " + (j(tile.offset.pos)));
      split.adjust_ratio_px(tile.offset.pos[this.main_axis]);
      tile.offset.size[this.main_axis] += tile.offset.pos[this.main_axis];
      tile.offset.pos[this.main_axis] = 0;
    }
    return log("After main_split accommodation, tile offset = " + (j(tile.offset)));
  };
  HorizontalTiledLayout.prototype._change_minor_ratios_to_accommodate = function(tile, above_splits, below_split) {
    var axis, bottom_offset, diff_px, diff_pxes, i, offset, proportion, size_taken, split, split_size, split_sizes, top_offset, total_size_above, _i, _len, _ref, _ref2;
    offset = tile.offset;
    axis = Axis.other(this.main_axis);
    top_offset = offset.pos[axis];
    bottom_offset = offset.size[axis];
    if (above_splits.length > 0) {
      log("ABOVE adjustment for offset: " + (j(offset)) + ", " + top_offset + " diff required across " + above_splits.length);
      diff_pxes = [];
      split_sizes = [];
      total_size_above = 0;
      for (_i = 0, _len = above_splits.length; _i < _len; _i++) {
        split = above_splits[_i];
        split_size = split.last_size * split.ratio;
        split_sizes.push(split_size);
        total_size_above += split_size;
      }
      for (i = 0, _ref = above_splits.length; (0 <= _ref ? i < _ref : i > _ref); (0 <= _ref ? i += 1 : i -= 1)) {
        proportion = split_sizes[i] / total_size_above;
        diff_pxes.push(proportion * top_offset);
      }
      log("diff pxes for above splits are: " + (j(diff_pxes)));
      size_taken = 0;
      for (i = 0, _ref2 = above_splits.length; (0 <= _ref2 ? i < _ref2 : i > _ref2); (0 <= _ref2 ? i += 1 : i -= 1)) {
        split = above_splits[i];
        diff_px = diff_pxes[i];
        split.maintain_split_position_with_rect_difference(-size_taken);
        size_taken += diff_px;
        split.adjust_ratio_px(diff_px);
      }
      tile.offset.pos[axis] = 0;
      if (below_split != null) {
        log("MODIFYING bottom to accomodate top_px changes == " + top_offset);
        below_split.maintain_split_position_with_rect_difference(-top_offset);
      } else {
        tile.offset.size[axis] += top_offset;
      }
    } else {
      bottom_offset += top_offset;
    }
    if (below_split != null) {
      log("BELOW adjustment for offset: " + (j(offset)) + ", bottom_offset = " + bottom_offset);
      log("before bottom minor adjustments, offset = " + (j(tile.offset)));
      below_split.adjust_ratio_px(bottom_offset);
      tile.offset.size[axis] -= bottom_offset;
    }
    return log("After minor adjustments, offset = " + (j(tile.offset)));
  };
  HorizontalTiledLayout.prototype.toggle_maximize = function() {
    var active;
    active = null;
    this.active_tile(__bind(function(tile, idx) {
      return active = tile;
    }, this));
    if (active === null) {
      log("active == null");
    }
    if (active === null) {
      return;
    }
    return this.each(__bind(function(tile) {
      if (tile === active) {
        log("toggling maximize for " + tile);
        return tile.toggle_maximize();
      } else {
        return tile.unmaximize();
      }
    }, this));
  };
  HorizontalTiledLayout.prototype.swap_moved_tile_if_necessary = function(tile, idx) {
    var mouse_pos, moved;
    if (!this.tiles.is_tiled(tile)) {
      return;
    }
    mouse_pos = get_mouse_position();
    moved = false;
    this.each_tiled(__bind(function(swap_candidate, swap_idx) {
      var target_rect;
      target_rect = Tile.shrink(swap_candidate.rect, 20);
      if (swap_idx === idx) {
        return;
      }
      if (Tile.point_is_within(mouse_pos, target_rect)) {
        log("swapping idx " + idx + " and " + swap_idx);
        this.tiles.swap_at(idx, swap_idx);
        moved = true;
        return STOP;
      }
    }, this));
    return moved;
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
    log(" - main windows: " + this.mainsplit.primary_windows);
    this.main_windows().map(dump_win);
    log("");
    log(" - minor windows: " + this.tiles.length - this.mainsplit.primary_windows);
    this.minor_windows().map(dump_win);
    return log(" ----------------------------------- ");
  };
  return HorizontalTiledLayout;
})();
TiledWindow = (function() {
  function TiledWindow(win, layout) {
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
    this.maximized = false;
    this.managed = false;
    this._layout = layout;
  }
  TiledWindow.prototype.tile = function(layout) {
    if (this.managed) {
      log("resetting offset for window " + this);
      this.reset_offset();
    } else {
      this.managed = true;
      this.original_rect = this.window_rect();
    }
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
  TiledWindow.prototype.toString = function() {
    return "<\#TiledWindow of " + this.window.toString() + ">";
  };
  TiledWindow.prototype.before_redraw = function(f) {
    return this.window.before_redraw(f);
  };
  TiledWindow.prototype.update_offset = function() {
    var rect, win;
    rect = this.rect;
    win = this.window_rect();
    this.offset = {
      pos: Tile.point_diff(rect.pos, win.pos),
      size: Tile.point_diff(rect.size, win.size)
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
  TiledWindow.prototype.toggle_maximize = function() {
    if (this.maximized) {
      return this.unmaximize();
    } else {
      return this.maximize();
    }
  };
  TiledWindow.prototype.is_minimized = function() {
    return this.window.is_minimized();
  };
  TiledWindow.prototype.maximize = function() {
    this.maximized = true;
    return this.layout();
  };
  TiledWindow.prototype.unmaximize = function() {
    this.maximized = false;
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
    combined_rect = Tile.add_diff_to_rect(this.rect, this.offset);
    change_required = Tile.move_rect_within(combined_rect, screen_rect);
    if (!Tile.zero_rect(change_required)) {
      log("moving tile " + (j(change_required)) + " to keep it onscreen");
      this.offset = Tile.add_diff_to_rect(this.offset, change_required);
      return this.layout();
    }
  };
  TiledWindow.prototype.center_window = function() {
    var movement_required, tile_center, window_center, window_rect;
    window_rect = this.window_rect();
    tile_center = Tile.rect_center(this.rect);
    window_center = Tile.rect_center(window_rect);
    movement_required = Tile.point_diff(window_center, tile_center);
    return this.offset.pos = Tile.point_add(this.offset.pos, movement_required);
  };
  TiledWindow.prototype.layout = function() {
    var is_active, pos, rect, size, _ref;
    is_active = this.is_active();
    rect = this.maximized_rect() || Tile.add_diff_to_rect(this.rect, this.offset);
    _ref = Tile.ensure_rect_exists(rect), pos = _ref.pos, size = _ref.size;
    this.window.move_resize(pos.x, pos.y, size.x, size.y);
    if (is_active) {
      return this.window.before_redraw(__bind(function() {
        return this.activate();
      }, this));
    }
  };
  TiledWindow.prototype.maximized_rect = function() {
    var border, bounds;
    if (!this.maximized) {
      return null;
    }
    bounds = this._layout.bounds;
    border = 20;
    return {
      pos: {
        x: bounds.pos.x + border,
        y: bounds.pos.y + border
      },
      size: {
        x: bounds.size.x - border * 2,
        y: bounds.size.y - border * 2
      }
    };
  };
  TiledWindow.prototype.scale_by = function(amount, axis) {
    var window_rect;
    window_rect = this.window_rect();
    if (axis != null) {
      return this._scale_by(amount, axis, window_rect);
    } else {
      this._scale_by(amount, 'x', window_rect);
      return this._scale_by(amount, 'y', window_rect);
    }
  };
  TiledWindow.prototype._scale_by = function(amount, axis, window_rect) {
    var current_dim, diff_px, new_dim;
    current_dim = window_rect.size[axis];
    diff_px = amount * current_dim;
    new_dim = current_dim + diff_px;
    this.offset.size[axis] += diff_px;
    return this.offset.pos[axis] -= diff_px / 2;
  };
  TiledWindow.prototype.release = function() {
    this.set_rect(this.original_rect);
    return this.managed = false;
  };
  TiledWindow.prototype.activate = function() {
    this.window.activate();
    return this.window.bring_to_front();
  };
  TiledWindow.prototype.is_active = function() {
    return this.window.is_active();
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
export_to = function(dest) {
  dest.HorizontalTiledLayout = HorizontalTiledLayout;
  dest.TileCollection = TileCollection;
  dest.Axis = Axis;
  dest.Tile = Tile;
  dest.Split = Split;
  dest.MultiSplit = MultiSplit;
  dest.TiledWindow = TiledWindow;
  dest.ArrayUtil = ArrayUtil;
  return dest.to_get_mouse_position = function(f) {
    return get_mouse_position = f;
  };
};
if (typeof exports != "undefined" && exports !== null) {
  log("EXPORTS");
  export_to(exports);
}