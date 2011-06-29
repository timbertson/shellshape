const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Meta = imports.gi.Meta;

function Workspace() {
	this._init.apply(this, arguments)
}
Workspace.prototype = {
	_init : function(metaWorkspace, layout, ext) {
		var self = this;
		this.autoTile = false;
		this.metaWorkspace = metaWorkspace;
		this.layout = layout;
		this.extension = ext;
		this.metaWorkspace.connect('window-added', Lang.bind(this, this.onWindowCreate));
		this.metaWorkspace.connect('window-removed', Lang.bind(this, this.onWindowRemove));
		this.metaWindows().map(Lang.bind(this, this.onWindowCreate));
	},

	tileAll : function(newFlag) {
		if(typeof(newFlag) === 'undefined') {
			newFlag = !this.autoTile;
		}
		this.autoTile = newFlag;
		this.metaWindows().map(Lang.bind(this, function(metaWindow) {
			if(this.autoTile) {
				this.layout.tile(this.extension.getWindow(metaWindow));
			} else {
				this.layout.untile(this.extension.getWindow(metaWindow));
			}
		}));
	},

	onWindowCreate: function(workspace, metaWindow) {

		let actor = metaWindow.get_compositor_private();
		if (!actor) {
			// Newly-created windows are added to a workspace before
			// the compositor finds out about them...
			Mainloop.idle_add(Lang.bind(this, function () {
				if (metaWindow.get_compositor_private() && metaWindow.get_workspace() == this.metaWorkspace) {
					this.onWindowCreate(workspace, metaWindow);
				}
				return false;
			}));
			return;
		}

		if (!this.isNormalWindow(metaWindow)) {
			return;
		}
		var win = this.extension.getWindow(metaWindow);
		log("onWindowCreate for " + win);
		this.layout.add(win);
		// terribly unobvious name for "this MetaWindow's associated MetaWindowActor"
		win.workspaceSignals = [];

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
			win.workspaceSignals.push([actor, actor.connect(event_name + '-changed', signal_handler)]);
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
		win.workspaceSignals.push([metaWindow, metaWindow.connect('notify::minimized', Lang.bind(this, this.onWindowMinimizeChanged))]);

		if(this.autoTile) {
			// win.beforeRedraw(Lang.bind(this, function() { this.layout.tile(win); }));
			this.layout.tile(win);
		}
	},

	onWindowMinimizeChanged: function(workspace, metaWindow) {
		log("window minimization state changed for window " + metaWindow);
		this.layout.layout();
	},

	onWindowRemove: function(workspace, metaWindow) {
		if (this.isNormalWindow(metaWindow)) {
			let window = this.extension.getWindow(metaWindow);
			log("onWindowRemove for " + window);
			if(window.workspaceSignals !== undefined) {
				log("Disconnecting " + window.workspaceSignals.length + " workspace-managed signals from window");
				window.workspaceSignals.map(function(signal) {
					log("Signal is " + signal + ", disconnecting from " + metaWindow);
					signal[0].disconnect(signal[1]);
				});
			}
			this.layout.on_window_killed(window);
			this.extension.removeWindow(metaWindow);
		}
	},

	isNormalWindow: function(metaWindow) {
		// TODO: add more smarts about floating / special windows (e.g. guake)
		try {
			return metaWindow.get_window_type() == Meta.WindowType.NORMAL && (!metaWindow.is_skip_taskbar());
		} catch (e) {
			log("Failed to get window type for window " + metaWindow + ", error was: " + e);
			return false;
		}
	},

	metaWindows: function() {
		var wins = this.metaWorkspace.list_windows();
		wins = wins.filter(Lang.bind(this, this.isNormalWindow));
		return wins;
	}
}
