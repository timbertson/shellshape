# shellshape
A tiling window manager extension for gnome-shell.

This software is in-development. I use it daily, but it might break stuff. Use at your own risk.

**Note**: you will have to compile and run [my mutter fork](https://github.com/gfxmonk/mutter) to use this extension. I'm afraid I can't help you with how to do that, as the gnome build system is big and complicated, and you're probably better off just waiting until my patches are accepted (or I figure out something better).

If you want to track progress towards a useable plugin, you can take a peek at the [project issues](https://github.com/gfxmonk/shellshape/issues)

To run in gnome-shell, you should be able to clone this repo (or make a symlink) in `/home/tim/.local/share/gnome-shell/extensions/shellshape@gfxmonk.net/`. Depending on your version of gnome-shell, you'll need to modify `metadata.json` as the shell will refuse to load extensions for a different version of gnome-shell.

To try out all the tiling behaviour in a web browser (not very useful, but a whole lot easier than installing right now), you can peek at [the jQuery mockup](http://gfxmonk.github.com/shellshape/)

This extension is best used with the natural window placement extension. I personally recommend the alternate status menu extension as well, because not providing a power-off menu item is ridiculous.
