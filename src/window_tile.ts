/// <reference path="common.ts" />
/// <reference path="logging.ts" />
/// <reference path="layout.ts" />
/// <reference path="tiling.ts" />

module WindowTile {
	// bind useful utils from tiling
	var j = Tiling.j;
	var Tile = Tiling.Tile;

	export abstract class BaseTiledWindow {
		log: Logger
		window: Tiling.Window
		bounds: any
		maximized = false
		private _was_minimized = false
		minimized_order = 0
		rect: Tiling.Rect
		original_rect: Tiling.Rect
		managed = false

		private static minimized_counter = 0;
		private static active_window_override = null;

		static with_active_window(win, f:VoidFunc) {
			var _old = BaseTiledWindow.active_window_override;
			BaseTiledWindow.active_window_override = win;
			try {
				f();
			} finally {
				BaseTiledWindow.active_window_override = _old;
			}
		}

		abstract desired_rect(): Tiling.Rect;
		abstract center_window(): void;
		protected abstract add_diff_to_desired_rect(diff: Tiling.Rect): void;
		abstract update_desired_rect();
		abstract release(): void;
		abstract tile(): void;
		abstract swapped_with(other: BaseTiledWindow): void;

		constructor(win:Tiling.Window, state:Layout.LayoutState) {
			this.log = Logging.getLogger("shellshape.tiling.BaseTiledWindow");
			this.window = win;
			this.bounds = state.bounds;
			this.maximized = false;
			this._was_minimized = false;
			this.minimized_order = 0;
			this.rect = Tile.zero_rect();
			this.update_original_rect();
		}

		id() {
			return this.window.id();
		}

		toggle_maximize() {
			if (this.maximized) {
				this.unmaximize();
			} else {
				this.maximize();
			}
		}

		is_minimized() {
			var min;
			min = this.window.is_minimized();
			if (min && !this._was_minimized) {
				// the window with the highest minimise order is the most-recently minimized
				this.minimized_order = BaseTiledWindow.minimized_counter++;
			}
			this._was_minimized = min;
			return min;
		}

		maximize() {
			if (!this.maximized) {
				this.maximized = true;
				this.update_desired_rect();
				this.layout();
			}
		}

		unmaximize() {
			if (this.maximized) {
				this.maximized = false;
				if (!this.managed) {
					this.log.debug("unmaximize caused layout()");
				}
				this.layout();
			}
		}

		unminimize() {
			this.window.unminimize();
		}

		minimize() {
			this.window.minimize();
		}

		protected _resize(size) {
			this.rect.size = {
				x: size.x,
				y: size.y
			};
		}

		protected _move(pos) {
			this.rect.pos = {
				x: pos.x,
				y: pos.y
			};
		}

		set_rect(r) {
			// log("offset rect to " + j(@offset))
			// @log.debug("tile has new rect: " + j(r))
			this._resize(r.size);
			this._move(r.pos);
			this.layout();
		}

		update_original_rect() {
			this.original_rect = this.window.rect();
			this.log.debug("window " + this + " remembering original rect of " + (JSON.stringify(this.original_rect)));
		}

		restore_original_position() {
			this.window.move_resize(this.original_rect);
		}

		ensure_within(screen_rect) {
			var change_required = Tile.move_rect_within(this.desired_rect(), screen_rect);
			if (!Tile.is_zero_rect(change_required)) {
				this.log.debug("moving tile " + (j(change_required)) + " to keep it onscreen");
				this.add_diff_to_desired_rect(change_required);
				this.layout();
			}
		}

		layout() {
			var is_active;
			if (BaseTiledWindow.active_window_override) {
				is_active = BaseTiledWindow.active_window_override === this;
			} else {
				is_active = this.is_active();
			}
			var active_rect = this.active_rect();
			// this.log.debug("Laying out " + this.window + " in rect " + j(active_rect));
			this.window.move_resize(active_rect);
			if (is_active) {
				this.window.activate_before_redraw("layout");
			}
		}

		protected active_rect():Tiling.Rect {
			// returns the currently active rect for the window, including
			//  - maximize state
			//  - non-zero rect
			//  - tile rect + user-controlled offset
			var rect = (this.maximized
				? Tile.shrink(this.bounds, 20)
				: this.desired_rect()
			);
			return Tile.ensure_rect_exists(rect)
		}

		scale_by(amount, axis) {
			var window_rect = this.window.rect();
			if (axis != null) {
				this._scale_by(amount, axis, window_rect);
			} else {
				// scale in both directions
				this._scale_by(amount, 'x', window_rect);
				this._scale_by(amount, 'y', window_rect);
			}
		}

