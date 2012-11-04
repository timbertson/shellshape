# shellshape
A tiling window manager extension for gnome-shell. Many tiling window managers are an all-or-nothing affair, shellshape allows you to tile your windows when it makes sense, and still provides powerful direct manipulation when you need it. You don't have to give up any of the gnome features you like, so it makes for a very smooth learning curve.

This software is in-development. I use it daily, but it might break stuff. Use at your own risk. Multiple monitor support is not really present, and doing fancy things like "always on top" windows may or may not break it.

I must thank [bluetile][bluetile], for it was the inspiration for this extension and many features are lifted directly from it (although not code, JS and haskell are vastly different beasts).

## Running it on gnome-shell 3.4*

Briefly, `0launch http://gfxmonk.net/dist/0install/shellshape.xml`. If you don't have `0launch`, you should install the `zeroinstall-injector` package first.
For more details, please see instructions on <http://gfxmonk.net/shellshape/>

To run your own checkout, you should be able to clone this repo and run `0launch shellshape-local.xml`. As of gnome-shell 3.4.1, you can also / instead install the development version locally. In the root of the repo, run:

	ln -s "$PWD/shellshape" "~/.local/share/gnome-shell/extensions/shellshape@gfxmonk.net"

## Running it on gnome-shell 3.2*

Is hard, error-prone, and no longer supported. Sorry!

## running on arch linux

You may want to try [this user-maintained package](https://aur.archlinux.org/packages.php?ID=50257) if the normal method doesn't work for you, but I have no idea what it will do to your system.

## "It doesn't work"

If you don't know why, here's some things to check:

	- Check the extension is enabled (you can see this in the "Shell Extensions" section of `gnome-tweak-tool`)
	- See if there are any errors in looking glass that mention shellshape (press alt-F2, type "`lg`" and then click the "Errors" tab)
	- Check the console output (if running in a console) for any messages that mention shellshape
	- Check /tmp/shellshape.log after launching with $SHELLSHAPE_DEBUG=all

To report a bug or crash, please see the [github issues page](https://github.com/gfxmonk/shellshape/issues).

## Replace gnome-shell

If you symlink the provided `gnome-shell.desktop` file to `~/.local/share/applications/`, gnome-session will use that to launch gnome-shell instead of the system's gnome-shell. Uninstalling is as simple as removing that file.

## Friends
This extension is best used with the natural window placement extension.

Other extensions I use and recommend:

 - alternate status menu (the fact that this is not default bewilders me)
 - workspace switcher

All of these should be available from your package manager, or [the gnome shell extensions page](https://live.gnome.org/GnomeShell/Extensions)

## Keyboard shortcuts

Are listed at [http://gfxmonk.net/shellshape/](http://gfxmonk.net/shellshape/)
Some helpful folk have created graphical (SVG) versions of the keyboard shortcuts, to serve as a handy reference:

 - [Keyboard overlay image](https://github.com/downloads/gfxmonk/shellshape/keyboardshortcuts.svg) - Jordan Klassen
 - [Desktop wallpaper](http://dl.dropbox.com/u/1879450/shellshape.svg) - Andreas Wallberg ([source](https://github.com/gfxmonk/shellshape/issues/95))

## Hacking
The core layout stuff is in `tiling.coffee`. This should run in both the shell and in the web browser (see `interactive/index.html`; useful for testing layout changes). The mutter / gnome-shell integration is provided by the other .js files in the root directory (except for `tiling.js`, it is generated from `tiling.coffee`).

## Debugging
If you export `SHELLSHAPE_DEBUG=all`, you will get a debug log written to `/tmp/shellshape.log`. You can set values other than `all` if you want to debug on specific topics (available topics include `extension`, `indicator`, `tiling`, `workspace` and `window`) - they should be set as a comma-delimited string, e.g `SHELLSHAPE_DEBUG=workspace,tiling`.

**Note** debugging like this won't work unless you run using `0launch`.

## Licence
GPLv3

## Changelog

### version 0.5.4
 - Support for gnome-shell 3.6

### version 0.5.3
 - Fix error launching dconf-editor from the preferences panel

### version 0.5.2
 - Updated manifest.json to declare compatibility with gnome-shell 3.4.2
 - Include LICENCE and README.md files in tarball

### version 0.5.1
 - Added blacklist to prevent "Conky" windows from being tiled.
 - Fixed a number of bugs to do with tracking window movement and sizes.
 - Switched the "Horizontal" and "Vertical" layouts. You may need to adjust your keyboard shortcuts if you've set them to anything non-default, as the gsettings keys have swapped as well (if you haven't customised shortcuts, the defaults will still do the right thing)..

### version 0.5:
 - Removed label from indicator icon.
 - Rework icons to be simpler and look/act like other symbolic icons in the panel.
 - Added a preferences panel (accessible from the gse website, or `gnome-shell-extension-prefs`).
 - Added a "max autotile windows" option.
 - Added the ability to customise keyboard shortcuts from the preferences panel.

### version 0.4:
 - First release on extensions.gnome.org

[bluetile]: http://bluetile.org/
