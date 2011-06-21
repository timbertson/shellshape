#require("sys").puts("??")
tiling = require('../tiling')
window = {}
puts = require('sys').puts
require('helpers').extend(global, tiling)
j = JSON.stringify

util = require('util')
pp = (x) -> util.log(util.inspect(x))
log = util.log
# pp require("assert")
eq = deepEqual

tiling.to_get_mouse_position ->
	{x: 0, y:0}

describe 'ArrayUtil', ->
	it 'divideAfter should divide an array', ->
		eq(tiling.ArrayUtil.divideAfter(2, [1,2,3,4,5]), [[1,2], [3,4,5]])
	
	describe 'shiftItem', ->
		it 'should move an item forwards', ->
			eq(tiling.ArrayUtil.moveItem([1,2,3,4,5], 1, 2), [1,3,2,4,5])
			eq(tiling.ArrayUtil.moveItem([1,2,3,4,5], 0, 4), [2,3,4,5,1])

		it 'should move an item backwards', ->
			eq(tiling.ArrayUtil.moveItem([1,2,3,4,5], 2, 1), [1,3,2,4,5])
			eq(tiling.ArrayUtil.moveItem([1,2,3,4,5], 4, 0), [5,1,2,3,4])

describe 'tile collection', ->
	all_tiles = []
	deactivate_all = ->
		t.active = false for t in all_tiles
	_activate = () ->
		deactivate_all()
		@active = true
	_is_active = () ->
		@active
	_toString = -> @name

	tiled = (name) ->
		{
			name: "#{name} (tiled)",
			managed: true,
			is_minimized: -> false,
			toString: _toString,
			is_active: _is_active,
			activate: _activate
		}
	untiled = (name) ->
		{
			name: "#{name} (untiled)",
			managed: false,
			is_minimized: -> false,
			toString: _toString,
			is_active: _is_active,
			activate: _activate
		}
	minimized = (name) ->
		{
			name: "#{name} (minimized)",
			managed: false,
			is_minimized: -> true,
			toString: _toString,
			is_active: _is_active,
			activate: _activate
		}

	tiled_tiles = [tiled("0"), tiled("1"), tiled("2")]
	untiled_tiles = [untiled("0"), untiled("1")]
	minimized_tiles = [minimized("0"), minimized("1")]

	all_tiles = [minimized_tiles[0], tiled_tiles[0], untiled_tiles[0], tiled_tiles[1], untiled_tiles[1], minimized_tiles[1], tiled_tiles[2]]

	get_active = ->
		for t in all_tiles
			return t if t.is_active()
		return null
	
	get_tiled = (c) ->
		return c.filter(c.is_tiled, c.items)

	get_untiled = (c) ->
		return c.filter(c.is_visible_and_untiled, c.items)

	new_collection = ->
		c = new TileCollection()
		for tile in all_tiles
			c.push(tile)
		return c

	it 'should select the main window as the first tiled window', (pass) ->
		expect(1)
		c = new_collection()
		c.main (main) ->
			eq main, tiled_tiles[0]
			pass()

	it 'should select the next tile grouping tiled windows before untiled windows and skipping minimised windows', ->
		c = new_collection()
		tiled_tiles[0].activate()
		c.select_cycle(1)
		eq get_active(), tiled_tiles[1]
		c.select_cycle(1)
		eq get_active(), tiled_tiles[2]
		c.select_cycle(1)
		eq get_active(), untiled_tiles[0]
		c.select_cycle(1)
		eq get_active(), untiled_tiles[1]
		# loop around, skipping minimized windows
		c.select_cycle(1)
		eq get_active(), tiled_tiles[0]
	
	it 'should re-order tiled windows', ->
		c = new_collection()
		tiled_tiles[0].activate()
		c.cycle(1)
		eq get_tiled(c), [tiled_tiles[1], tiled_tiles[0], tiled_tiles[2]]
		eq get_active(), tiled_tiles[0]
		c.cycle(1)
		eq get_tiled(c), [tiled_tiles[1], tiled_tiles[2], tiled_tiles[0]]
		eq get_active(), tiled_tiles[0]
		c.cycle(1)
		eq get_tiled(c), [tiled_tiles[0], tiled_tiles[2], tiled_tiles[1]]
		eq get_active(), tiled_tiles[0]
	
	it 'should re-order untiled windows', ->
		c = new_collection()
		untiled_tiles[0].activate()
		c.cycle(1)
		eq get_tiled(c), [tiled_tiles[0], tiled_tiles[1], tiled_tiles[2]]
		eq get_untiled(c), [untiled_tiles[1], untiled_tiles[0]]
		eq get_active(), untiled_tiles[0]
		c.cycle(1)
		eq get_untiled(c), [untiled_tiles[0], untiled_tiles[1]]
		eq get_active(), untiled_tiles[0]


