Axis = {
	other: (axis) -> return if axis == 'y' then 'x' else 'y'
}
j = (s) -> JSON.stringify(s)

HALF = 0.5

ArrayUtil = {
	divideAfter: (num, items) ->
		return [items[0 ... num], items[num ... ]]
	moveItem: (array, start, end) ->
		removed = array.splice(start, 1)[0]
		array.splice(end, 0, removed)
		return array
}

Tile = {
	copyRect: (rect) ->
		return {pos:{x:rect.pos.x, y:rect.pos.y}, size:{x:rect.size.x, y:rect.size.y}}

	splitRect: (rect, axis, ratio) ->
		# log("#splitRect: splitting rect of " + j(rect) + " along the " + axis + " axis with ratio " + ratio)
		if(ratio > 1 || ratio < 0)
			throw("invalid ratio: " + ratio + " (must be between 0 and 1)")
		newSizeA = rect.size[axis] * ratio
		newSizeB = rect.size[axis] - newSizeA

		newRect = Tile.copyRect(rect)
		rect = Tile.copyRect(rect)
		rect.size[axis] = newSizeA
		newRect.size[axis] = newSizeB
		newRect.pos[axis] += newSizeA
		# log("rect copy: " + j(rect))
		# log("newRect: " + j(newRect))
		return [rect, newRect]
	
	minmax: (a,b) -> [Math.min(a,b), Math.max(a,b)]
	midpoint: (a,b) ->
		[min, max] = @minmax(a,b)
		Math.round(min + ((max - min) / 2))
	
	within: (val, a, b) ->
		[min, max] = @minmax(a,b)
		log("val #{val} within #{min},#{max}? #{val > min && val < max}")
		return (val > min && val < max)

	pointDiff: (a, b) ->
		{x: b.x - a.x, y: b.y - a.y}
	
	pointAdd: (a,b) ->
		{x: a.x + b.x, y: a.y + b.y}

	rectCenter: (rect) ->
		{
			x: @midpoint(rect.pos.x, rect.pos.x + rect.size.x),
			y: @midpoint(rect.pos.y, rect.pos.y + rect.size.y)
		}
	
	pointIsWithin: (point, rect) ->
		(
			@within(point.x, rect.pos.x, rect.pos.x + rect.size.x) &&
			@within(point.y, rect.pos.y, rect.pos.y + rect.size.y)
		)

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

# Constraints = [
# 	new KeepWindowWithinTile(),
# 	new KeepWindowSizeLessThanScreenSize(),
# 	new PositionWindow(),
# ]


class Split
	constructor: (@axis) ->
		@ratio = HALF
	
	layout_one: (rect, windows) ->
		first_window = windows.shift()
		if windows.length == 0
			first_window.set_rect(rect)
			return [{}, []]
		[window_rect, remaining] = Tile.splitRect(rect, @axis, @ratio)
		first_window.set_rect(window_rect)
		return [remaining, windows]
	
	adjust_ratio: (diff) ->
		@ratio = Math.min(1, Math.max(0, @ratio + diff))
		log("ratio is now " + @ratio)
	
	toString: -> "Split with ratio #{@ratio}"

class MultiSplit
	# a slpitter that contains multiple windows on either side,
	# which is split along @axis (where 'x' is a split
	# that contains windows to the left and right)
	constructor: (@axis, @primaryWindows) ->
		@ratio = HALF
	
	adjust_ratio: (diff) ->
		@ratio = Math.min(1, Math.max(0, @ratio + diff))

	split: (bounds, windows) ->
		# log("mainsplit: dividing #{windows.length} after #{@primaryWindows}")
		[left_windows, right_windows] = ArrayUtil.divideAfter(@primaryWindows, windows)
		if left_windows.length > 0 and right_windows.length > 0
			[left_rect, right_rect] = Tile.splitRect(bounds, @axis, @ratio)
		else
			# only one side wil actually be laid out...
			[left_rect, right_rect] = [bounds, bounds]
		return [[left_rect, left_windows], [right_rect, right_windows]]

class HorizontalTiledLayout
	STOP = '_stop_iter'
	is_managed = (tile) -> tile.managed

	constructor: (screen_width, screen_height) ->
		@bounds = {pos:{x:0, y:0}, size:{x:screen_width, y:screen_height}}
		@tiles = []
		@mainAxis = 'x'
		@mainSplit = new MultiSplit(@mainAxis, 1)
		@splits = { left: [], right: []}

	each_tiled: (func) ->
		@each (tile, idx) ->
			return func(tile,idx) if is_managed(tile)

	each: (func) ->
		for i in [0 ... @tiles.length]
			ret = func(@tiles[i], i)
			return if ret == STOP

	contains: (win) ->
		return this.indexOf(win) != -1

	indexOf: (win) ->
		idx = -1
		@each (tile, i) ->
			idx = i if(tile.window == win)
		# log("found window #{win} at idx #{idx}")
		return idx
	
	tile_for: (win) ->
		idx = @indexOf(win)
		throw("couldn't find window: " + window) if idx < 0
		@tiles[idx]
	
	managed_tiles: ->
		_.select(@tiles, is_managed)
	
	layout: ->
		[left, right] = @mainSplit.split(@bounds, @managed_tiles())
		# log("laying out #{left[1].length} windows on the left with rect #{j left[0]}")
		# log("laying out #{right[1].length} windows on the right with rect #{j right[0]}")
		@layout_side(left..., @splits.left)
		@layout_side(right..., @splits.right)
	
	layout_side: (rect, windows, splits) ->
		axis = Axis.other(@mainAxis)

		extend_to = (size, array, generator) ->
			while array.length < size
				array.push(generator())

		zip = (a,b) ->
			return ([a[i], b[i]] for i in [0 ... Math.min(a.length, b.length)])

		extend_to(windows.length, splits, -> new Split(axis))
		# log("laying out side with rect #{j rect}, windows #{windows} and splits #{ splits}")

		previous_split = null
		for [window, split] in zip(windows, splits)
			window.top_split = previous_split
			[rect, windows] = split.layout_one(rect, windows)
			window.bottom_split = if (windows.length > 0) then split else null
			previous_split = split

	add_main_window_count: (i) ->
		@mainSplit.primaryWindows += i
		@layout()
	
	tile: (win) ->
		@tile_for(win).tile()
		@layout()

	select_cycle: (offset) ->
		@active_tile (tile, idx) =>
			log("Active tile == #{idx}, #{tile.window.title}")
			@tiles[@wrap_index(idx + offset)].activate()
	
	wrap_index: (idx) ->
		while idx < 0
			idx += @tiles.length
		while idx >= @tiles.length
			idx -= @tiles.length
		idx

	add: (win) ->
		return if @contains(win)
		log("adding window " + win)
		tile = new TiledWindow(win)
		@tiles.push(tile)
		@layout()
	
	active_tile: (fn) ->
		first = true
		@each (tile, i) ->
			if tile.window.is_active()
				log(first)
				return unless first
				first = false
				fn(tile, i)

	cycle: (int) ->
		@active_tile (tile, idx) =>
			@_cycle(idx, int)

	_cycle: (idx, direction) ->
		new_pos = @wrap_index(idx + direction)
		log("moving tile at #{idx} to #{new_pos}")
		ArrayUtil.moveItem(@tiles, idx, new_pos)
		@layout()
	
	adjust_main_window_area: (diff) ->
		@mainSplit.adjust_ratio(diff)
		@layout()
	
	adjust_current_window_size: (diff) ->
		@active_tile (tile) =>
			log("btm split: " + tile.bottom_split)
			log("top split: " + tile.top_split)
			if tile.bottom_split
				tile.bottom_split.adjust_ratio(diff)
			else if tile.top_split
				tile.top_split.adjust_ratio(-diff)
			@layout()
	
	swap_active_with_main: () ->
		@active_tile (tile, idx) =>
			return if idx == 0
			current_main = @tiles[0]
			@swap_windows_at(0, idx)
			@layout()

	untile: (win) ->
		@tile_for(win).release()
		@layout()

	# insertTileAt: (idx, tile) ->
	# 	@tiles.splice(idx,0, tile)
	# 	# log("put tile " + tile + " in at " + idx)
	# 	log(@tiles)

	_remove_tile_at: (idx) ->
		# log("removing tile #{idx} from #{this.tiles}")
		removed = this.tiles[idx]
		this.tiles.splice(idx, 1)
		removed.release()
		return removed
	
	on_window_created: (win) ->
		@add(win)
	on_window_killed: (win) ->
		@_remove_tile_at(@indexOf(win))

	on_window_moved: (win) ->
		idx = @indexOf(win)
		tile = @tiles[idx]
		@swap_moved_tile_if_necessary(tile, idx)
		@apply_move_constraints(tile)
		@layout()

	on_window_resized: (win) ->
		tile = @tiles[@indexOf(win)]
		@apply_resize_constraints(tile)
		@layout()
		true
	
	apply_move_constraints: (tile) ->
		log("applying move constraints to #{tile}")
		tile.update_offset()
		# tile_center = Tile.rectCenter(tile.rect)
		# window_center = Tile.rectCenter(tile.window_rect())
		# if !Tile.pointIsWithin(window_center, tile.rect)
		# 	Tile.moveRectOffset(Tile.pointDiff(tile_center, window_center))

	apply_resize_constraints: (tile) ->
		log("applying resize constraints to #{tile}")
		tile.update_offset()
	
	swap_moved_tile_if_necessary: (tile, idx) ->
		#TODO: should this be based on cursor position, not window midpoint?
		center = Tile.rectCenter(tile.window_rect())
		@each_tiled (swap_candidate, swap_idx) =>
			log("(midpoint #{j center}) within #{j swap_candidate.rect}?")
			if Tile.pointIsWithin(center, swap_candidate.rect)
				log("YES - swapping idx #{idx} and #{swap_idx}")
				@_swap_windows_at(idx, swap_idx)
				@layout()
				return STOP
	
	_swap_windows_at: (idx1, idx2) ->
		_orig = @tiles[idx2]
		@tiles[idx2] = @tiles[idx1]
		@tiles[idx1] = _orig

	log_state: (lbl) ->
		dump_win = (w) ->
			log("   - " + j(w.rect))

		log(" -------------- layout ------------- ")
		log(" // " + lbl)
		log(" - total windows: " + this.tiles.length)
		log("")
		log(" - main windows: " + this.mainsplit.primaryWindows)
		# log(j(this.tiles))
		this.main_windows().map(dump_win)
		log("")
		log(" - minor windows: " + @tiles.length - this.mainsplit.primaryWindows)
		this.minor_windows().map(dump_win)
		log(" ----------------------------------- ")

class TiledWindow
	constructor: (win) ->
		# notes:
		# - what is a unique key for a window?
		#   sm_client_id?
		#   startup_id?
		#   net_wm_pid?
		@window = win
		@original_rect = @window_rect()
		@rect = {pos:{x:0, y:0}, size:{x:0, y:0}}
		@reset_offset()
		@maximized_rect = null
		@managed = false

	tile: ->
		this.managed = true
	
	reset_offset: ->
		@offset = {pos: {x:0, y:0}, size: {x:0, y:0}}
	
	update_offset: ->
		rect = @rect
		win = @window_rect()
		@offset = {
			pos:  Tile.pointDiff(rect.pos,  win.pos),
			size: Tile.pointDiff(rect.size, win.size)
		}
		log("updated tile offset to #{j @offset}")
	
	window_rect: () ->
		{pos: {x:@window.xpos(), y:@window.ypos()}, size: {x:@window.width(), y:@window.height()}}

	# move: (pos) ->
	# 	this.window.move(false, pos.x, pos.y)
	
	toggle_maximize: (rect) ->
		if @maximized_rect
			@unmaximize()
		else
			@maximize(rect)

	maximize: (rect) ->
		this.maximized_rect = rect
		this.layout()
	
	unmaximize: ->
		this.maximized_rect = null
		this.layout()

	# resize : (size) ->
	# 	_resize(size)
	# 	this.window.resize(false, size.x, size.y)
	
	_resize: (size) ->
		@rect.size = {x:size.x, y:size.y}

	_move: (pos) ->
		@rect.pos = {x:pos.x, y:pos.y}

	set_rect : (r) ->
		log("Setting rect to " + j(r))
		log("offset rect to " + j(@offset))
		@_resize(r.size)
		@_move(r.pos)
		pos = Tile.pointAdd(r.pos, @offset.pos)
		size = Tile.pointAdd(r.size, @offset.size)
		this.window.move_resize(false, pos.x, pos.y, size.x, size.y)

	layout: ->
		this.set_rect(this.maximized_rect or this.rect)

	release: ->
		this.set_rect(this.original_rect)
		this.managed = false
	
	activate: ->
		@window.activate()
		@window.bringToFront()


# hacky stuff for running in both the browser & gjs
if reqire?
	log = require('util').log
else
	log = (s) ->
		console.log(s) if console?

if window? and not exports?
	exports = window
exports.HorizontalTiledLayout = HorizontalTiledLayout
exports.Axis = Axis
exports.Tile = Tile
exports.Split = Split
exports.MultiSplit = MultiSplit
exports.TiledWindow = TiledWindow
exports.ArrayUtil = ArrayUtil
