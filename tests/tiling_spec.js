var assert = require('assert');
var eq = assert.deepEqual;


var shellshape = require('../build/node/shellshape');
var tiling = shellshape.Tiling;
var Layout = shellshape.Layout;
var WindowTile = shellshape.WindowTile;
var MockWindow = shellshape.MockWindow;
var Tile = tiling.Tile;

var window = {};

var puts = require('sys').puts;

var j = JSON.stringify;

var util = require('util');

var pp = function(x) {
  return util.log(util.inspect(x));
};

var logger = shellshape.Logging.getLogger('test');
var log = logger.info;

var noop = function() {
  return null;
};

// console.log(shellshape);
tiling.get_mouse_position = function() {
  return {
    x: 0,
    y: 0
  };
};

describe('ArrayUtil', function() {
  it('divide_after should divide an array', function() {
    return eq(tiling.ArrayUtil.divide_after(2, [1, 2, 3, 4, 5]), [[1, 2], [3, 4, 5]]);
  });
  describe('shiftItem', function() {
    it('should move an item forwards', function() {
      eq(tiling.ArrayUtil.moveItem([1, 2, 3, 4, 5], 1, 2), [1, 3, 2, 4, 5]);
      return eq(tiling.ArrayUtil.moveItem([1, 2, 3, 4, 5], 0, 4), [2, 3, 4, 5, 1]);
    });
    it('should move an item backwards', function() {
      eq(tiling.ArrayUtil.moveItem([1, 2, 3, 4, 5], 2, 1), [1, 3, 2, 4, 5]);
      return eq(tiling.ArrayUtil.moveItem([1, 2, 3, 4, 5], 4, 0), [5, 1, 2, 3, 4]);
    });
  });
});

// convert old-style box to rect
function to_rect(box) {
  return { pos: {x: box.x, y:box.y}, size: {x:box.w, y:box.h}};
}

describe('tile collection', function() {
  var layout_state, tiles, bounds, collection;
  beforeEach(function() {
    var win = function(name) {
      var w = new MockWindow(name);
      return new WindowTile.TiledWindow(w, layout_state);
    };

    var tiled = function(name) {
      var rv = win(name + " (tiled)");
      rv.tile();
      return rv;
    };
    var untiled = function(name) {
      var rv = win(name + " (untiled)");
      rv.release();
      return rv;
    };
    var minimized = function(name) {
      var rv = win(name + " (minimized)");
      rv.minimize();
      return rv;
    };

    collection = new tiling.TileCollection(bounds);
    bounds = {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 100,
        y: 100
      },
      update: noop,
    };
    layout_state = new Layout.LayoutState(bounds);

    tiles = {
      tiled:[tiled("0"), tiled("1"), tiled("2")],
      untiled: [untiled("0"), untiled("1")],
      minimized: [minimized("0"), minimized("1")],
    };

    tiles.all = tiles.tiled.concat(tiles.untiled).concat(tiles.minimized);
    tiles.all.forEach(function(t) {
      collection.push(t);
    });
    // XXX why so weirdly ordered?
    // all_tiles = [minimized_tiles[0], tiled_tiles[0], untiled_tiles[0], tiled_tiles[1], untiled_tiles[1], minimized_tiles[1], tiled_tiles[2]];
  });


  var get_active = function() {
    var rv;
    collection.active(function(x) { rv = x; });
    return rv;
  };
  get_tiled = function() {
    return collection.filter(collection.is_tiled, collection.items);
  };
  get_untiled = function() {
    return collection.filter(collection.is_visible_and_untiled, collection.items);
  };
  // new_collection = function() {
  //   var c, tile, _i, _len;
  //   c = new tiling.TileCollection();
  //   for (_i = 0, _len = all_tiles.length; _i < _len; _i++) {
  //     tile = all_tiles[_i];
  //     c.push(tile);
  //   }
  //   return c;
  // };
  it('should select the main window as the first tiled window', function(pass) {
    return collection.main(function(main) {
      eq(main, tiles.tiled[0]);
      return pass();
    });
  });
  it('should select the next tile grouping tiled windows before untiled windows and skipping minimised windows', function() {
    var c = collection;
    tiles.tiled[0].activate();
    c.select_cycle(1);
    eq(get_active(), tiles.tiled[1]);
    c.select_cycle(1);
    eq(get_active(), tiles.tiled[2]);
    c.select_cycle(1);
    eq(get_active(), tiles.untiled[0]);
    c.select_cycle(1);
    eq(get_active(), tiles.untiled[1]);
    c.select_cycle(1);
    return eq(get_active(), tiles.tiled[0]);
  });
  it('should re-order tiled windows', function() {
    var c = collection;
    tiles.tiled[0].activate();
    c.cycle(1);
    eq(get_tiled(c), [tiles.tiled[1], tiles.tiled[0], tiles.tiled[2]]);
    eq(get_active(), tiles.tiled[0]);
    c.cycle(1);
    eq(get_tiled(c), [tiles.tiled[1], tiles.tiled[2], tiles.tiled[0]]);
    eq(get_active(), tiles.tiled[0]);
    c.cycle(1);
    eq(get_tiled(c), [tiles.tiled[0], tiles.tiled[2], tiles.tiled[1]]);
    return eq(get_active(), tiles.tiled[0]);
  });
  it('should re-order untiled windows', function() {
    var c = collection;
    tiles.untiled[0].activate();
    c.cycle(1);
    eq(get_tiled(c), [tiles.tiled[0], tiles.tiled[1], tiles.tiled[2]]);
    eq(get_untiled(c), [tiles.untiled[1], tiles.untiled[0]]);
    eq(get_active(), tiles.untiled[0]);
    c.cycle(1);
    eq(get_untiled(c), [tiles.untiled[0], tiles.untiled[1]]);
    return eq(get_active(), tiles.untiled[0]);
  });
});

