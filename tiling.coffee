Axis = {
	other: (axis) -> return if axis == 'y' then 'x' else 'y'
}
j = (s) -> JSON.stringify(s)

HALF = 0.5
STOP = '_stop_iter'

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

	addDiffToRect: (rect, diff) ->
		return {
			pos: Tile.pointAdd(rect.pos, diff.pos),
			size: Tile.pointAdd(rect.size, diff.size)
		}
	
	ensureRectExists: (rect) ->
		rect.size.x = Math.max(1, rect.size.x)
		rect.size.y = Math.max(1, rect.size.y)
		return rect

	zeroRect: (rect) ->
		return (
			rect.pos.x == 0 and rect.pos.y == 0 and
			rect.size.x == 0 and rect.size.y == 0
		)
	
	minmax: (a,b) -> [Math.min(a,b), Math.max(a,b)]
	midpoint: (a,b) ->
		[min, max] = @minmax(a,b)
		Math.round(min + ((max - min) / 2))
	
	within: (val, a, b) ->
		[min, max] = @minmax(a,b)
		# log("val #{val} within #{min},#{max}? #{val > min && val < max}")
		return (val > min && val < max)
	
	moveRectWithin: (original_rect, bounds) ->
		# log("moving #{j original_rect} to be within #{j bounds}")
		min = Math.min
		max = Math.max

		rect = Tile.copyRect(original_rect)

		rect.size.x = min(rect.size.x, bounds.size.x)
		rect.size.y = min(rect.size.y, bounds.size.y)

		rect.pos.x = max(rect.pos.x, bounds.pos.x)
		rect.pos.y = max(rect.pos.y, bounds.pos.y)

		extent = (rect, axis) -> rect.pos[axis] + rect.size[axis]
		rect.pos.x -= max(0, extent(rect, 'x') - extent(bounds, 'x'))
		rect.pos.y -= max(0, extent(rect, 'y') - extent(bounds, 'y'))

		return {
			pos: @pointDiff(original_rect.pos, rect.pos),
			size: @pointDiff(original_rect.size, rect.size)
		}

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

class TileCollection
	constructor: ->
		@items = []
	
	is_visible: (item) => !item.is_minimized()
	is_visible_and_unmanaged: (item) => (!@is_managed(item)) && @is_visible(item)
	is_managed: (item) => item.managed
	is_active: (item) => item.is_active()
	sort_order: (item) =>
		if @is_managed(item)
			0
		else if @is_visible(item)
			1
		else
			2

	sorted_with_indexes: ->
		items_and_indexes = []
		ts = -> "#{this.item}@#{this.index}"
		for index in [0 ... @items.length]
			items_and_indexes.push({item: @items[index], index: index, toString: ts})
		# log("\nSORTING: #{j items_and_indexes}")
		sorted = items_and_indexes.slice().sort (a,b) =>
			ordera = @sort_order(a.item)
			orderb = @sort_order(b.item)
			if ordera == orderb
				return a.index - b.index
			else
				# ensure a stable sort by using index position for equivalent windows
				return ordera - orderb
		# log("sorted: #{items_and_indexes}\n    to: #{sorted}")
		return sorted
	
	_wrap_index: (idx, length) ->
		while idx < 0
			idx += length
		while idx >= length
			idx -= length
		idx

	filter: (f, items) -> (item for item in items when f(item))

	select_cycle: (diff) ->
		@_with_active_and_neighbor_when_filtered @is_visible, diff, (active, neighbor) =>
			neighbor.item.activate()
	
	sorted_view: (filter) ->
		f = (obj) =>
			filter(obj.item)
		@filter(f, @sorted_with_indexes())
	
	_with_active_and_neighbor_when_filtered: (filter, diff, cb) ->
		filtered = @sorted_view(filter)
		active = null
		# active_idx = null
		# @active (tile, idx) ->
		# 	active = tile
		# 	active_idx = idx

		filtered_active_idx = @_index_where filtered, (obj) =>
			@is_active(obj.item)
		return false if filtered_active_idx == null

		new_idx = @_wrap_index filtered_active_idx + diff, filtered.length
		cb(filtered[filtered_active_idx], filtered[new_idx])
		return true

	cycle: (diff) ->
		# only one of these will have any effect, as the active tile is either tiled or untiled
		done = @_with_active_and_neighbor_when_filtered @is_managed, diff, (active, neighbor) =>
			@swap_at(active.index, neighbor.index)
		done or @_with_active_and_neighbor_when_filtered @is_visible_and_unmanaged, diff, (active, neighbor) =>
			@swap_at(active.index, neighbor.index)

	_index_where: (elems, cond) ->
		for i in [0 ... elems.length]
			if cond(elems[i])
				return i
		return null
	
	_wrap_index_until: (initial, offset, length, condition) ->
		index = initial
		while true
			index = @_wrap_index(index + offset, length)
			if index == initial
				# break cycle in single-element list
				return initial
			else if condition(index)
				return index
			
	
	swap_at: (idx1, idx2) ->
		log("swapping items at index #{idx1} and #{idx2}")
		_orig = @items[idx2]
		@items[idx2] = @items[idx1]
		@items[idx1] = _orig

	contains: (item) ->
		ret = false
		@each (tile) =>
			if item == tile
				ret = true
				return STOP
		return ret

	push: (item) ->
		return if @contains(item)
		@items.push(item)
	
	each: (f) ->
		for i in [0 ... @items.length]
			ret = f(@items[i], i)
			return true if ret == STOP
		return false
	each_tiled: (f) -> @_filtered_each(@is_managed, f)
	_filtered_each: (filter, f) ->
		each (tile, idx) =>
			f(tile, idx) if filter(tile)

	active: (f) ->
		@each (item, idx) =>
			if @is_active(item)
				f(item, idx)
				return STOP

	for_layout: ->
		# log("tiles = #{@items}, filtered = #{@filter(@is_managed, @items)}")
		@filter(@is_managed, @items)

	remove_at: (idx) ->
		@items.splice(idx, 1)
	
	main: (f) ->
		@each (tile, idx) =>
			if @is_managed(tile)
				f(tile, idx)
				return STOP


