A remarkably unfinished tiling window manager work-in-progress extension for gnome-shell.

To run it in gnome-shell, you will have to compile and run [my mutter fork](https://github.com/gfxmonk/mutter). I'm afraid I can't help you with how to do that, as the gnome build system is big and complicated, and you're probably better off just waiting until my patches are accepted (or I figure out something better).

To run in gnome-shell, you should be able to clone this repo (or make a symlink) in `/home/tim/.local/share/gnome-shell/extensions/shellshape@gfxmonk.net/`. Depending on your version of gnome-shell, you'll need to modify metadata.json as the shell will refuse to load extensions for a different version of gnome-shell.

Keyboard shortcuts are all manner of broken. I have tried to emulate bluetile's shortcuts for the most part, except that [almost all win+[letter] keyboard shortcuts do not work in gnome-shell](https://bugzilla.gnome.org/show_bug.cgi?id=624869). So for now you have to use win+alt+[letter]. Oh, and you have to press alt *before* you start pressing the windows key, because that's apparently a thing.

To try out all the tiling behaviour in a web browser (not very useful, but a whole lot easier than installing right now), you can peek at [the jQuery mockup](http://gfxmonk.github.com/shellshape/)

This extension is best used with the natural window placement extension. I personally recommend the alternate status menu extension as well, because not providing a power-off menu item is ridiculous.
