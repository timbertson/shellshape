#require("sys").puts("??")
tiling = require('../js/tiling')
window = {}
puts = require('sys').puts
require('helpers').extend(global, tiling)

util = require('util')
pp = (x) -> util.log(util.inspect(x))
log = util.log
# pp require("assert")
eq = deepEqual

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
	it 'should layout a copy with managed items followed by visible items' ->
		#todo

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

	it 'should join two rects', ->
		# test doesn't work as-written because coffee-script compiler is broken :(
		# eq Tile.joinRects({pos:{x:40, y:0},  size: {x:100, y:20}},
		# 	                {pos:{x:0,  y:40}, size: {x:100, y:20}}),
		# 	                {pos:{x:0,  y:0},  size: {x:140, y:60}}


class MockWindow
	move_resize: (ignored, x, y, w, h) ->
		@rect = {x:x, y:y, w:w, h:h}
		puts("resizing to: " + j(this.rect))

# describe 'HorizontalTiledLayout', ->
# 	it 'should have more specific tests ;)', ->
# 		layout = new tiling.HorizontalTiledLayout(800, 600)
# 		eq(layout.tiles.length, 0)
# 
# 		window1 = new MockWindow()
# 		layout.add(window1)
# 		eq(layout.tiles.length, 1)
# 		eq(window1.rect, {x:0, y:0, w:800, h:600})
# 
# 		window2 = new MockWindow()
# 		layout.add(window2)
# 		eq(layout.tiles.length, 2)
# 
# 		# win1 should be on left half; win2 on right half
# 		eq(window1.rect, {x:0, y:0, w:400, h:600})
# 		eq(window2.rect, {x:400, y:0, w:400, h:600})
# 
# 		layout.set_major_ratio(0.25)
# 		eq(window1.rect, {x:0, y:0, w:200, h:600})
# 		eq(window2.rect, {x:200, y:0, w:600, h:600})
# 
# 		window3 = new MockWindow()
# 		layout.add(window3)
# 		# win2 and win3 should now be sharing RHS of screen:
# 		eq(window1.rect, {x:0, y:0, w:200, h:600})
# 		eq(window2.rect, {x:200, y:0,   w:600, h:300})
# 		eq(window3.rect, {x:200, y:300, w:600, h:300})
# 
# 		# should not re-add windows
# 		( ->
# 			puts("PENDING..."); return
# 			layout.add(window3)
# 			eq(layout.tiles.length, 3)
# 		)()
# 
# 		layout.add_main_window_count(1)
# 		# win1 and win2 should now share LHS of screen
# 		eq(window1.rect, {x:0, y:0,   w:200, h:300})
# 		eq(window2.rect, {x:0, y:300, w:200, h:300})
# 		eq(window3.rect, {x:200, y:0, w:600, h:600})
# 
# 		layout.remove(window2)
# 		eq(layout.tiles.length, 2)
# 		eq(window1.rect, {x:0, y:0,   w:800, h:300})
# 		eq(window3.rect, {x:0, y:300, w:800, h:300})
# 
# 		# note: now windows are in order (1, 3, 2)
# 		layout.add(window2)
# 		eq(layout.tiles.length, 3)
# 		eq(window1.rect, {x:0, y:0,   w:200, h:300})
# 		eq(window3.rect, {x:0, y:300, w:200, h:300})
# 		eq(window2.rect, {x:200, y:0, w:600, h:600})
# 
# 		layout.adjust_major_window_count(-1)
# 		# and back to just one window on the LHS
# 		eq(window1.rect, {x:0, y:0, w:200, h:600})
# 		eq(window3.rect, {x:200, y:0,   w:600, h:300})
# 		eq(window2.rect, {x:200, y:300, w:600, h:300})
# 
# 
