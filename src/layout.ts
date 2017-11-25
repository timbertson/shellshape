/// <reference path="common.ts" />
/// <reference path="logging.ts" />
/// <reference path="tiling.ts" />

module Layout {
	// bind useful utils from tiling
	var j = Tiling.j;
	var STOP = Tiling.STOP;
	var contains = function(arr, item) {
		return arr.indexOf(item) !== -1;
	};

	export class LayoutState {
		// shared state for every layout type. Includes distinct @splits
		// objects for both directions
		tiles: Tiling.TileCollection
		splits: Tiling.SplitStates
		bounds: Tiling.Bounds
		static padding = 0;

		constructor(bounds:Tiling.Bounds, tiles?:Tiling.TileCollection) {
			this.bounds = assert(bounds);
			this.tiles = tiles || new Tiling.TileCollection();
			this.splits = {
				'x': {
					main: new Tiling.MultiSplit('x', 1),
					minor: {
						left: [],
						right: []
					}
				},
				'y': {
					main: new Tiling.MultiSplit('y', 1),
					minor: {
						left: [],
						right: []
					}
				}
			};
		}
	
		empty_copy() {
			return new LayoutState(this.bounds);
		}
	}

	export abstract class BaseLayout {
		state: LayoutState
		bounds: Tiling.Bounds
		tiles: Tiling.TileCollection
		log: Logger
	
		constructor(name, state:LayoutState) {
			this.log = Logging.getLogger("shellshape.tiling." + name);
			this.state = assert(state);
			this.bounds = state.bounds;
			this.tiles = new Tiling.TileCollection();
		}
	
		toString() {
			return "[object BaseLayout]";
		}

		layout(accommodate_window?: Tiling.BaseTiledWindow):void {
			throw new Error("To be overridden");
		}
	
		each(func:IterFunc<Tiling.BaseTiledWindow>) {
			return this.tiles.each(func);
		}

		each_tiled(func:IterFunc<Tiling.BaseTiledWindow>) {
			return this.tiles.each_tiled(func);
		}
	
		contains(win:Tiling.HasId) {
			return this.tiles.contains(win);
		}
	
		tile_for(win:Tiling.Window, func:IterFunc<Tiling.BaseTiledWindow>):boolean {
			var self = this;
			if (!win) {
				self.log.warn("Layout.tile_for(null)");
				return false;
			}
			return this.tiles.each(function(tile:Tiling.BaseTiledWindow, idx) {
				if (tile.window === win) {
					func(tile, idx);
					return STOP;
				}
				// self.log.warn("Layout.tile_for called on missing window: " + win);
				return null;
			});
		}
	
		managed_tile_for(win:Tiling.Window, func:IterFunc<Tiling.BaseTiledWindow>) {
			// like @tile_for, but ignore floating windows
			var self = this;
			return this.tile_for(win, function(tile, idx) {
				if (self.tiles.is_tiled(tile)) {
					func(tile, idx);
				}
			});
		}
	
		tile(win:Tiling.Window) {
			var self = this;
			this.tile_for(win, function(tile) {
				tile.tile();
				self.layout();
			});
		}
	
		select_cycle(offset):boolean {
			return this.tiles.select_cycle(offset);
		}

		protected abstract create_tile(win: Tiling.Window, state: LayoutState): Tiling.BaseTiledWindow;
	
		add(win:Tiling.Window, active_win:Tiling.Window) {
			var self = this;
			var found, tile;
			if (this.contains(win)) {
				return false;
			}
			tile = this.create_tile(win, this.state);
			found = this.tile_for(active_win, function(active_tile, active_idx) {
				self.tiles.insert_at(active_idx + 1, tile);
				self.log.debug("spliced " + tile + " into tiles at idx " + (active_idx + 1));
			});
			if (!found) {
				// no active tile, just add the new window at the end
				this.tiles.push(tile);
			}
			return true;
		}