rect = (x,y,w,h) -> {pos: {x:x, y:y}, size: {x:w, y:h}}
describe 'rect* functions', ->
	describe 'moveRectWithin(rect, bounds)', ->
		bounds = {pos: {x:0, y:0}, size: {x:800, y:600}}
		it 'should leave a window that is within bounds', ->
			eq Tile.moveRectWithin(rect(10, 10, 400, 300), bounds), rect(0,0,0,0)

		it 'should move a window to the right if it is too leftwards', ->
			eq Tile.moveRectWithin(rect(-10, 10, 400, 300), bounds), rect(10,0,0,0)

		it 'should move a window to the left if it is too rightwards', ->
			eq Tile.moveRectWithin(rect(400, 10, 410, 300), bounds), rect(-10,0,0,0)

		it 'should move a window down if it is too high', ->
			eq Tile.moveRectWithin(rect(10, -10, 400, 300), bounds), rect(0,10,0,0)

		it 'should move a window up if it is too low', ->
			eq Tile.moveRectWithin(rect(10, 300, 400, 310), bounds), rect(0,-10,0,0)

		it 'should make a window match the bounds height if it is too tall', ->
			eq Tile.moveRectWithin(rect(10,  10, 400, 620), bounds), rect(0,-10,0,-20)
			eq Tile.moveRectWithin(rect(10, -10, 400, 620), bounds), rect(0, 10,0,-20)

		it 'should make a window match the bounds width if it is too wide', ->
			eq Tile.moveRectWithin(rect(10,  10, 820, 300), bounds), rect(-10,0,-20,0)
			eq Tile.moveRectWithin(rect(-10, 10, 820, 300), bounds), rect( 10,0,-20,0)

	describe 'adding rect offsets', ->
		it 'should add things', ->
			orig = {"pos":{"x":-4.200000286102295,"y":-4.200000286102295},"size":{"x":-181,"y":-48}}
			diff = {"pos":{"x":0,"y":4.200000286102295},"size":{"x":0,"y":0}}
			new_ = {"pos":{"x":-4.200000286102295,"y":0},"size":{"x":1,"y":1}}

			orig = {"pos":{"x":0,"y":0},"size":{"x":-181,"y":-48}}
			diff = {"pos":{"x":0,"y":0},"size":{"x":0,"y":0}}
			new_ = {"pos":{"x":0,"y":0},"size":{"x":-181,"y":-48}}
			eq Tile.addDiffToRect(orig, diff), new_

describe 'Window tiling / untiling', ->
	it 'should keep track of all windows', ->
		#TODO

describe 'Window Splitting / layout', ->
	#TODO..