class BaseSplit
	constructor: (@axis) ->
		@ratio = HALF

	adjust_ratio: (diff) ->
		@ratio = Math.min(1, Math.max(0, @ratio + diff))

	save_last_rect: (rect) ->
		@last_size = rect.size[@axis]

	adjust_ratio_px: (diff) ->
		log("adjusting ratio #{@ratio} by #{diff} px")
		current_px = @ratio * @last_size
		log("current ratio makes for #{current_px} px (assiming last size of #{@last_size}")
		new_px = current_px + diff
		log("but we want #{new_px}")
		new_ratio = new_px / @last_size
		throw new "failed ratio: #{new_ratio}" if not Tile.within(new_ratio, 0, 1)
		log("which makes a new ratio of #{new_ratio}")
		@ratio = new_ratio

class Split extends BaseSplit
	layout_one: (rect, windows) ->
		@save_last_rect(rect)
		first_window = windows.shift()
		if windows.length == 0
			first_window.set_rect(rect)
			return [{}, []]
		[window_rect, remaining] = Tile.splitRect(rect, @axis, @ratio)
		first_window.set_rect(window_rect)
		return [remaining, windows]
	
	toString: -> "Split with ratio #{@ratio}"

class MultiSplit extends BaseSplit
	# a slpitter that contains multiple windows on either side,
	# which is split along @axis (where 'x' is a split
	# that contains windows to the left and right)
	constructor: (axis, @primaryWindows) ->
		super(axis)
	
	split: (bounds, windows) ->
		@save_last_rect(bounds)
		log("mainsplit: dividing #{windows.length} after #{@primaryWindows} for bounds #{j bounds}")
		[left_windows, right_windows] = ArrayUtil.divideAfter(@primaryWindows, windows)
		if left_windows.length > 0 and right_windows.length > 0
			[left_rect, right_rect] = Tile.splitRect(bounds, @axis, @ratio)
		else
			# only one side wil actually be laid out...
			[left_rect, right_rect] = [bounds, bounds]
		return [[left_rect, left_windows], [right_rect, right_windows]]
	
	in_primary_partition: (idx) ->
		# log("on left? #{idx}, #{@primaryWindows} == #{idx < @primaryWindows}")
		idx < @primaryWindows
	