		restore_original_positions() {
			// Sets all window positions back to original states.
			// NOTE: does _not_ actually release tiles, because
			// we may want to resume this state when the extension
			// gets re-enabled
			this.each_tiled(function(tile) {
				tile.restore_original_position();
			});
		}
	
		active_tile(fn:IterFunc<Tiling.BaseTiledWindow>) {
			return this.tiles.active(fn);
		}
	
		cycle(diff) {
			this.tiles.cycle(diff);
			return this.layout();
		}
	
		minimize_window() {
			return this.active_tile(function(tile, idx) {
				return tile.minimize();
			});
		}
	
		unminimize_last_window() {
			return this.tiles.most_recently_minimized(function(win) {
				// TODO: this is a little odd...
				//       we do a relayout() as a result of the unminimize, and this
				//       is the only way to make sure we don't activate the previously
				//       active window.
				return Tiling.BaseTiledWindow.with_active_window(win, function() { win.unminimize();});
			});
		}
	
		untile(win:Tiling.Window) {
			var self = this;
			this.tile_for(win, function(tile) {
				tile.release();
				self.layout();
			});
		}
	
		on_window_killed(win:Tiling.Window):boolean {
			var self = this;
			return this.tile_for(win, function(tile, idx) {
				self.tiles.remove_at(idx);
				self.layout();
			});
		}
	
		toggle_maximize() {
			var self = this;
			var active = null;
			this.active_tile(function(tile, idx) {
				active = tile;
			});
			if (active === null) {
				this.log.debug("active == null");
			}
			if (active === null) {
				return;
			}
			this.each(function(tile) {
				if (tile === active) {
					self.log.debug("toggling maximize for " + tile);
					tile.toggle_maximize();
				} else {
					tile.unmaximize();
				}
			});
		}
	
		on_window_moved(win:Tiling.Window) {
			return this.on_window_resized(win);
		}
	
		on_window_resized(win:Tiling.Window) {
			var self = this;
			var found = this.tile_for(win, function(tile, idx) {
				tile.update_original_rect();
				self.layout();
			});
			if (!found) {
				this.log.warn("couldn't find tile for window: " + win);
			}
		}

		override_external_change(win:Tiling.Window, delayed:boolean) { }
	
		// all the actions that are specific to an actual tiling layout are NOOP'd here,
		// so the keyboard handlers don't have to worry whether it's a valid thing to call
		
		on_split_resize_start(win:Tiling.Window) { }
	
		adjust_splits_to_fit(win:Tiling.Window) { }
	
		add_main_window_count(i) { }
	
		adjust_main_window_area(diff) { }
	
		adjust_current_window_size(diff) { }
	
		scale_current_window(amount:number, axis?:string) {
			var bounds = this.bounds;
			this.active_tile(function(tile) {
				tile.update_desired_rect();
				tile.scale_by(amount, axis);
				tile.ensure_within(bounds);
				tile.layout();
			});
		}

		adjust_split_for_tile(opts:{tile: Tiling.BaseTiledWindow; diff_ratio: number; axis: string }) { }
	
		activate_main_window() { }
	
		swap_active_with_main() { }
	}

	class NonTiledLayout extends BaseLayout {
		protected create_tile(win: Tiling.Window, state: LayoutState) {
			return new Tiling.FloatingWindowTile(win, state);
		}
	}

	export class FloatingLayout extends NonTiledLayout {
		constructor(state) {
			super('FloatingLayout', state)
		}
	
		toString() {
			return "[object FloatingLayout]";
		}
	
		layout(accommodate_window):void {
			var self = this;
			this.state.tiles.each(function(tile) {
				self.log.debug("resetting window state...");
				tile.restore_original_position();
				return tile.layout();
			});
			// now don't bother laying out anything again!
			this.layout = function(accommodate_window) { };
		}
	}
	
	export class FullScreenLayout extends NonTiledLayout {
		constructor(state) {
			super('FullScreenLayout', state);
		}
	
		toString() {
			return "[object FullScreenLayout]";
		}
	
		layout(accommodate_window) {
			this.each_tiled(function(tile) {
				tile.window.maximize();
			});
		}
	}
	