var rect = function(x, y, w, h) {
  return {
    pos: {
      x: x,
      y: y
    },
    size: {
      x: w,
      y: h
    }
  };
};

describe('rect* functions', function() {
  describe('move_rect_within(rect, bounds)', function() {
    var bounds;
    bounds = {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 800,
        y: 600
      },
      update: noop
    };
    it('should leave a window that is within bounds', function() {
      return eq(Tile.move_rect_within(rect(10, 10, 400, 300), bounds), rect(0, 0, 0, 0));
    });
    it('should move a window to the right if it is too leftwards', function() {
      return eq(Tile.move_rect_within(rect(-10, 10, 400, 300), bounds), rect(10, 0, 0, 0));
    });
    it('should move a window to the left if it is too rightwards', function() {
      return eq(Tile.move_rect_within(rect(400, 10, 410, 300), bounds), rect(-10, 0, 0, 0));
    });
    it('should move a window down if it is too high', function() {
      return eq(Tile.move_rect_within(rect(10, -10, 400, 300), bounds), rect(0, 10, 0, 0));
    });
    it('should move a window up if it is too low', function() {
      return eq(Tile.move_rect_within(rect(10, 300, 400, 310), bounds), rect(0, -10, 0, 0));
    });
    it('should make a window match the bounds height if it is too tall', function() {
      eq(Tile.move_rect_within(rect(10, 10, 400, 620), bounds), rect(0, -10, 0, -20));
      return eq(Tile.move_rect_within(rect(10, -10, 400, 620), bounds), rect(0, 10, 0, -20));
    });
    it('should make a window match the bounds width if it is too wide', function() {
      eq(Tile.move_rect_within(rect(10, 10, 820, 300), bounds), rect(-10, 0, -20, 0));
      return eq(Tile.move_rect_within(rect(-10, 10, 820, 300), bounds), rect(10, 0, -20, 0));
    });
  });
  describe('adding rect offsets', function() {
    it('should add things', function() {
      var diff, new_, orig;
      orig = {
        "pos": {
          "x": -4.200000286102295,
          "y": -4.200000286102295
        },
        "size": {
          "x": -181,
          "y": -48
        }
      };
      diff = {
        "pos": {
          "x": 0,
          "y": 4.200000286102295
        },
        "size": {
          "x": 0,
          "y": 0
        }
      };
      new_ = {
        "pos": {
          "x": -4.200000286102295,
          "y": 0
        },
        "size": {
          "x": 1,
          "y": 1
        }
      };
      orig = {
        "pos": {
          "x": 0,
          "y": 0
        },
        "size": {
          "x": -181,
          "y": -48
        }
      };
      diff = {
        "pos": {
          "x": 0,
          "y": 0
        },
        "size": {
          "x": 0,
          "y": 0
        }
      };
      new_ = {
        "pos": {
          "x": 0,
          "y": 0
        },
        "size": {
          "x": -181,
          "y": -48
        }
      };
      return eq(Tile.add_diff_to_rect(orig, diff), new_);
    });
  });
  
  describe("intersection", function() {
    function t(a,b, exp) {
      eq(Tile.intersect(a, b), exp);
      eq(Tile.intersect(b, a), exp);
    };

    it("should be null for non-intersecting rects", function() {
      // to the right
      t(rect(10, 10, 100, 100), rect(200, 10, 100, 100), null);

      // below
      t(rect(10, 10, 100, 100), rect(10, 200, 100, 100), null);
    });

    it('should be the intersection for overlapping rects', function() {
      // NW / SE
      t(rect(100, 100, 100, 100),
        rect(50, 50, 100, 100),
        rect(100, 100, 50, 50));

      // NE / SW
      t(rect(50, 100, 100, 100),
        rect(100, 50, 100, 100),
        rect(100, 100, 50, 50));

      // N / S
      t(rect(50, 50, 500, 100),
        rect(100, 100, 100, 100),
        rect(100, 100, 100, 50));

      // Subset
      t(rect(50, 50, 500, 500),
        rect(100, 100, 100, 100),
        rect(100, 100, 100, 100));
    });

  });

});