		protected _scale_by(amount, axis, window_rect) {
			var current_dim = window_rect.size[axis];
			var diff_px = amount * current_dim;

			var update = Tile.zero_rect();
			update.pos[axis] = - (diff_px / 2);
			update.size[axis] = diff_px;
			this.log.debug("scale_by(" + amount + ", " + axis + ", " + window_rect + ") => " + update);
			this.add_diff_to_desired_rect(update);
		}

		activate() {
			this.window.activate();
		}

		is_active() {
			return this.window.is_active();
		}
	}
	
	export class FloatingWindowTile extends BaseTiledWindow {
		constructor(win:Tiling.Window, state:Layout.LayoutState) {
			super(win, state);
			this.managed = true;
			this.update_desired_rect();
		}

		toString() {
			return "<\#FloatingWindowTile of " + this.window.toString() + ">";
		}

		desired_rect() {
			return this.rect;
		}

		protected add_diff_to_desired_rect(diff: Tiling.Rect) {
			this.rect = Tile.add_diff_to_rect(this.rect, diff);
		}

		release() { }
		tile() { }
		center_window() { }
		swapped_with(other: BaseTiledWindow) {
			this.update_desired_rect();
			other.update_desired_rect();

			var my_rect = Tile.copy_rect(this.desired_rect());
			this.set_rect(other.desired_rect()); other.set_rect(my_rect);
		}

		update_desired_rect() {
			this.rect = this.window.rect();
		}
	}

	export class TiledWindow extends BaseTiledWindow {
		offset: Tiling.Rect
		enforce_layout: (delayed:boolean) => void
		private _recent_overrides;

		constructor(win:Tiling.Window, state:Layout.LayoutState) {
			super(win, state);
			this.managed = false;
			this.enforce_layout = this._enforce_layout;
			this._recent_overrides = []

			this.reset_offset();
		}

		toString() {
			return "<\#TiledWindow of " + this.window.toString() + ">";
		}

		release() {
			this.set_rect(this.original_rect);
			this.managed = false;
			this.window.set_tile_preference(false);
		}

		tile() {
			// we're being explicitly tiled; reactivate enforce_layout()
			this.enforce_layout = this._enforce_layout;

			if (this.managed) {
				this.log.debug("resetting offset for window " + this);
			} else {
				this.managed = true;
				this.window.set_tile_preference(true);
				this.update_original_rect();
			}
			this.reset_offset();
		}

		_enforce_layout(delayed: boolean) {
			// The window has unexpectedly moved since last layout().
			// Put it back in it's place, but if this has happened
			// more than a few times in the last 2s then stop (because
			// it's probably going to keep trying)
			var now = Date.now();
			var threshold = now - 2000;
			this._recent_overrides = this._recent_overrides.filter(function(t) {
				return t > threshold;
			});
			if(this._recent_overrides.length > 6) {
				this.log.warn("window " + this.window + " has seen too many enforce_layout() calls in the last 2s - ignoring");
				this.enforce_layout = noop;
				return;
			}
			if(!delayed) {
				this._recent_overrides.push(now);
			}
			if(Logging.PARANOID) {
				var expected = this.rect;
				var actual = this.window.rect();
				var position_diff = Tile.point_diff(expected.pos, actual.pos);
				var size_diff = Tile.point_diff(expected.size, actual.size);
				var max_diff = Math.max(
					position_diff.x,
					position_diff.y,
					size_diff.x,
					size_diff.y
				);
				// give some leeway for weird layout conditions
				this.log.debug("enforce_layout: max_diff is " + max_diff);
				if(max_diff > 50) {
					this.log.debug("enforcing layout after change on " + this.window);
					this.log.debug("expected size:" + j(expected) + ", actual size: " + j(actual));
				}
			}
			this.layout();
		}

		reset_offset():void {
			this.offset = Tile.zero_rect();
		}

		center_window() {
			var tile_center = Tile.rect_center(this.rect);
			var window_center = Tile.rect_center(this.window.rect());
			var movement_required = Tile.point_diff(window_center, tile_center);
			this.offset.pos = Tile.point_add(this.offset.pos, movement_required);
		}

		desired_rect():Tiling.Rect {
			return Tile.add_diff_to_rect(this.rect, this.offset);
		}

		protected add_diff_to_desired_rect(diff: Tiling.Rect) {
			this.offset = Tile.add_diff_to_rect(this.offset, diff);
		}

		update_desired_rect() {
			var rect, win;
			rect = this.rect;
			win = this.window.rect();
			this.offset = {
				pos: Tile.point_diff(rect.pos, win.pos),
				size: Tile.point_diff(rect.size, win.size)
			};
			this.log.debug("updated tile offset to " + (j(this.offset)));
		}

		swapped_with(other: BaseTiledWindow) { }
	}
}