	export abstract class BaseTiledLayout extends BaseLayout {
		main_split: Tiling.MultiSplit
		splits: Tiling.MinorSplitState
		main_axis: string

		constructor(name, axis, state:LayoutState) {
			super(name, state);
			this.main_axis = axis;
			this.main_split = state.splits[this.main_axis].main;
			this.splits = state.splits[this.main_axis].minor;
			this.tiles = state.tiles;
		}

		protected create_tile(win: Tiling.Window, state: LayoutState) {
			return new Tiling.TiledWindow(win, state);
		}
	
		toString() {
			return "[object BaseTiledLayout]";
		}
	
		layout(accommodate_window?:Tiling.BaseTiledWindow) {
			this.bounds.update();
			var padding = LayoutState.padding;
			var layout_windows = this.tiles.for_layout();
			this.log.debug("laying out " + layout_windows.length + " windows");
			if (accommodate_window != null) {
				this._change_main_ratio_to_accommodate(accommodate_window, this.main_split);
			}

			var _ref = this.main_split.split(this.bounds, layout_windows, padding);
			var left = _ref[0]
			var right = _ref[1];

			// @log.debug("split screen into rect #{j left[0]} | #{j right[0]}")
			this._layout_side.apply(this, left.concat( [this.splits.left,  accommodate_window, padding]));
			this._layout_side.apply(this, right.concat([this.splits.right, accommodate_window, padding]));
		}
	
		_layout_side(rect, windows, splits, accommodate_window, padding) {
			var accommodate_idx, axis, bottom_split, extend_to, other_axis, previous_split, split, top_splits, window, zip, _i, _len, _ref, _ref1, _ref2, _results;
			axis = Tiling.Axis.other(this.main_axis);
			extend_to = function(size, array, generator) {
				var _results;
				_results = [];
				while (array.length < size) {
					_results.push(array.push(generator()));
				}
				return _results;
			};
			zip = function(a, b) {
				var i;
				return (function() {
					var _i, _ref, _results;
					_results = [];
					for (i = _i = 0, _ref = Math.min(a.length, b.length); 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
						_results.push([a[i], b[i]]);
					}
					return _results;
				})();
			};
			extend_to(windows.length, splits, function() {
				return new Tiling.Split(axis);
			});
			// @log.debug("laying out side with rect #{j rect}, windows #{windows.length} and splits #{splits.length}")

			if (accommodate_window != null) {
				accommodate_idx = windows.indexOf(accommodate_window);
				if (accommodate_idx !== -1) {
					top_splits = splits.slice(0, accommodate_idx);
					bottom_split = splits[accommodate_idx];
					if (accommodate_idx === windows.length - 1) {
						bottom_split = void 0;
					}
					other_axis = Tiling.Axis.other(this.main_axis);
					this._change_minor_ratios_to_accommodate(accommodate_window, top_splits, bottom_split);
				}
			}
			previous_split = null;
			_ref = zip(windows, splits);
			_results = [];
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				_ref1 = _ref[_i], window = _ref1[0], split = _ref1[1];
				window.top_split = previous_split;
				_ref2 = split.layout_one(rect, windows, padding), rect = _ref2[0], windows = _ref2[1];
				window.ensure_within(this.bounds);
				window.bottom_split = windows.length > 0 ? split : null;
				_results.push(previous_split = split);
			}
			return _results;
		}
	
		add_main_window_count(i: number) {
			var updated = this.main_split.primary_windows + i;
			updated = Math.max(0, updated);
			updated = Math.min(updated, this.tiles.num_tiled());
			this.main_split.primary_windows = updated;
			return this.layout();
		}
	
		adjust_main_window_area(diff) {
			this.main_split.adjust_ratio(diff);
			return this.layout();
		}
	
		adjust_current_window_size(diff) {
			var self = this;
			return this.active_tile(function(tile) {
				self.adjust_split_for_tile({
					tile: tile,
					diff_ratio: diff,
					axis: Tiling.Axis.other(self.main_axis)
				});
				self.layout();
			});
		}
	