describe 'Basic Tile functions', ->
	it 'should split x', ->
		eq Tile.splitRect({pos:{x:0,  y:0}, size: {x:100, y:200}}, 'x', 0.5),
			               [{pos:{x:0,  y:0}, size: {x:50,  y:200}},
			                {pos:{x:50, y:0}, size: {x:50,  y:200}}]
	it 'should split y', ->
		eq Tile.splitRect({pos:{x:0,  y:0},   size: {x:100, y:200}}, 'y', 0.5),
			               [{pos:{x:0,  y:0},   size: {x:100, y:100}},
			                {pos:{x:0,  y:100}, size: {x:100, y:100}}]
	it 'should split non-evenly', ->
		eq Tile.splitRect({pos:{x:0,  y:0},  size: {x:100, y:200}}, 'y', 0.1),
			               [{pos:{x:0,  y:0},  size: {x:100, y:20}},
			                {pos:{x:0,  y:20}, size: {x:100, y:180}}]

	# it 'should join two rects', ->
	# 	# test doesn't work as-written because coffee-script compiler is broken :(
	# 	eq(Tile.joinRects({pos:{x:40, y:0},  size: {x:100, y:20}},
	# 		                {pos:{x:0,  y:40}, size: {x:100, y:20}}),
	# 		                {pos:{x:0,  y:0},  size: {x:140, y:60}})


class MockWindow
	constructor: (name) ->
		@rect = {x:0, y:0, w:0, h:0}
		@name = name
	move_resize: (x, y, w, h) ->
		@rect = {x:Math.round(x), y:Math.round(y), w:Math.round(w), h:Math.round(h)}
		puts("#{@name}: resizing to: " + j(this.rect))
	
	xpos: -> @rect.x
	ypos: -> @rect.y
	width: -> @rect.w
	height: -> @rect.h
	is_active: -> @active || false
	isMinimized: -> false
	toString: ->
		"<MockWindow (#{@name}) @ #{j @rect}>"
	beforeRedraw: (f) -> f()
	activate: -> null
	bringToFront: -> null