describe('Window tiling / untiling', function() {
  it('should keep track of all windows', function() {});
});

describe('Window Splitting / layout', function() {});

describe('Basic Tile functions', function() {
  it('should split x', function() {
    return eq(Tile.split_rect({
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 100,
        y: 200
      }
    }, 'x', 0.5, 0), [
      {
        pos: {
          x: 0,
          y: 0
        },
        size: {
          x: 50,
          y: 200
        }
      }, {
        pos: {
          x: 50,
          y: 0
        },
        size: {
          x: 50,
          y: 200
        }
      }
    ], 0);
  });
  it('should split y', function() {
    return eq(Tile.split_rect({
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 100,
        y: 200
      }
    }, 'y', 0.5, 0), [
      {
        pos: {
          x: 0,
          y: 0
        },
        size: {
          x: 100,
          y: 100
        }
      }, {
        pos: {
          x: 0,
          y: 100
        },
        size: {
          x: 100,
          y: 100
        }
      }
    ]);
  });
  it('should split non-evenly', function() {
    return eq(Tile.split_rect({
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 100,
        y: 200
      }
    }, 'y', 0.1, 0), [
      {
        pos: {
          x: 0,
          y: 0
        },
        size: {
          x: 100,
          y: 20
        }
      }, {
        pos: {
          x: 0,
          y: 20
        },
        size: {
          x: 100,
          y: 180
        }
      }
    ]);
  });
  it('should split with a padding', function() {
    return eq(Tile.split_rect({
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 100,
        y: 200
      }
    }, 'y', 0.5, 10), [
      {
        pos: {
          x: 0,
          y: 0
        },
        size: {
          x: 100,
          y: 90
        }
      }, {
        pos: {
          x: 0,
          y: 110
        },
        size: {
          x: 100,
          y: 90
        }
      }
    ]);
  });
  it('should join two rects', function() {
    return eq(Tile.joinRects({
      pos: {
        x: 40,
        y: 0
      },
      size: {
        x: 100,
        y: 20
      }
    }, {
      pos: {
        x: 0,
        y: 40
      },
      size: {
        x: 100,
        y: 20
      }
    }), {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: 140,
        y: 60
      }
    });
  });
});