		adjust_split_for_tile(opts) {
			var adjust, axis, diff_px, diff_ratio, tile;
			axis = opts.axis, diff_px = opts.diff_px, diff_ratio = opts.diff_ratio, tile = opts.tile;
			adjust = function(split, inverted) {
				if (diff_px != null) {
					split.adjust_ratio_px(inverted ? -diff_px : diff_px);
				} else {
					split.adjust_ratio(inverted ? -diff_ratio : diff_ratio);
				}
			};
			if (axis === this.main_axis) {
				adjust(this.main_split, !this.main_split.in_primary_partition(this.tiles.indexOf(tile)));
			} else {
				if (tile.bottom_split != null) {
					adjust(tile.bottom_split, false);
				} else if (tile.top_split != null) {
					adjust(tile.top_split, true);
				}
			}
		}
	
		activate_main_window() {
			this.tiles.main((win) => {
				win.activate();
			});
		}
	
		swap_active_with_main() {
			this.tiles.active((tile, idx) => {
				this.tiles.main((main_tile, main_idx) => {
					this.tiles.swap_at(idx, main_idx);
					this.layout();
				});
			});
		}
	
		on_window_moved(win:Tiling.Window) {
			var self = this;
			this.tile_for(win, function(tile, idx) {
				var moved;
				moved = false;
				if (tile.managed) {
					moved = self._swap_moved_tile_if_necessary(tile, idx);
				}
				if (!moved) {
					tile.update_desired_rect();
				}
				self.layout();
			});
		}
	
		on_window_resized(win) {
			var self = this;
			this.managed_tile_for(win, function(tile, idx) {
				var diff;
				tile.update_desired_rect();
				self.layout();
				return true;
			});
		}

		override_external_change(win:Tiling.Window, delayed:boolean) {
			// The window has resized itself. Put it back!
			var found = this.tile_for(win, function(tile, idx) {
				(tile as Tiling.TiledWindow).enforce_layout(delayed);
			});
			if(!found) {
				this.log.warn("override_external_change called for unknown window " + win);
			}
		}
	
		adjust_splits_to_fit(win) {
			var self = this;
			this.managed_tile_for(win, function(tile, idx) {
				if (!self.tiles.is_tiled(tile)) return;
				self.layout(tile);
			});
		}
	
		private _change_main_ratio_to_accommodate(tile, split) {
			var left, right, _ref;
			_ref = split.partition_windows(this.tiles.for_layout()), left = _ref[0], right = _ref[1];
			if (contains(left, tile)) {
				this.log.debug("LHS adjustment for size: " + (j(tile.offset.size)) + " and pos " + (j(tile.offset.pos)));
				split.adjust_ratio_px(tile.offset.size[this.main_axis] + tile.offset.pos[this.main_axis]);
				tile.offset.size[this.main_axis] = -tile.offset.pos[this.main_axis];
			} else if (contains(right, tile)) {
				this.log.debug("RHS adjustment for size: " + (j(tile.offset.size)) + " and pos " + (j(tile.offset.pos)));
				split.adjust_ratio_px(tile.offset.pos[this.main_axis]);
				tile.offset.size[this.main_axis] += tile.offset.pos[this.main_axis];
				tile.offset.pos[this.main_axis] = 0;
			}
			this.log.debug("After main_split accommodation, tile offset = " + (j(tile.offset)));
		}
	
