# shellshape
A tiling window manager extension for gnome-shell. Many tiling window managers are an all-or-nothing affair, shellshape allows you to tile your windows when it makes sense, and still provides powerful direct manipulation when you need it. You don't have to give up any of the gnome features you like, so it makes for a very smooth learning curve.

This software is in-development. I use it daily, but it might break stuff. Use at your own risk.

I must thank [bluetile][bluetile], for it was the inspiration for this extension and many features are lifted directly from it (although not code, JS and haskell are vastly different beasts).

## Running it
Please see instructions on <http://gfxmonk.net/shellshape/>

To run your own checkout, you should be able to clone this repo and run `0launch shellshape-local.xml`.

## Friends
This extension is best used with the natural window placement extension.

Other extensions I use and recommend:

 - alternate status menu (the fact that this is not default bewilders me)
 - workspace switcher

All of these should be available from your package manager, or [the gnome shell extensions page](https://live.gnome.org/GnomeShell/Extensions)

## Hacking
The core layout stuff is in `tiling.coffee`. This should run in both the shell and in the web browser (see `interactive/index.html`; useful for testing layout changes). The mutter / gnome-shell integration is provided by the other .js files in the root directory (except for `tiling.js`, it is generated from `tiling.coffee`).

To report a bug or crash, please see the [github issues page](https://github.com/gfxmonk/shellshape/issues).

## Licence
GPLv3

[bluetile]: http://bluetile.org/