class HorizontalTiledLayout
	constructor: (screen_offset_x, screen_offset_y, screen_width, screen_height) ->
		@bounds = {
			pos:{x:screen_offset_x, y:screen_offset_y},
			size:{x:screen_width, y:screen_height}
		}
		@tiles = new TileCollection()
		@mainAxis = 'x'
		@mainSplit = new MultiSplit(@mainAxis, 1)
		@splits = { left: [], right: []}

	each_tiled: (func) ->
		@tiles.each_tiled(func)

	each: (func) ->
		@tiles.each(func)

	contains: (win) ->
		@tiles.contains(win)

	tile_for: (win, func) ->
		@tiles.each (tile, idx) ->
			if tile.window == win
				func(tile, idx)
				return STOP
	
	layout: ->
		active = null
		@active_tile((tile) -> active = tile.window)
		layout_windows = @tiles.for_layout()
		[left, right] = @mainSplit.split(@bounds, layout_windows)
		log("split screen into rect #{j left[0]} | #{j right[0]}")
		@layout_side(left..., @splits.left)
		@layout_side(right..., @splits.right)
		if active
			log("preserving active window before layout: " + active)
			active.beforeRedraw( -> active.activate())
	
	layout_side: (rect, windows, splits) ->
		axis = Axis.other(@mainAxis)

		extend_to = (size, array, generator) ->
			while array.length < size
				array.push(generator())

		zip = (a,b) ->
			return ([a[i], b[i]] for i in [0 ... Math.min(a.length, b.length)])

		extend_to(windows.length, splits, -> new Split(axis))
		log("laying out side with rect #{j rect}, windows #{windows.length} and splits #{splits.length}")

		previous_split = null
		for [window, split] in zip(windows, splits)
			window.top_split = previous_split
			[rect, windows] = split.layout_one(rect, windows)
			window.ensure_within(@bounds)
			window.bottom_split = if (windows.length > 0) then split else null
			previous_split = split

	add_main_window_count: (i) ->
		@mainSplit.primaryWindows += i
		@layout()
	
	tile: (win) ->
		tiled = false
		@tile_for win, (tile) =>
			tiled = true
			log("TILING")
			tile.tile()
			@layout()
		log("NO TILE for #{win} in #{@tiles.items}") unless tiled

	select_cycle: (offset) ->
		@tiles.select_cycle(offset)
		@layout()
	
	add: (win) ->
		return if @contains(win)
		tile = new TiledWindow(win, this)
		@tiles.push(tile)
	
	active_tile: (fn) ->
		@tiles.active(fn)

	cycle: (diff) ->
		@tiles.cycle(diff)
		@layout()
	
	adjust_main_window_area: (diff) ->
		@mainSplit.adjust_ratio(diff)
		@layout()
	
	adjust_current_window_size: (diff) ->
		@active_tile (tile) =>
			@adjust_split_for_tile({
				tile: tile,
				diff_ratio: diff,
				axis: Axis.other(@mainAxis)})
			@layout()
	
	scale_current_window: (amount, axis) ->
		@active_tile (tile) =>
			tile.scale_by(amount, axis)
			tile.center_window()
			tile.ensure_within(@bounds)
			tile.layout()
	
	adjust_split_for_tile: (opts) ->
		{axis, diff_px, diff_ratio, tile} = opts
		adjust = (split, inverted) ->
			if diff_px?
				split.adjust_ratio_px(if inverted then -diff_px else diff_px)
			else
				split.adjust_ratio(if inverted then -diff_ratio else diff_ratio)
			
		if axis == @mainAxis
			adjust(@mainSplit, !@mainSplit.in_primary_partition(@tiles.indexOf(tile)))
		else
			if tile.bottom_split?
				adjust(tile.bottom_split, false)
			else if tile.top_split?
				adjust(tile.top_split, true)
		
	main_window: () ->
		@tiles.main()
	
	swap_active_with_main: () ->
		@tiles.active (tile, idx) =>
			@tiles.main (main_tile, main_idx) =>
				@tiles.swap_at(idx, main_idx)
				@layout()
	
	untile: (win) ->
		@tile_for win, (tile) =>
			tile.release()
			@layout()

	on_window_killed: (win) ->
		@tile_for win, (tile, idx) =>
			@tiles.remove_at(idx)
			@layout()

	on_window_moved: (win) ->
		@tile_for win, (tile, idx) =>
			@swap_moved_tile_if_necessary(tile, idx)
			tile.update_offset()
			@layout()

	on_split_resize_start: (win) ->
		@split_resize_start_rect = Tile.copyRect(@tiles[@indexOf(win)].window_rect())
		log("starting resize of split.. #{j @split_resize_start_rect}")

	on_window_resized: (win) ->
		@tile_for win, (tile, idx) =>
			if @split_resize_start_rect?
				diff = Tile.pointDiff(@split_resize_start_rect.size, tile.window_rect().size)
				log("split resized! diff = #{j diff}")
				if diff.x != 0
					@adjust_split_for_tile({tile: tile, diff_px: diff.x, axis: 'x'})
				if diff.y != 0
					@adjust_split_for_tile({tile: tile, diff_px: diff.y, axis: 'y'})
				@split_resize_start_rect = null
			else
				tile.update_offset()
			@layout()
			true
	
	toggle_maximize: ->
		active = null
		@active_tile (tile, idx) =>
			active = tile
		return if active == null
		@each (tile) =>
			if tile == active
				log("maximizing #{tile}")
				tile.toggle_maximize()
			else
				log("un-maximizing #{tile}")
				tile.unmaximize()
	
	swap_moved_tile_if_necessary: (tile, idx) ->
		#TODO: should this be based on cursor position, not window midpoint?
		center = Tile.rectCenter(tile.window_rect())
		@each_tiled (swap_candidate, swap_idx) =>
			log("(midpoint #{j center}) within #{j swap_candidate.rect}?")
			return if swap_idx == idx
			if Tile.pointIsWithin(center, swap_candidate.rect)
				log("YES - swapping idx #{idx} and #{swap_idx}")
				@tiles.swap_at(idx, swap_idx)
				return STOP
	
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
	constructor: (win, layout) ->
		@window = win
		@original_rect = @window_rect()
		@rect = {pos:{x:0, y:0}, size:{x:0, y:0}}
		@reset_offset()
		@maximized = false
		@managed = false
		@_layout = layout

	tile: (layout) ->
		if @managed
			log("resetting offset for window #{this}")
			@reset_offset()
		else
			this.managed = true
			@original_rect = @window_rect()
		@reset_offset()
	
	reset_offset: ->
		@offset = {pos: {x:0, y:0}, size: {x:0, y:0}}
	
	toString: ->
		"<\#TiledWindow of " + @window.toString() + ">"
	
	beforeRedraw: (f) ->
		@window.beforeRedraw(f)
	
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

	toggle_maximize: () ->
		if @maximized
			@unmaximize()
		else
			@maximize()
	
	is_minimized: () ->
		@window.isMinimized()

	maximize: () ->
		@maximized = true
		@activate()
		@layout()
	
	unmaximize: ->
		@maximized = false
		@layout()

	_resize: (size) ->
		log("resize rect = #{j @rect} for size #{j size}")
		@rect.size = {x:size.x, y:size.y}
		log("resize rect = #{j @rect}")

	_move: (pos) ->
		@rect.pos = {x:pos.x, y:pos.y}
		log("move rect = #{j @rect}")

	set_rect : (r) ->
		log("Setting rect to " + j(r))
		# log("offset rect to " + j(@offset))
		@_resize(r.size)
		@_move(r.pos)
		@layout()
	
	ensure_within: (screen_rect) ->
		log("@rect=#{j @rect}, @offset=#{j @offset}")
		combined_rect = Tile.addDiffToRect(@rect, @offset)
		change_required = Tile.moveRectWithin(combined_rect, screen_rect)
		unless Tile.zeroRect(change_required)
			log("old offset = #{j @offset}")
			log("moving tile #{j change_required} to keep it onscreen")
			@offset = Tile.addDiffToRect(@offset, change_required)
			log("now offset = #{j @offset}")
			@layout()
	
	center_window: ->
		window_rect = @window_rect()
		tile_center = Tile.rectCenter(@rect)
		window_center = Tile.rectCenter(window_rect)
		movement_required = Tile.pointDiff(window_center, tile_center)
		@offset.pos = Tile.pointAdd(@offset.pos, movement_required)
	
	layout: ->
		rect = @maximized_rect() or Tile.addDiffToRect(@rect, @offset)
		{pos:pos, size:size} = Tile.ensureRectExists(rect)
		log("laying out window @ " + j(pos) + " with size " + j(size))
		this.window.move_resize(pos.x, pos.y, size.x, size.y)
	
	maximized_rect: ->
		return null unless @maximized
		bounds = @_layout.bounds
		border = 20
		return {
			pos: {
				x: bounds.pos.x + border,
				y: bounds.pos.y + border
			},
			size: {
				x: bounds.size.x - border * 2,
				y: bounds.size.y - border * 2
			}
		}
	
	scale_by: (amount, axis) ->
		window_rect = @window_rect()
		log("scaling window @ " + j(window_rect) + " by " + amount)
		if axis?
			@_scale_by(amount, axis, window_rect)
		else
			# scale in both directions
			@_scale_by(amount, 'x', window_rect)
			@_scale_by(amount, 'y', window_rect)

	_scale_by: (amount, axis, window_rect) ->
		current_dim = window_rect.size[axis]
		diff_px = (amount * current_dim)
		new_dim = current_dim + diff_px
		@offset.size[axis] += diff_px
		@offset.pos[axis] -= (diff_px / 2)
		log("diff_px on axis " + axis + " = " + diff_px)

	release: ->
		this.set_rect(this.original_rect)
		this.managed = false
	
	activate: ->
		@window.activate()
		@window.bringToFront()
	
	is_active: ->
		@window.is_active()


# hacky stuff for running in both the browser & gjs
unless log?
	if reqire?
		`log = require('util').log`
	else
		if console?
			`log = function(s) { console.log(s); }`
		else
			`log = function(s) { }`

export_to = (dest) ->
	dest.HorizontalTiledLayout = HorizontalTiledLayout
	dest.TileCollection = TileCollection
	dest.Axis = Axis
	dest.Tile = Tile
	dest.Split = Split
	dest.MultiSplit = MultiSplit
	dest.TiledWindow = TiledWindow
	dest.ArrayUtil = ArrayUtil

if exports?
	log("EXPORTS")
	export_to(exports)
