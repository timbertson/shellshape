divideAfter = (num, items) ->
	return [items[0 ... num], items[num ... ]]

Axis = {
	other: (axis) -> return if axis == 'y' then 'x' else 'y'
}
_ = (s) -> JSON.stringify(s)

HALF = 0.5


Tile = {
	copyRect: (rect) ->
		return {pos:{x:rect.pos.x, y:rect.pos.y}, size:{x:rect.size.x, y:rect.size.y}}

	splitRect: (rect, axis, ratio) ->
		log("#splitRect: splitting rect of " + _(rect) + " along the " + axis + " axis with ratio " + ratio)
		if(ratio > 1 || ratio < 0)
			throw("invalid ratio: " + ratio + " (must be between 0 and 1)")
		newSizeA = rect.size[axis] * ratio
		newSizeB = rect.size[axis] - newSizeA

		newRect = Tile.copyRect(rect)
		rect = Tile.copyRect(rect)
		rect.size[axis] = newSizeA
		newRect.size[axis] = newSizeB
		newRect.pos[axis] += newSizeA
		log("rect copy: " + _(rect))
		log("newRect: " + _(newRect))
		return [rect, newRect]

	joinRects: (a, b) ->
		pos = {
			x: Math.min(a.pos.x, b.pos.x),
			y: Math.min(a.pos.y, b.pos.y)
		}

		sx = Math.max((a.pos.x + a.size.x) - pos.x, (b.pos.x + b.size.x) - pos.x)
		sy = Math.max((a.pos.y + a.size.y) - pos.y, (b.pos.y + b.size.y) - pos.y)
		size = {x: sx, y: sy}
		return {pos: pos, size: size}
}

class Split
	constructor: (@axis) ->
		@ratio = HALF
	
	layout_one: (rect, windows) ->
		first_window = windows.shift()
		[window_rect, remaining] = Tile.splitRect(rect, @axis, @ratio)
		first_window.set_rect(window_rect)
		window.bottomSplit = this
		if windows.length > 0
			log("windows is #{windows.length} -- #{windows}")
			windows[0].topSplit = this
			windows[0].bottomSplit = undefined
		return [remaining, windows]

class MultiSplit
	# a slpitter that contains multiple windows on either side,
	# which is split along @axis (where 'x' is a split
	# that contains windows to the left and right)
	constructor: (@axis, @primaryWindows) ->
		@ratio = HALF

	split: (bounds, windows) ->
		log("mainsplit: dividing #{windows.length} after #{@primaryWindows}")
		[left_windows, right_windows] = divideAfter(@primaryWindows, windows)
		if left_windows.length > 0 and right_windows.length > 0
			[left_rect, right_rect] = Tile.splitRect(bounds, @axis, @ratio)
		else
			# only one side wil actual be layed out...
			[left_rect, right_rect] = [bounds, bounds]
		#TODO: don't slit rect if a side is empty
		return [[left_rect, left_windows], [right_rect, right_windows]]

class HorizontalTiledLayout
	constructor: (screen_width, screen_height) ->
		@bounds = {pos:{x:0, y:0}, size:{x:screen_width, y:screen_height}}
		@tiles = []
		@mainAxis = 'x'
		@mainSplit = new MultiSplit(@mainAxis, 1)
		@splits = { left: [], right: []}

	each: (func) ->
		func(tile) for tile in this.tiles

	contains: (win) ->
		return this.indexOf(win) != -1

	indexOf: (win) ->
		idx = -1
		@each (tile, i) ->
			idx = i if(tile.window == win)
		return idx
	
	layout: ->
		[left, right] = @mainSplit.split(@bounds, @tiles)
		log("laying out #{left[1].length} windows on the left with rect #{_ left[0]}")
		log("laying out #{right[1].length} windows on the right with rect #{_ right[0]}")
		@layout_side(left..., @splits.left)
		@layout_side(right..., @splits.right)
	
	layout_side: (rect, windows, splits) ->
		axis = Axis.other(@mainAxis)

		extend_to = (size, array, generator) ->
			while array.length < size
				array.push(generator())

		log("laying out side with rect #{_ rect}, windows #{windows} and splits #{_ splits}")
		zip = (a,b) ->
			return ([a[i], b[i]] for i in [0 ... Math.min(a.length, b.length)])

		extend_to(windows.length, splits, -> new Split(axis))

		for [window, split] in zip(windows, splits)
			[rect, windows] = split.layout_one(rect, windows)

	add: (win) ->
		return if @contains(win)
		console.log("adding window " + win)
		tile = new TiledWindow(win)
		@tiles.push(tile)
		@layout()

	remove: (win) ->
		return unless @contains(win)
		log("removing window: " + win)
		@removeWindowAt(@indexOf(win))
		@layout()

	removeWindowAt: (idx) ->
		if(this.tiles.length <= idx)
			return null
		removed = this.tiles[idx]
		this.tiles.splice(idx, 1)
		removed.release()
		return removed

	log_state: (lbl) ->
		dump_win = (w) ->
			log("   - " + _(w.rect))

		log(" -------------- layout ------------- ")
		log(" // " + lbl)
		log(" - layout: " + _(this.layout))
		log(" - total windows: " + this.tiles.length)
		log("")
		log(" - main windows: " + this.main_windows().length)
		# log(_(this.tiles))
		this.main_windows().map(dump_win)
		log("")
		log(" - minor windows: " + this.minor_windows().length)
		this.minor_windows().map(dump_win)
		log(" ----------------------------------- ")

class TiledWindow
	constructor: (win) ->
		# notes:
		# - what is a unique key for a window?
		#   sm_client_id?
		#   startup_id?
		#   net_wm_pid?
		this.window = win
		this.original_rect = {pos: {x:win.xpos(), y:win.ypos()}, size: {x:win.width(), y:win.height()}}
		this.rect = {pos:{x:0, y:0}, size:{x:0, y:0}}

	move: (pos) ->
		this.window.move(false, pos.x, pos.y)

	resize : (size) ->
		this.window.resize(false, size.x, size.y)

	set_rect : (r) ->
		log("Setting rect to " + r)
		this.window.move_resize(false, r.pos.x, r.pos.y, r.size.x, r.size.y)

	layout: ->
		this.set_rect(this.rect)

	release: ->
		this.set_rect(this.original_rect)


window.HorizontalTiledLayout = HorizontalTiledLayout
window.Axis = Axis
window.Tile = Tile
window.Split = Split
window.MultiSplit = MultiSplit
window.TiledWindow = TiledWindow
