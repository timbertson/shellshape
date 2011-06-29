const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Meta = imports.gi.Meta;

function Workspace() {
	this._init.apply(this, arguments)
}
Workspace.prototype = {
	_init : function(meta_workspace, layout, ext) {
		var self = this;
		this.auto_tile = false;
		this.meta_workspace = meta_workspace;
		this.layout = layout;
		this.extension = ext;
		this.meta_workspace.connect('window-added', Lang.bind(this, this.on_window_create));
		this.meta_workspace.connect('window-removed', Lang.bind(this, this.on_window_remove));
		this.meta_windows().map(Lang.bind(this, this.on_window_create));
	},

	tile_all : function(new_flag) {
		if(typeof(new_flag) === 'undefined') {
			new_flag = !this.auto_tile;
		}
		this.auto_tile = new_flag;
		this.meta_windows().map(Lang.bind(this, function(meta_window) {
			if(this.auto_tile) {
				this.layout.tile(this.extension.get_window(meta_window));
			} else {
				this.layout.untile(this.extension.get_window(meta_window));
			}
		}));
	},

	on_window_create: function(workspace, meta_window) {

		let actor = meta_window.get_compositor_private();
		if (!actor) {
			// Newly-created windows are added to a workspace before
			// the compositor finds out about them...
			Mainloop.idle_add(Lang.bind(this, function () {
				if (meta_window.get_compositor_private() && meta_window.get_workspace() == this.meta_workspace) {
					this.on_window_create(workspace, meta_window);
				}
				return false;
			}));
			return;
		}

		if (!this.is_normal_window(meta_window)) {
			return;
		}
		var win = this.extension.get_window(meta_window);
		log("on_window_create for " + win);
		this.layout.add(win);
		// terribly unobvious name for "this MetaWindow's associated MetaWindowActor"
		win.workspace_signals = [];

		let bind_to_window_change = Lang.bind(this, function(event_name, relevant_grabs, cb) {
			// we only care about events *after* at least one relevant grab_op,
			// this flag keeps track of that
			let change_pending = false;
			let signal_handler = Lang.bind(this, function() {
				let grab_op = global.screen.get_display().get_grab_op();
				if(relevant_grabs.indexOf(grab_op) != -1) {
					//wait for the operation to end...
					change_pending = true;
					Mainloop.idle_add(signal_handler);
				} else {
					let change_happened = change_pending;
					// it's critical that this flag be reset before cb() happens, otherwise the
					// callback will (frequently) trigger a stream of feedback events.
					change_pending = false;
					if(grab_op == Meta.GrabOp.NONE && change_happened) {
						log("change event [" + event_name + "] happened for window " + win);
						cb(win);
					}
				}
				return false;
			});
			win.workspace_signals.push([actor, actor.connect(event_name + '-changed', signal_handler)]);
		});


		let move_ops = [Meta.GrabOp.MOVING];
		let resize_ops = [
				Meta.GrabOp.RESIZING_SE,
				Meta.GrabOp.RESIZING_S,
				Meta.GrabOp.RESIZING_SW,
				Meta.GrabOp.RESIZING_N,
				Meta.GrabOp.RESIZING_NE,
				Meta.GrabOp.RESIZING_NW,
				Meta.GrabOp.RESIZING_W,
				Meta.GrabOp.RESIZING_E
		];
		bind_to_window_change('position', move_ops,     Lang.bind(this.layout, this.layout.on_window_moved));
		bind_to_window_change('size',     resize_ops,   Lang.bind(this.layout, this.layout.on_window_resized));
		win.workspace_signals.push([meta_window, meta_window.connect('notify::minimized', Lang.bind(this, this.on_window_minimize_changed))]);

		if(this.auto_tile) {
			// win.before_redraw(Lang.bind(this, function() { this.layout.tile(win); }));
			this.layout.tile(win);
		}
	},

	on_window_minimize_changed: function(workspace, meta_window) {
		log("window minimization state changed for window " + meta_window);
		this.layout.layout();
	},

	on_window_remove: function(workspace, meta_window) {
		if (this.is_normal_window(meta_window)) {
			let window = this.extension.get_window(meta_window);
			log("on_window_remove for " + window);
			if(window.workspace_signals !== undefined) {
				log("Disconnecting " + window.workspace_signals.length + " workspace-managed signals from window");
				window.workspace_signals.map(function(signal) {
					log("Signal is " + signal + ", disconnecting from " + meta_window);
					signal[0].disconnect(signal[1]);
				});
			}
			this.layout.on_window_killed(window);
			this.extension.remove_window(meta_window);
		}
	},

	is_normal_window: function(meta_window) {
		// TODO: add more smarts about floating / special windows (e.g. guake)
		try {
			return meta_window.get_window_type() == Meta.WindowType.NORMAL && (!meta_window.is_skip_taskbar());
		} catch (e) {
			log("Failed to get window type for window " + meta_window + ", error was: " + e);
			return false;
		}
	},

	meta_windows: function() {
		var wins = this.meta_workspace.list_windows();
		wins = wins.filter(Lang.bind(this, this.is_normal_window));
		return wins;
	}
}