		_change_minor_ratios_to_accommodate(tile, above_splits, below_split) {
			var axis, bottom_offset, diff_px, diff_pxes, i, offset, proportion, size_taken, split, split_size, split_sizes, top_offset, total_size_above, _i, _j, _k, _len, _ref, _ref1;
			offset = tile.offset;
			axis = Tiling.Axis.other(this.main_axis);
			top_offset = offset.pos[axis];
			bottom_offset = offset.size[axis];
			if (above_splits.length > 0) {
				// TODO: this algorithm seems needlessly involved. Figure out if there's a cleaner
				//       way of doing it
				this.log.debug("ABOVE adjustment for offset: " + (j(offset)) + ", " + top_offset + " diff required across " + above_splits.length);
				diff_pxes = [];
				split_sizes = [];
				total_size_above = 0;
				for (_i = 0, _len = above_splits.length; _i < _len; _i++) {
					split = above_splits[_i];
					split_size = split.last_size * split.ratio;
					split_sizes.push(split_size);
					total_size_above += split_size;
				}
				for (i = _j = 0, _ref = above_splits.length; 0 <= _ref ? _j < _ref : _j > _ref; i = 0 <= _ref ? ++_j : --_j) {
					proportion = split_sizes[i] / total_size_above;
					diff_pxes.push(proportion * top_offset);
				}
				this.log.debug("diff pxes for above splits are: " + (j(diff_pxes)));
				size_taken = 0;
				for (i = _k = 0, _ref1 = above_splits.length; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
					split = above_splits[i];
					diff_px = diff_pxes[i];
					split.maintain_split_position_with_rect_difference(-size_taken);
					size_taken += diff_px;
					split.adjust_ratio_px(diff_px);
				}
				tile.offset.pos[axis] = 0;
				if (below_split != null) {
					this.log.debug("MODIFYING bottom to accomodate top_px changes == " + top_offset);
					// TODO: seems a pretty hacky place to do it..
					below_split.maintain_split_position_with_rect_difference(-top_offset);
				} else {
					tile.offset.size[axis] += top_offset;
				}
			} else {
				bottom_offset += top_offset;
			}
			if (below_split != null) {
				this.log.debug("BELOW adjustment for offset: " + (j(offset)) + ", bottom_offset = " + bottom_offset);
				this.log.debug("before bottom minor adjustments, offset = " + (j(tile.offset)));
				below_split.adjust_ratio_px(bottom_offset);
				tile.offset.size[axis] -= bottom_offset;
			}
			this.log.debug("After minor adjustments, offset = " + (j(tile.offset)));
		}
	
		_swap_moved_tile_if_necessary(tile, idx) {
			var self = this;
			var moved = false;
			if (this.tiles.is_tiled(tile)) {
				var mouse_pos = Tiling.get_mouse_position();
				this.each_tiled(function(swap_candidate, swap_idx) {
					var target_rect: Tiling.Rect;
					target_rect = Tiling.Tile.shrink(swap_candidate.rect, 20);
					if (swap_idx === idx) {
						return null;
					}
					if (Tiling.Tile.point_is_within(mouse_pos, target_rect)) {
						self.log.debug("swapping idx " + idx + " and " + swap_idx);
						self.tiles.swap_at(idx, swap_idx);
						moved = true;
						return STOP;
					}
					return null;
				});
			}
			return moved;
		}
	
		// private _log_state(lbl) {
		// 	var dump_win;
		// 	dump_win = function(w) {
		// 		return this.log.debug("	 - " + j(w.rect));
		// 	};
		// 	this.log.debug(" -------------- layout ------------- ");
		// 	this.log.debug(" // " + lbl);
		// 	this.log.debug(" - total windows: " + this.tiles.length);
		// 	this.log.debug("");
		// 	this.log.debug(" - main windows: " + this.mainsplit.primary_windows);
		// 	this.main_windows().map(dump_win);
		// 	this.log.debug("");
		// 	this.log.debug(" - minor windows: " + this.tiles.length - this.mainsplit.primary_windows);
		// 	this.minor_windows().map(dump_win);
		// 	return this.log.debug(" ----------------------------------- ");
		// }
	}
	
	export class VerticalTiledLayout extends BaseTiledLayout {
		constructor(state) {
			super('VerticalTiledLayout', 'x', state);
		}
	
		toString() {
			return "[object VerticalTiledLayout]";
		}
	}

	export class HorizontalTiledLayout extends BaseTiledLayout {
		constructor(state) {
			super('HorizontalTiledLayout', 'y', state);
		}
	
		toString() {
			return "[object HorizontalTiledLayout]";
		}
	}
	
}