// MockWindow = (function() {
// 
//   MockWindow.name = 'MockWindow';
// 
//   function MockWindow(name) {
//     this.rect = {
//       x: 0,
//       y: 0,
//       w: 0,
//       h: 0
//     };
//     this.name = name;
//   }
// 
//   MockWindow.prototype.move_resize = function(x, y, w, h) {
//     this.rect = {
//       x: Math.round(x),
//       y: Math.round(y),
//       w: Math.round(w),
//       h: Math.round(h)
//     };
//     return puts(("" + this.name + ": resizing to: ") + j(this.rect));
//   };
// 
//   MockWindow.prototype.set_tile_preference = function(newval) {
//     return this.tile_preference = newval;
//   };
// 
//   MockWindow.prototype.xpos = function() {
//     return this.rect.x;
//   };
// 
//   MockWindow.prototype.ypos = function() {
//     return this.rect.y;
//   };
// 
//   MockWindow.prototype.width = function() {
//     return this.rect.w;
//   };
// 
//   MockWindow.prototype.height = function() {
//     return this.rect.h;
//   };
// 
//   MockWindow.prototype.is_active = function() {
//     return this.active || false;
//   };
// 
//   MockWindow.prototype.is_minimized = function() {
//     return false;
//   };
// 
//   MockWindow.prototype.toString = function() {
//     return "<MockWindow (" + this.name + ") @ " + (j(this.rect)) + ">";
//   };
// 
//   MockWindow.prototype.before_redraw = function(f) {
//     return f();
//   };
// 
//   MockWindow.prototype.activate = function() {
//     return null;
//   };
// 
//   MockWindow.prototype.bring_to_front = function() {
//     return null;
//   };
// 
//   return MockWindow;
// 
// })();