describe 'HorizontalTiledLayout', ->
	_num_tiles = (layout) ->
		_tiled_windows(layout).length
	_tile = (layout, win) ->
		layout.add(win)
		layout.tile(win)
	_tiled_windows = (layout) ->
		tiles = layout.tiles.filter(layout.tiles.is_tiled, layout.tiles.items)
		(tile.window for tile in tiles)

	with_active = (win, f) ->
		win.active = true
		try
			f()
		finally
			win.active = false

	describe 'big ol\' layout scenario', ->
		#TODO: These tests are completely order-dependant.
		#      That should be fixed.
		layout = new tiling.HorizontalTiledLayout(0, 0, 800, 600)
		num_tiles =  -> _num_tiles(layout)
		tiled_windows = -> _tiled_windows(layout)
		tile = (w) -> _tile(layout, w)

		window1 = new MockWindow('window1')
		window2 = new MockWindow('window2')
		window3 = new MockWindow('window3')

		it 'should start with no tiles', ->
			eq(num_tiles(layout), 0)

		it 'should tile a single window', ->
			tile(window1)
			eq(num_tiles(), 1)
			eq(window1.rect, {x:0, y:0, w:800, h:600})

		it 'should tile a second window', ->
			tile(window2)
			eq(num_tiles(), 2)

			# win1 should be on left half; win2 on right half
			eq(window1.rect, {x:0, y:0, w:400, h:600})
			eq(window2.rect, {x:400, y:0, w:400, h:600})

		it 'should adjust main split ratio', ->
			layout.adjust_main_window_area(-0.25)
			eq(window1.rect, {x:0, y:0, w:200, h:600})
			eq(window2.rect, {x:200, y:0, w:600, h:600})

		it 'should tile a third window', ->
			tile(window3)
			# win2 and win3 should now be sharing RHS of screen:
			eq(window1.rect, {x:0, y:0, w:200, h:600})
			eq(window2.rect, {x:200, y:0,   w:600, h:300})
			eq(window3.rect, {x:200, y:300, w:600, h:300})

		it 'should not re-add windows', ->
			tile(window3)
			eq(num_tiles(), 3)

		it 'should move an additional window into main area', ->
			layout.add_main_window_count(1)
			# win1 and win2 should now share LHS of screen
			eq(window1.rect, {x:0, y:0,   w:200, h:300})
			eq(window2.rect, {x:0, y:300, w:200, h:300})
			eq(window3.rect, {x:200, y:0, w:600, h:600})

		it 'should remove a window from the main area', ->
			layout.untile(window2)
			eq(num_tiles(), 2)
			eq(window1.rect, {x:0, y:0,   w:800, h:300})
			eq(window3.rect, {x:0, y:300, w:800, h:300})

		it 'should re-add an untiled window', ->
			# note: window is added back in original position
			tile(window2)
			eq(num_tiles(), 3)
			eq(window1.rect, {x:0, y:0,   w:200, h:300})
			eq(window2.rect, {x:0, y:300, w:200, h:300})
			eq(window3.rect, {x:200, y:0, w:600, h:600})

		it 'should swap adjacent windows', ->
			with_active window2, ->
				layout.cycle(1)
				# note: now windows are in order (1, 3, 2)
				eq(num_tiles(), 3)
				eq(tiled_windows(), [window1, window3, window2])
				eq(window1.rect, {x:0, y:0,   w:200, h:300})
				eq(window3.rect, {x:0, y:300, w:200, h:300})
				eq(window2.rect, {x:200, y:0, w:600, h:600})

		it 'should take a window out of the main area', ->
			layout.add_main_window_count(-1)
			# and back to just one window on the LHS
			eq(window1.rect, {x:0, y:0, w:200, h:600})
			eq(window3.rect, {x:200, y:0,   w:600, h:300})
			eq(window2.rect, {x:200, y:300, w:600, h:300})

	describe 'adjusting splits to accomodate window', ->
		layout = null
		num_tiles =  -> _num_tiles(layout)
		tiled_windows = -> _tiled_windows(layout)
		tile = (w) -> _tile(layout, w)
		resize = (win, f) ->
			f(win.rect)
			log("triggering resize / move for new rect #{j win.rect}")
			layout.on_window_moved(win)
			layout.on_window_resized(win)

		window1 = new MockWindow('window1')
		window2 = new MockWindow('window2')
		window3 = new MockWindow('window3')
		window4 = new MockWindow('window4')

		reset = ->
			layout = new tiling.HorizontalTiledLayout(0, 0, 800, 600)
			tile(window1)
			tile(window2)
			tile(window3)
			tile(window4)

		it 'should tile naturally initially', ->
			reset()
			eq(num_tiles(), 4)
			eq(window1.rect, {x:0,   y:0,   w:400, h:600})
			eq(window2.rect, {x:400, y:0,   w:400, h:300})
			eq(window3.rect, {x:400, y:300, w:400, h:150})
			eq(window4.rect, {x:400, y:450, w:400, h:150})

		describe 'mainSplit', ->
			it 'should adjust split for a resized LHS window', ->
				reset()
				resize window1, (rect) ->
					rect.w = 200
				layout.adjust_splits_to_fit(window1)
				eq(window1.rect, {x:0,   y:0,   w:200, h:600})
				eq(window2.rect, {x:200, y:0,   w:600, h:300})
				eq(window3.rect, {x:200, y:300, w:600, h:150})
				eq(window4.rect, {x:200, y:450, w:600, h:150})

			it 'should adjust split for a moved and resized LHS window', ->
				reset()
				resize window1, (rect) ->
					rect.w = 200
					rect.x = 100
					rect.y = 50
					rect.h = 500
				layout.adjust_splits_to_fit(window1)
				eq(window1.rect, {x:100, y:50,  w:200, h:500})
				eq(window2.rect, {x:300, y:0,   w:500, h:300})
				eq(window3.rect, {x:300, y:300, w:500, h:150})
				eq(window4.rect, {x:300, y:450, w:500, h:150})

			it 'should adjust split for a resized RHS window', ->
				reset()
				resize window2, (rect) ->
					rect.x = 600
					rect.w = 200
				layout.adjust_splits_to_fit(window2)
				eq(window1.rect, {x:0,   y:0,   w:600, h:600})
				eq(window2.rect, {x:600, y:0,   w:200, h:300})
				eq(window3.rect, {x:600, y:300, w:200, h:150})
				eq(window4.rect, {x:600, y:450, w:200, h:150})

			it 'should adjust split for a moved and resized RHS window', ->
				reset()
				resize window2, (rect) ->
					rect.x = 500
					rect.w = 200
				layout.adjust_splits_to_fit(window2)
				eq(window1.rect, {x:0,   y:0,   w:500, h:600})
				eq(window2.rect, {x:500, y:0,   w:200, h:300})
				eq(window3.rect, {x:500, y:300, w:300, h:150})
				eq(window4.rect, {x:500, y:450, w:300, h:150})

		describe 'minor splits', ->
			it 'should adjust split for resized initial window', ->
				reset()
				resize window2, (rect) ->
					rect.h = 200
				layout.adjust_splits_to_fit(window2)
				eq(window1.rect, {x:0,   y:0,   w:400, h:600})
				eq(window2.rect, {x:400, y:0,   w:400, h:200})
				eq(window3.rect, {x:400, y:200, w:400, h:200})
				eq(window4.rect, {x:400, y:400, w:400, h:200})

			it 'should adjust split for resized and moved initial window', ->
				reset()
				resize window2, (rect) ->
					rect.y += 100
					rect.h -= 200
				layout.adjust_splits_to_fit(window2)
				eq(window2.rect, {x:400, y:100, w:400, h:100})
				eq(window3.rect, {x:400, y:200, w:400, h:200})
				eq(window4.rect, {x:400, y:400, w:400, h:200})

			it 'should adjust single above split for resized second window', ->
				reset()
				resize window3, (rect) ->
					# move top edge up 50px on window3, which is the
					# second window in the RHS
					rect.y -= 50
					rect.h += 50
				layout.adjust_splits_to_fit(window3)
				eq(window1.rect, {x:0,   y:0,   w:400, h:600})
				eq(window2.rect, {x:400, y:0,   w:400, h:250})
				eq(window3.rect, {x:400, y:250, w:400, h:200})
				eq(window4.rect, {x:400, y:450, w:400, h:150})

			it 'should adjust single above split and below split for second window resized and moved', ->
				reset()
				resize window3, (rect) ->
					# move top edge up 50px on window3, which is the
					# second window in the RHS
					rect.y -= 50
					rect.h += 100
				layout.adjust_splits_to_fit(window3)
				eq(window1.rect, {x:0,   y:0,   w:400, h:600})
				eq(window2.rect, {x:400, y:0,   w:400, h:250})
				eq(window3.rect, {x:400, y:250, w:400, h:250})
				eq(window4.rect, {x:400, y:500, w:400, h:100})

			it 'should adjust multiple above split for resized third window', ->
				reset()
				resize window4, (rect) ->
					rect.y -= 100
					rect.h += 100
				layout.adjust_splits_to_fit(window4)
				#Note: rounded to integers here for easier representation
				eq(window1.rect, {x:0,   y:0,   w:400, h:600})
				eq(window2.rect, {x:400, y:0,   w:400, h:233})
				eq(window3.rect, {x:400, y:233, w:400, h:117})
				eq(window4.rect, {x:400, y:350, w:400, h:250})

			it 'should adjust multiple above splits for resized and moved final window', ->
				reset()
				resize window4, (rect) ->
					rect.y -= 100
					rect.h += 50
				layout.adjust_splits_to_fit(window4)
				#Note: rounded to integers here for easier representation
				eq(window1.rect, {x:0,   y:0,   w:400, h:600})
				eq(window2.rect, {x:400, y:0,   w:400, h:233})
				eq(window3.rect, {x:400, y:233, w:400, h:117})
				eq(window4.rect, {x:400, y:350, w:400, h:200})
