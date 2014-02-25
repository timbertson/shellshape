Axis = {
	other: (axis) -> return if axis == 'y' then 'x' else 'y'
}
j = (s) -> JSON.stringify(s)

HALF = 0.5
STOP = '_stop_iter'

ArrayUtil = {
	divide_after: (num, items) ->
		return [items[0 ... num], items[num ... ]]
	moveItem: (array, start, end) ->
		removed = array.splice(start, 1)[0]
		array.splice(end, 0, removed)
		return array
}

contains = (arr, item) ->
	arr.indexOf(item) != -1

get_mouse_position = ->
	throw "override get_mouse_position()"

Tile = {

	copy_rect: (rect) ->
		return {pos:{x:rect.pos.x, y:rect.pos.y}, size:{x:rect.size.x, y:rect.size.y}}

	split_rect: (rect, axis, ratio, padding) ->
		padding ||= 0
		# log("#split_rect: splitting rect of " + j(rect) + " along the " + axis + " axis with ratio " + ratio)
		if(ratio > 1 || ratio < 0)
			throw("invalid ratio: " + ratio + " (must be between 0 and 1)")
		new_size_a = Math.round(rect.size[axis] * ratio)
		new_size_b = rect.size[axis] - new_size_a

		padding = Math.round(Math.min((new_size_a / 2), (new_size_b / 2), padding))
		# log("effective padding is " + padding)

		new_rect = Tile.copy_rect(rect)
		rect = Tile.copy_rect(rect)
		rect.size[axis] = new_size_a - padding
		new_rect.size[axis] = new_size_b - padding
		new_rect.pos[axis] += new_size_a + padding
		# log("rect copy: " + j(rect))
		# log("new_rect: " + j(new_rect))
		return [rect, new_rect]

	add_diff_to_rect: (rect, diff) ->
		return {
			pos: Tile.point_add(rect.pos, diff.pos),
			size: Tile.point_add(rect.size, diff.size)
		}
	
	ensure_rect_exists: (rect) ->
		rect.size.x = Math.max(1, rect.size.x)
		rect.size.y = Math.max(1, rect.size.y)
		return rect

	zero_rect: (rect) ->
		return (
			rect.pos.x == 0 and rect.pos.y == 0 and
			rect.size.x == 0 and rect.size.y == 0
		)
	
	shrink: (rect, border_px) ->
		return {
			pos: {
				x: rect.pos.x + border_px,
				y: rect.pos.y + border_px
			},
			size: {
				x: Math.max(0, rect.size.x - (2*border_px)),
				y: Math.max(0, rect.size.y - (2*border_px))
			}
		}
	
	minmax: (a,b) -> [Math.min(a,b), Math.max(a,b)]
	midpoint: (a,b) ->
		[min, max] = @minmax(a,b)
		Math.round(min + ((max - min) / 2))
	
	within: (val, a, b) ->
		[min, max] = @minmax(a,b)
		# log("val #{val} within #{min},#{max}? #{val > min && val < max}")
		return (val > min && val < max)
	
	move_rect_within: (original_rect, bounds) ->
		# log("moving #{j original_rect} to be within #{j bounds}")
		min = Math.min
		max = Math.max

		rect = Tile.copy_rect(original_rect)

		rect.size.x = min(rect.size.x, bounds.size.x)
		rect.size.y = min(rect.size.y, bounds.size.y)

		rect.pos.x = max(rect.pos.x, bounds.pos.x)
		rect.pos.y = max(rect.pos.y, bounds.pos.y)

		extent = (rect, axis) -> rect.pos[axis] + rect.size[axis]
		rect.pos.x -= max(0, extent(rect, 'x') - extent(bounds, 'x'))
		rect.pos.y -= max(0, extent(rect, 'y') - extent(bounds, 'y'))

		return {
			pos: @point_diff(original_rect.pos, rect.pos),
			size: @point_diff(original_rect.size, rect.size)
		}

	point_diff: (a, b) ->
		{x: b.x - a.x, y: b.y - a.y}
	
	point_add: (a,b) ->
		{x: a.x + b.x, y: a.y + b.y}

	rect_center: (rect) ->
		{
			x: @midpoint(rect.pos.x, rect.pos.x + rect.size.x),
			y: @midpoint(rect.pos.y, rect.pos.y + rect.size.y)
		}
	
	point_is_within: (point, rect) ->
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
		@log = Log.getLogger("shellshape.tiling.TileCollection")
		@items = []
	
	is_visible: (item) => !item.is_minimized()
	is_minimized: (item) => item.is_minimized()
	is_visible_and_untiled: (item) => (!@is_tiled(item)) && @is_visible(item)
	is_tiled: (item) => item.managed && @is_visible(item)
	is_active: (item) => item.is_active()
	sort_order: (item) =>
		if @is_tiled(item)
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
		# @log.debug("\nSORTING: #{j items_and_indexes}")
		sorted = items_and_indexes.slice().sort (a,b) =>
			ordera = @sort_order(a.item)
			orderb = @sort_order(b.item)
			if ordera == orderb
				return a.index - b.index
			else
				# ensure a stable sort by using index position for equivalent windows
				return ordera - orderb
		# @log.debug("sorted: #{items_and_indexes}\n    to: #{sorted}")
		return sorted
	
	_wrap_index: (idx, length) ->
		while idx < 0
			idx += length
		while idx >= length
			idx -= length
		idx

	filter: (f, items) -> (item for item in items when f(item))

	select_cycle: (diff) ->
		cycled = @_with_active_and_neighbor_when_filtered @is_visible, diff, (active, neighbor) =>
			neighbor.item.activate()
		if not cycled
			# no active window - just select the first visible window if there is one
			filtered = @filter(@is_visible, @items)
			if filtered.length > 0
				filtered[0].activate()
	
	sorted_view: (filter) ->
		f = (obj) =>
			filter(obj.item)
		@filter(f, @sorted_with_indexes())
	
	_with_active_and_neighbor_when_filtered: (filter, diff, cb) ->
		filtered = @sorted_view(filter)
		filtered_active_idx = @_index_where filtered, (obj) =>
			@is_active(obj.item)
		return false if filtered_active_idx == null

		new_idx = @_wrap_index filtered_active_idx + diff, filtered.length
		cb(filtered[filtered_active_idx], filtered[new_idx])
		return true
	
	most_recently_minimized: (f) ->
		filtered = @filter(@is_minimized, @items)
		if filtered.length > 0
			sorted = filtered.sort (a,b) ->
				b.minimized_order - a.minimized_order
			f(sorted[0])

	cycle: (diff) ->
		# only one of these will have any effect, as the active tile is either tiled or untiled
		done = @_with_active_and_neighbor_when_filtered @is_tiled, diff, (active, neighbor) =>
			@swap_at(active.index, neighbor.index)
		done or @_with_active_and_neighbor_when_filtered @is_visible_and_untiled, diff, (active, neighbor) =>
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
		# @log.debug("swapping items at index #{idx1} and #{idx2}")
		_orig = @items[idx2]
		@items[idx2] = @items[idx1]
		@items[idx1] = _orig

	contains: (item) ->
		return @indexOf(item) != -1
	
	indexOf: (item) ->
		id = item.id()
		idx = -1
		@each (tile, _idx) =>
			if tile.id() == id
				@log.debug("found id #{id}")
				idx = _idx
				return STOP
		return idx

	push: (item) ->
		return if @contains(item)
		@items.push(item)
	
	each: (f) ->
		for i in [0 ... @items.length]
			ret = f(@items[i], i)
			return true if ret == STOP
		return false

	each_tiled: (f) -> @_filtered_each(@is_tiled, f)
	_filtered_each: (filter, f) ->
		return @each (tile, idx) =>
			f(tile, idx) if filter(tile)

	active: (f) ->
		return @each (item, idx) =>
			if @is_active(item)
				f(item, idx)
				return STOP

	for_layout: ->
		# @log.debug("tiles = #{@items}, filtered = #{@filter(@is_tiled, @items)}")
		@filter(@is_tiled, @items)

	remove_at: (idx) ->
		@items.splice(idx, 1)
	
	insert_at: (idx, item) ->
		@items.splice(idx, 0, item)
	
	main: (f) ->
		@each (tile, idx) =>
			if @is_tiled(tile)
				f(tile, idx)
				return STOP


class BaseSplit
	constructor: (@axis) ->
		@log = Log.getLogger("shellshape.tiling.BaseSplit")
		@ratio = HALF

	adjust_ratio: (diff) ->
		@ratio = Math.min(1, Math.max(0, @ratio + diff))

	save_last_rect: (rect) ->
		# @log.debug("last_size changed from #{@last_size} -> #{rect.size[@axis]}")
		@last_size = rect.size[@axis]
	
	maintain_split_position_with_rect_difference: (diff) ->
		unwanted_addition = @ratio * diff
		@last_size += diff
		@log.debug("adjusting by #{-unwanted_addition} to accommodate for rect size change from #{@last_size-diff} to #{@last_size}")
		@adjust_ratio_px(-unwanted_addition)

	adjust_ratio_px: (diff) ->
		@log.debug("adjusting ratio #{@ratio} by #{diff} px")
		return if diff == 0
		current_px = @ratio * @last_size
		@log.debug("current ratio makes for #{current_px} px (assuming last size of #{@last_size}")
		new_px = current_px + diff
		@log.debug("but we want #{new_px}")
		new_ratio = new_px / @last_size
		throw "failed ratio: #{new_ratio}" if not Tile.within(new_ratio, 0, 1)
		@log.debug("which makes a new ratio of #{new_ratio}")
		@ratio = new_ratio

class Split extends BaseSplit
	layout_one: (rect, windows, padding) ->
		@save_last_rect(rect)
		first_window = windows.shift()
		if windows.length == 0
			first_window.set_rect(rect)
			return [{}, []]
		[window_rect, remaining] = Tile.split_rect(rect, @axis, @ratio, padding)
		first_window.set_rect(window_rect)
		return [remaining, windows]
	
	toString: -> "Split with ratio #{@ratio}"

class LayoutState
	# shared state for every layout type. Includes distinct @splits
	# objects for both directions
	constructor: (bounds, tiles) ->
		@tiles = tiles || new TileCollection()
		@splits = {
			'x': {
				main: new MultiSplit('x', 1),
				minor: { left: [], right: []}
			},
			'y': {
				main: new MultiSplit('y', 1),
				minor: { left: [], right: []}
			}
		}
		@bounds = bounds
	
	empty_copy: () ->
		new LayoutState(@bounds)


class MultiSplit extends BaseSplit
	# a slpitter that contains multiple windows on either side,
	# which is split along @axis (where 'x' is a split
	# that contains windows to the left and right)
	constructor: (axis, @primary_windows) ->
		@log = Log.getLogger("shellshape.tiling.MultiSplit")
		super(axis)
	
	split: (bounds, windows, padding) ->
		@save_last_rect(bounds)
		# @log.debug("mainsplit: dividing #{windows.length} after #{@primary_windows} for bounds #{j bounds}")
		[left_windows, right_windows] = @partition_windows(windows)
		if left_windows.length > 0 and right_windows.length > 0
			[left_rect, right_rect] = Tile.split_rect(bounds, @axis, @ratio, padding)
		else
			# only one side wil actually be laid out...
			[left_rect, right_rect] = [bounds, bounds]
		return [[left_rect, left_windows], [right_rect, right_windows]]
	
	partition_windows: (windows) ->
		ArrayUtil.divide_after(@primary_windows, windows)

	in_primary_partition: (idx) ->
		# @log.debug("on left? #{idx}, #{@primary_windows} == #{idx < @primary_windows}")
		idx < @primary_windows

class BaseLayout
	padding: 0

	constructor: (state) ->
		@state = state
		@tiles = state.tiles
	
	toString: -> "[object BaseLayout]"
	
	each: (func) -> @tiles.each(func)
	contains: (win) -> @tiles.contains(win)

	tile_for: (win, func) ->
		return false unless win
		return @tiles.each (tile, idx) =>
			if tile.window == win
				func(tile, idx)
				return STOP
		return false

	managed_tile_for: (win, func) ->
		# like @tile_for, but ignore floating windows
		return @tile_for win, (tile, idx) =>
			if @tiles.is_tiled(tile)
				func(tile, idx)

	tile: (win) ->
		@tile_for win, (tile) =>
			tile.tile()
			@layout()

	select_cycle: (offset) -> @tiles.select_cycle(offset)

	add: (win, active_win) ->
		return false if @contains(win)
		tile = new TiledWindow(win, @state)
		found = @tile_for active_win, (active_tile, active_idx) =>
			@tiles.insert_at(active_idx+1, tile)
			@log.debug("spliced #{tile} into tiles at idx #{active_idx + 1}")
		if not found
			# no active tile, just add the new window at the end
			@tiles.push(tile)
		return true

	active_tile: (fn) -> return @tiles.active(fn)
	cycle: (diff) ->
		@tiles.cycle(diff)
		@layout()

	minimize_window: ->
		@active_tile (tile, idx) =>
			tile.minimize()

	unminimize_last_window: ->
		@tiles.most_recently_minimized (win) =>
			#TODO: this is a little odd...
			#      we do a relayout() as a result of the unminimize, and this
			#      is the only way to make sure we don't activate the previously
			#      active window.
			TiledWindow.with_active_window win, =>
				win.unminimize()

	untile: (win) ->
		@tile_for win, (tile) =>
			tile.release()
			@layout()

	on_window_killed: (win) ->
		@tile_for win, (tile, idx) =>
			@tiles.remove_at(idx)
			@layout()

	toggle_maximize: ->
		active = null
		@active_tile (tile, idx) =>
			active = tile
		@log.debug("active == null") if active == null
		return if active == null
		@each (tile) =>
			if tile == active
				@log.debug("toggling maximize for #{tile}")
				tile.toggle_maximize()
			else
				tile.unmaximize()

	on_window_moved: (win) -> @on_window_resized(win)
	on_window_resized: (win) ->
		found = @tile_for win, (tile, idx) =>
			tile.update_original_rect()
			@layout()
		if !found
			@log.warn("couldn't find tile for window: " + win)

	# all the actions that are specific to an actual tiling layout are NOOP'd here,
	# so the keyboard handlers don't have to worry whether it's a valid thing to call

	on_split_resize_start: (win) -> null
	adjust_splits_to_fit: (win) -> null

	add_main_window_count: (i) -> null

	adjust_main_window_area: (diff) -> null
	adjust_current_window_size: (diff) -> null
	scale_current_window: (amount, axis) -> null

	adjust_split_for_tile: (opts) -> null
	activate_main_window: () -> null
	swap_active_with_main: () -> null

class FloatingLayout extends BaseLayout
	constructor: (a...) ->
		@log = Log.getLogger("shellshape.tiling.FloatingLayout")
		super(a...)

	toString: -> "[object FloatingLayout]"

	layout: (accommodate_window) ->
		@each (tile) =>
			@log.debug("resetting window state...")
			tile.resume_original_state()
			tile.layout()
		# now don't bother laying out anything again!
		@layout = (accommodate_window) -> null

class FullScreenLayout extends BaseLayout
	constructor: (a...) ->
		@log = Log.getLogger("shellshape.tiling.FullScreenLayout")
		super(a...)

	toString: -> "[object FullScreenLayout]"

	layout: (accommodate_window) ->
		@each (tile) =>
			tile.window.maximize()
		@layout

class BaseTiledLayout extends BaseLayout
	constructor: (state) ->
		super(state)
		#TODO: remove need for these instance vars
		@bounds = state.bounds
		@main_split = state.splits[@main_axis].main
		@splits = state.splits[@main_axis].minor

	toString: -> "[object BaseTiledLayout]"

	_each_tiled: (func) ->
		@tiles.each_tiled(func)

	layout: (accommodate_window) ->
		@bounds.update()
		padding = @padding
		layout_windows = @tiles.for_layout()
		@log.debug("laying out #{layout_windows.length} windows")
		if accommodate_window?
			@_change_main_ratio_to_accommodate(accommodate_window, @main_split)
		[left, right] = @main_split.split(@bounds, layout_windows, padding)
		# @log.debug("split screen into rect #{j left[0]} | #{j right[0]}")
		@_layout_side(left..., @splits.left, accommodate_window, padding)
		@_layout_side(right..., @splits.right, accommodate_window, padding)
	
	_layout_side: (rect, windows, splits, accommodate_window, padding) ->
		axis = Axis.other(@main_axis)

		extend_to = (size, array, generator) ->
			while array.length < size
				array.push(generator())

		zip = (a,b) ->
			return ([a[i], b[i]] for i in [0 ... Math.min(a.length, b.length)])

		extend_to(windows.length, splits, -> new Split(axis))
		# @log.debug("laying out side with rect #{j rect}, windows #{windows.length} and splits #{splits.length}")

		if accommodate_window?
			accommodate_idx = windows.indexOf(accommodate_window)
			if accommodate_idx != -1
				top_splits = splits[0...accommodate_idx]
				bottom_split = splits[accommodate_idx]
				if accommodate_idx == windows.length - 1
					bottom_split = undefined
				other_axis = Axis.other(@main_axis)
				@_change_minor_ratios_to_accommodate(accommodate_window, top_splits, bottom_split)

		previous_split = null
		for [window, split] in zip(windows, splits)
			window.top_split = previous_split
			[rect, windows] = split.layout_one(rect, windows, padding)
			window.ensure_within(@bounds)
			window.bottom_split = if (windows.length > 0) then split else null
			previous_split = split

	add_main_window_count: (i) ->
		@main_split.primary_windows += i
		@layout()
	
	adjust_main_window_area: (diff) ->
		@main_split.adjust_ratio(diff)
		@layout()
	
	adjust_current_window_size: (diff) ->
		@active_tile (tile) =>
			@adjust_split_for_tile({
				tile: tile,
				diff_ratio: diff,
				axis: Axis.other(@main_axis)})
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
			
		if axis == @main_axis
			adjust(@main_split, !@main_split.in_primary_partition(@tiles.indexOf(tile)))
		else
			if tile.bottom_split?
				adjust(tile.bottom_split, false)
			else if tile.top_split?
				adjust(tile.top_split, true)
		
	activate_main_window: () ->
		@tiles.main (win) =>
			win.activate()
	
	swap_active_with_main: () ->
		@tiles.active (tile, idx) =>
			@tiles.main (main_tile, main_idx) =>
				@tiles.swap_at(idx, main_idx)
				@layout()
	
	on_window_moved: (win) ->
		@tile_for win, (tile, idx) =>
			moved = false
			if tile.managed
				moved = @_swap_moved_tile_if_necessary(tile, idx)
			tile.update_offset() unless moved
			@layout()

	on_split_resize_start: (win) ->
		#TODO: this is never called in mutter
		@split_resize_start_rect = Tile.copy_rect(@tiles[@indexOf(win)].window_rect())
		@log.debug("starting resize of split.. #{j @split_resize_start_rect}")

	on_window_resized: (win) ->
		@managed_tile_for win, (tile, idx) =>
			if @split_resize_start_rect?
				diff = Tile.point_diff(@split_resize_start_rect.size, tile.window_rect().size)
				@log.debug("split resized! diff = #{j diff}")
				if diff.x != 0
					@adjust_split_for_tile({tile: tile, diff_px: diff.x, axis: 'x'})
				if diff.y != 0
					@adjust_split_for_tile({tile: tile, diff_px: diff.y, axis: 'y'})
				@split_resize_start_rect = null
			else
				tile.update_offset()
			@layout()
			true
	
	adjust_splits_to_fit: (win) ->
		@managed_tile_for win, (tile, idx) =>
			return unless @tiles.is_tiled(tile)
			@layout(tile)

	_change_main_ratio_to_accommodate: (tile, split) ->
		[left, right] = split.partition_windows(@tiles.for_layout())
		if contains(left, tile)
			@log.debug("LHS adjustment for size: #{j tile.offset.size} and pos #{j tile.offset.pos}")
			split.adjust_ratio_px(tile.offset.size[@main_axis] + tile.offset.pos[@main_axis])
			tile.offset.size[@main_axis] = -tile.offset.pos[@main_axis]
		else if contains(right, tile)
			@log.debug("RHS adjustment for size: #{j tile.offset.size} and pos #{j tile.offset.pos}")
			split.adjust_ratio_px(tile.offset.pos[@main_axis])
			tile.offset.size[@main_axis] += tile.offset.pos[@main_axis]
			tile.offset.pos[@main_axis] = 0
		@log.debug("After main_split accommodation, tile offset = #{j tile.offset}")
		
	_change_minor_ratios_to_accommodate: (tile, above_splits, below_split) ->
		offset = tile.offset
		axis = Axis.other(@main_axis)
		top_offset = offset.pos[axis]
		bottom_offset = offset.size[axis]
		if above_splits.length > 0
			#TODO: this algorithm seems needlessly involved. Figure out if there's a cleaner
			#      way of doing it.
			@log.debug("ABOVE adjustment for offset: #{j offset}, #{top_offset} diff required across #{above_splits.length}")
			diff_pxes = []
			split_sizes = []
			total_size_above = 0
			for split in above_splits
				split_size = split.last_size * split.ratio
				split_sizes.push(split_size)
				total_size_above += split_size

			for i in [0...above_splits.length]
				proportion = split_sizes[i] / total_size_above
				diff_pxes.push(proportion * top_offset)

			@log.debug("diff pxes for above splits are: #{j diff_pxes}")
			size_taken = 0
			for i in [0...above_splits.length]
				split = above_splits[i]
				diff_px = diff_pxes[i]
				split.maintain_split_position_with_rect_difference(-size_taken)
				size_taken += diff_px
				split.adjust_ratio_px(diff_px)

			tile.offset.pos[axis] = 0
			if below_split?
				@log.debug("MODIFYING bottom to accomodate top_px changes == #{top_offset}")
				#TODO: seems a pretty hacky place to do it..
				below_split.maintain_split_position_with_rect_difference(-top_offset)
			else
				tile.offset.size[axis] += top_offset
		else
			bottom_offset += top_offset
		if below_split?
			@log.debug("BELOW adjustment for offset: #{j offset}, bottom_offset = #{bottom_offset}")
			@log.debug("before bottom minor adjustments, offset = #{j tile.offset}")
			below_split.adjust_ratio_px(bottom_offset)
			tile.offset.size[axis] -= bottom_offset
		@log.debug("After minor adjustments, offset = #{j tile.offset}")
	
	_swap_moved_tile_if_necessary: (tile, idx) ->
		return unless @tiles.is_tiled(tile)
		mouse_pos = get_mouse_position()
		moved = false
		@_each_tiled (swap_candidate, swap_idx) =>
			target_rect = Tile.shrink(swap_candidate.rect, 20)
			return if swap_idx == idx
			if Tile.point_is_within(mouse_pos, target_rect)
				@log.debug("swapping idx #{idx} and #{swap_idx}")
				@tiles.swap_at(idx, swap_idx)
				moved = true
				return STOP
		return moved
	
	_log_state: (lbl) ->
		dump_win = (w) ->
			@log.debug("   - " + j(w.rect))

		@log.debug(" -------------- layout ------------- ")
		@log.debug(" // " + lbl)
		@log.debug(" - total windows: " + this.tiles.length)
		@log.debug("")
		@log.debug(" - main windows: " + this.mainsplit.primary_windows)
		# @log.debug(j(this.tiles))
		this.main_windows().map(dump_win)
		@log.debug("")
		@log.debug(" - minor windows: " + @tiles.length - this.mainsplit.primary_windows)
		this.minor_windows().map(dump_win)
		@log.debug(" ----------------------------------- ")


class VerticalTiledLayout extends BaseTiledLayout
	constructor: (state) ->
		@log = Log.getLogger("shellshape.tiling.VerticalTiledLayout")
		@main_axis = 'x'
		super(state)

	toString: -> "[object VerticalTiledLayout]"

class HorizontalTiledLayout extends BaseTiledLayout
	constructor: (state) ->
		@log = Log.getLogger("shellshape.tiling.HorizontalTiledLayout")
		@main_axis = 'y'
		super(state)

	toString: -> "[object HorizontalTiledLayout]"

class TiledWindow
	minimized_counter = 0
	active_window_override = null
	@with_active_window: (win, f) ->
		_old = active_window_override
		active_window_override = win
		try
			f()
		finally
			active_window_override = _old

	constructor: (win, state) ->
		@log = Log.getLogger("shellshape.tiling.TiledWindow")
		@window = win
		@bounds = state.bounds
		@maximized = false
		@managed = false
		@_was_minimized = false
		@minimized_order = 0
		@rect = {pos:{x:0, y:0}, size:{x:0, y:0}}
		@update_original_rect()
	
	id: () -> @window.id()
	
	update_original_rect: () ->
		@original_rect = @window_rect()
		@log.debug("window #{@} remembering new rect of #{JSON.stringify(@original_rect)}")
	
	resume_original_state: () ->
		@reset_offset()
		@rect = Tile.copy_rect(@original_rect)
		@log.debug("window #{@} resuming old rect of #{JSON.stringify(@rect)}")

	tile: () ->
		if @managed
			@log.debug("resetting offset for window #{this}")
			@reset_offset()
		else
			this.managed = true
			this.window.set_tile_preference(true)
			@original_rect = @window_rect()
		@reset_offset()
	
	reset_offset: ->
		@offset = {pos: {x:0, y:0}, size: {x:0, y:0}}
	
	toString: ->
		"<\#TiledWindow of " + @window.toString() + ">"
	
	update_offset: ->
		rect = @rect
		win = @window_rect()
		@offset = {
			pos:  Tile.point_diff(rect.pos,  win.pos),
			size: Tile.point_diff(rect.size, win.size)
		}
		@log.debug("updated tile offset to #{j @offset}")
	
	window_rect: () ->
		{pos: {x:@window.xpos(), y:@window.ypos()}, size: {x:@window.width(), y:@window.height()}}

	toggle_maximize: () ->
		if @maximized
			@unmaximize()
		else
			@maximize()
	
	is_minimized: () ->
		min = @window.is_minimized()
		if min and not @_was_minimized
			# the window with the highest minimise order is the most-recently minimized
			@minimized_order = minimized_counter++
		@_was_minimized = min
		return min

	maximize: () ->
		unless @maximized
			@maximized = true
			@update_offset()
			@layout()
	
	unmaximize: ->
		if @maximized
			@maximized = false
			unless @managed
				@log.debug("unmaximize caused layout()")
			@layout()
	
	unminimize: () ->
		@window.unminimize()

	minimize: () ->
		@window.minimize()

	_resize: (size) ->
		@rect.size = {x:size.x, y:size.y}

	_move: (pos) ->
		@rect.pos = {x:pos.x, y:pos.y}

	set_rect : (r) ->
		# log("offset rect to " + j(@offset))
		# @log.debug("tile has new rect: " + j(r))
		@_resize(r.size)
		@_move(r.pos)
		@layout()
	
	ensure_within: (screen_rect) ->
		combined_rect = Tile.add_diff_to_rect(@rect, @offset)
		change_required = Tile.move_rect_within(combined_rect, screen_rect)
		unless Tile.zero_rect(change_required)
			log("moving tile #{j change_required} to keep it onscreen")
			@offset = Tile.add_diff_to_rect(@offset, change_required)
			@layout()
	
	center_window: ->
		window_rect = @window_rect()
		tile_center = Tile.rect_center(@rect)
		window_center = Tile.rect_center(window_rect)
		movement_required = Tile.point_diff(window_center, tile_center)
		@offset.pos = Tile.point_add(@offset.pos, movement_required)
	
	layout: () ->
		if active_window_override
			is_active = active_window_override == this
		else
			is_active = @is_active()
		rect = @maximized_rect() or Tile.add_diff_to_rect(@rect, @offset)
		{pos:pos, size:size} = Tile.ensure_rect_exists(rect)
		this.window.move_resize(pos.x, pos.y, size.x, size.y)
		if is_active
			@activate_before_redraw("@layout")

	maximized_rect: () ->
		return null unless @maximized
		bounds = @bounds
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

	release: ->
		this.set_rect(this.original_rect)
		this.managed = false
		this.window.set_tile_preference(false)
	
	activate: ->
		@window.activate()
		@window.bring_to_front()
	
	activate_before_redraw: (reason) ->
		@window.before_redraw =>
			# log("activating window " + this + " (" + reason + ")")
			@activate()
	
	is_active: ->
		@window.is_active()


#hacky stuff for running in the browser, node & gjs
unless log?
	if reqire?
		`log = require('util').log`
	else
		if console?
			`log = function(s) { console.log(s); }`
		else
			`log = function(s) { }`

unless Log?
	if require?
		`Log = {
			getLogger: function() { return Log; },
			error: function() { log.apply(null, arguments) },
			warn:  function() { log.apply(null, arguments) },
			info:  function() { log.apply(null, arguments) },
			debug: function() { log.apply(null, arguments) }
		}`
	else if imports?
		`var Extension = imports.misc.extensionUtils.getCurrentExtension()`
		`var Log = Extension.imports.log4javascript.log4javascript`
	else
		`Log = log4javascript`

export_to = (dest) ->
	dest.LayoutState = LayoutState
	dest.VerticalTiledLayout = VerticalTiledLayout
	dest.FloatingLayout = FloatingLayout
	dest.TileCollection = TileCollection
	dest.Axis = Axis
	dest.Tile = Tile
	dest.Split = Split
	dest.MultiSplit = MultiSplit
	dest.TiledWindow = TiledWindow
	dest.ArrayUtil = ArrayUtil
	dest.to_get_mouse_position = (f) ->
		get_mouse_position = f

if exports?
	log("EXPORTS")
	export_to(exports)