describe('VerticalTiledLayout', function() {
  var with_active, _new_layout, _num_tiles, _tile, _tiled_windows;
  _num_tiles = function(layout) {
    return _tiled_windows(layout).length;
  };
  _tile = function(layout, win) {
    layout.add(win);
    return layout.tile(win);
  };
  _tiled_windows = function(layout) {
    var tile, tiles, _i, _len, _results;
    tiles = layout.tiles.filter(layout.tiles.is_tiled, layout.tiles.items);
    _results = [];
    for (_i = 0, _len = tiles.length; _i < _len; _i++) {
      tile = tiles[_i];
      _results.push(tile.window.get_title());
    }
    return _results;
  };
  _new_layout = function(w, h) {
    var bounds, layout, state;
    bounds = {
      pos: {
        x: 0,
        y: 0
      },
      size: {
        x: w,
        y: h
      },
      update: noop
    };
    state = new Layout.LayoutState(bounds);
    return layout = new Layout.VerticalTiledLayout(state);
  };
  with_active = function(win, f) {
    win.activate();
    try {
      return f();
    } finally {
      win.deactivate();
    }
  };
  describe('big ol\' layout scenario', function() {
    var layout, num_tiles, tile, tiled_windows, window1, window2, window3;
    layout = _new_layout(800, 600);
    // layout_state.bounds.set(800, 600);
    num_tiles = function() {
      return _num_tiles(layout);
    };
    tiled_windows = function() {
      return _tiled_windows(layout);
    };
    tile = function(w) {
      return _tile(layout, w);
    };
    window1 = new MockWindow('window1');
    window2 = new MockWindow('window2');
    window3 = new MockWindow('window3');
    it('should start with no tiles', function() {
      return eq(num_tiles(layout), 0);
    });
    var ZERO = { x: 0, y:0 };
    it('should tile a single window', function() {
      tile(window1);
      eq(num_tiles(), 1);
      return eq(window1.rect(), {
        pos: ZERO,
        size: { x: 800, y: 600 },
      });
    });
    it('should tile a second window', function() {
      tile(window2);
      eq(num_tiles(), 2);
      eq(window1.rect(), {
        pos: ZERO,
        size: { x: 400, y: 600 },
      });
      return eq(window2.rect(), {
        pos: {x: 400, y:0},
        size: {x:400, y:600},
      });
    });
    it('should adjust main split ratio', function() {
      layout.adjust_main_window_area(-0.25);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 200,
        h: 600
      }));
      return eq(window2.rect(), to_rect({
        x: 200,
        y: 0,
        w: 600,
        h: 600
      }));
    });
    it('should tile a third window', function() {
      tile(window3);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 200,
        h: 600
      }));
      eq(window2.rect(), to_rect({
        x: 200,
        y: 0,
        w: 600,
        h: 300
      }));
      return eq(window3.rect(), to_rect({
        x: 200,
        y: 300,
        w: 600,
        h: 300
      }));
    });
    it('should not re-add windows', function() {
      tile(window3);
      return eq(num_tiles(), 3);
    });
    it('should move an additional window into main area', function() {
      layout.add_main_window_count(1);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 200,
        h: 300
      }));
      eq(window2.rect(), to_rect({
        x: 0,
        y: 300,
        w: 200,
        h: 300
      }));
      return eq(window3.rect(), to_rect({
        x: 200,
        y: 0,
        w: 600,
        h: 600
      }));
    });
    it('should remove a window from the main area', function() {
      layout.untile(window2);
      eq(num_tiles(), 2);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 800,
        h: 300
      }));
      return eq(window3.rect(), to_rect({
        x: 0,
        y: 300,
        w: 800,
        h: 300
      }));
    });
    it('should re-add an untiled window', function() {
      tile(window2);
      eq(num_tiles(), 3);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 200,
        h: 300
      }));
      eq(window2.rect(), to_rect({
        x: 0,
        y: 300,
        w: 200,
        h: 300
      }));
      return eq(window3.rect(), to_rect({
        x: 200,
        y: 0,
        w: 600,
        h: 600
      }));
    });
    it('should swap adjacent windows', function() {
      return with_active(window2, function() {
        layout.cycle(1);
        eq(num_tiles(), 3);
        eq(tiled_windows(), [window1.title, window3.title, window2.title]);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 200,
          h: 300
        }));
        eq(window3.rect(), to_rect({
          x: 0,
          y: 300,
          w: 200,
          h: 300
        }));
        return eq(window2.rect(), to_rect({
          x: 200,
          y: 0,
          w: 600,
          h: 600
        }));
      });
    });
    it('should take a window out of the main area', function() {
      layout.add_main_window_count(-1);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 200,
        h: 600
      }));
      eq(window3.rect(), to_rect({
        x: 200,
        y: 0,
        w: 600,
        h: 300
      }));
      return eq(window2.rect(), to_rect({
        x: 200,
        y: 300,
        w: 600,
        h: 300
      }));
    });
  });
  describe('padded layout scenario', function() {
    var layout, num_tiles, tile, tiled_windows, window1, window2, window3, window4;
    afterEach(function() {
      Layout.LayoutState.padding = 0;
    });
    beforeEach(function() {
      layout = _new_layout(800, 600);
      Layout.LayoutState.padding = 10;
      num_tiles = function() {
        return _num_tiles(layout);
      };
      tiled_windows = function() {
        return _tiled_windows(layout);
      };
      tile = function(w) {
        return _tile(layout, w);
      };
      window1 = new MockWindow('window1');
      window2 = new MockWindow('window2');
      window3 = new MockWindow('window3');
      window4 = new MockWindow('window4');
    });
    it('should not pad a fullscreen window', function() {
      tile(window1);
      eq(num_tiles(), 1);
      return eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 800,
        h: 600
      }));
    });
    it('should pad both sides of a single split', function() {
      tile(window1);
      tile(window2);
      eq(num_tiles(), 2);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 390,
        h: 600
      }));
      return eq(window2.rect(), to_rect({
        x: 410,
        y: 0,
        w: 390,
        h: 600
      }));
    });
    it('should pad both sides of a secondary split', function() {
      tile(window1);
      tile(window2);
      tile(window3);
      eq(num_tiles(), 3);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 390,
        h: 600
      }));
      eq(window2.rect(), to_rect({
        x: 410,
        y: 0,
        w: 390,
        h: 290
      }));
      return eq(window3.rect(), to_rect({
        x: 410,
        y: 310,
        w: 390,
        h: 290
      }));
    });
    it('should pad all joins in a multiple-split layout', function() {
      tile(window1);
      tile(window2);
      tile(window3);
      tile(window4);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 390,
        h: 600
      }));
      eq(window2.rect(), to_rect({
        x: 410,
        y: 0,
        w: 390,
        h: 290
      }));
      eq(window3.rect(), to_rect({
        x: 410,
        y: 310,
        w: 390,
        h: 135
      }));
      return eq(window4.rect(), to_rect({
        x: 410,
        y: 465,
        w: 390,
        h: 135
      }));
    });
  });
  
  // TODO: get these working
  describe.skip('adjusting splits to accomodate window', function() {
    var layout, num_tiles, reset, resize, tile, tiled_windows, window1, window2, window3, window4;
    layout = null;
    num_tiles = function() {
      return _num_tiles(layout);
    };
    tiled_windows = function() {
      return _tiled_windows(layout);
    };
    tile = function(w) {
      return _tile(layout, w);
    };
    resize = function(win, f) {
      f(win.rect);
      log("triggering resize / move for new rect " + (j(win.rect)));
      layout.on_window_moved(win);
      return layout.on_window_resized(win);
    };
    window1 = new MockWindow('window1');
    window2 = new MockWindow('window2');
    window3 = new MockWindow('window3');
    window4 = new MockWindow('window4');
    reset = function() {
      layout = _new_layout(800, 600);
      tile(window1);
      tile(window2);
      tile(window3);
      return tile(window4);
    };
    it('should tile naturally initially', function() {
      reset();
      eq(num_tiles(), 4);
      eq(window1.rect(), to_rect({
        x: 0,
        y: 0,
        w: 400,
        h: 600
      }));
      eq(window2.rect(), to_rect({
        x: 400,
        y: 0,
        w: 400,
        h: 300
      }));
      eq(window3.rect(), to_rect({
        x: 400,
        y: 300,
        w: 400,
        h: 150
      }));
      return eq(window4.rect(), to_rect({
        x: 400,
        y: 450,
        w: 400,
        h: 150
      }));
    });
    describe('main_split', function() {
      it('should adjust split for a resized LHS window', function() {
        reset();
        resize(window1, function(rect) {
          return rect.w = 200;
        });
        layout.adjust_splits_to_fit(window1);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 200,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 200,
          y: 0,
          w: 600,
          h: 300
        }));
        eq(window3.rect(), to_rect({
          x: 200,
          y: 300,
          w: 600,
          h: 150
        }));
        return eq(window4.rect(), to_rect({
          x: 200,
          y: 450,
          w: 600,
          h: 150
        }));
      });
      it('should adjust split for a moved and resized LHS window', function() {
        reset();
        resize(window1, function(rect) {
          rect.w = 200;
          rect.x = 100;
          rect.y = 50;
          return rect.h = 500;
        });
        layout.adjust_splits_to_fit(window1);
        eq(window1.rect(), to_rect({
          x: 100,
          y: 50,
          w: 200,
          h: 500
        }));
        eq(window2.rect(), to_rect({
          x: 300,
          y: 0,
          w: 500,
          h: 300
        }));
        eq(window3.rect(), to_rect({
          x: 300,
          y: 300,
          w: 500,
          h: 150
        }));
        return eq(window4.rect(), to_rect({
          x: 300,
          y: 450,
          w: 500,
          h: 150
        }));
      });
      it('should adjust split for a resized RHS window', function() {
        reset();
        resize(window2, function(rect) {
          rect.x = 600;
          return rect.w = 200;
        });
        layout.adjust_splits_to_fit(window2);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 600,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 600,
          y: 0,
          w: 200,
          h: 300
        }));
        eq(window3.rect(), to_rect({
          x: 600,
          y: 300,
          w: 200,
          h: 150
        }));
        return eq(window4.rect(), to_rect({
          x: 600,
          y: 450,
          w: 200,
          h: 150
        }));
      });
      it('should adjust split for a moved and resized RHS window', function() {
        reset();
        resize(window2, function(rect) {
          rect.x = 500;
          return rect.w = 200;
        });
        layout.adjust_splits_to_fit(window2);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 500,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 500,
          y: 0,
          w: 200,
          h: 300
        }));
        eq(window3.rect(), to_rect({
          x: 500,
          y: 300,
          w: 300,
          h: 150
        }));
        return eq(window4.rect(), to_rect({
          x: 500,
          y: 450,
          w: 300,
          h: 150
        }));
      });
    });
    describe('minor splits', function() {
      it('should adjust split for resized initial window', function() {
        reset();
        resize(window2, function(rect) {
          return rect.h = 200;
        });
        layout.adjust_splits_to_fit(window2);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 400,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 400,
          y: 0,
          w: 400,
          h: 200
        }));
        eq(window3.rect(), to_rect({
          x: 400,
          y: 200,
          w: 400,
          h: 200
        }));
        return eq(window4.rect(), to_rect({
          x: 400,
          y: 400,
          w: 400,
          h: 200
        }));
      });
      it('should adjust split for resized and moved initial window', function() {
        reset();
        resize(window2, function(rect) {
          rect.y += 100;
          return rect.h -= 200;
        });
        layout.adjust_splits_to_fit(window2);
        eq(window2.rect(), to_rect({
          x: 400,
          y: 100,
          w: 400,
          h: 100
        }));
        eq(window3.rect(), to_rect({
          x: 400,
          y: 200,
          w: 400,
          h: 200
        }));
        return eq(window4.rect(), to_rect({
          x: 400,
          y: 400,
          w: 400,
          h: 200
        }));
      });
      it('should adjust single above split for resized second window', function() {
        reset();
        resize(window3, function(rect) {
          rect.y -= 50;
          return rect.h += 50;
        });
        layout.adjust_splits_to_fit(window3);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 400,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 400,
          y: 0,
          w: 400,
          h: 250
        }));
        eq(window3.rect(), to_rect({
          x: 400,
          y: 250,
          w: 400,
          h: 200
        }));
        return eq(window4.rect(), to_rect({
          x: 400,
          y: 450,
          w: 400,
          h: 150
        }));
      });
      it('should adjust single above split and below split for second window resized and moved', function() {
        reset();
        resize(window3, function(rect) {
          rect.y -= 50;
          return rect.h += 100;
        });
        layout.adjust_splits_to_fit(window3);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 400,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 400,
          y: 0,
          w: 400,
          h: 250
        }));
        eq(window3.rect(), to_rect({
          x: 400,
          y: 250,
          w: 400,
          h: 250
        }));
        return eq(window4.rect(), to_rect({
          x: 400,
          y: 500,
          w: 400,
          h: 100
        }));
      });
      it('should adjust multiple above split for resized third window', function() {
        reset();
        resize(window4, function(rect) {
          rect.y -= 100;
          return rect.h += 100;
        });
        layout.adjust_splits_to_fit(window4);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 400,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 400,
          y: 0,
          w: 400,
          h: 233
        }));
        eq(window3.rect(), to_rect({
          x: 400,
          y: 233,
          w: 400,
          h: 117
        }));
        return eq(window4.rect(), to_rect({
          x: 400,
          y: 350,
          w: 400,
          h: 250
        }));
      });
      it('should adjust multiple above splits for resized and moved final window', function() {
        reset();
        resize(window4, function(rect) {
          rect.y -= 100;
          return rect.h += 50;
        });
        layout.adjust_splits_to_fit(window4);
        eq(window1.rect(), to_rect({
          x: 0,
          y: 0,
          w: 400,
          h: 600
        }));
        eq(window2.rect(), to_rect({
          x: 400,
          y: 0,
          w: 400,
          h: 233
        }));
        eq(window3.rect(), to_rect({
          x: 400,
          y: 233,
          w: 400,
          h: 117
        }));
        return eq(window4.rect(), to_rect({
          x: 400,
          y: 350,
          w: 400,
          h: 200
        }));
      });
    });
  });
});

