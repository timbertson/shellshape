# shellshape
A tiling window manager extension for gnome-shell. Many tiling window managers are an all-or-nothing affair, shellshape allows you to tile your windows when it makes sense, and still provides powerful direct manipulation when you need it. You don't have to give up any of the gnome features you like, so it makes for a very smooth learning curve.

This software is in-development. I use it daily, but it might break stuff. Use at your own risk.

I must thank [bluetile][bluetile], for it was the inspiration for this extension and many features are lifted directly from it (although not code, JS and haskell are vastly different beasts).

## Running it
Is not (yet) for the faint of heart.

You will have to compile and run [my mutter fork](https://github.com/gfxmonk/mutter) to use this extension. I'm afraid I can't help you with how to do that, as the gnome build system is big and complicated, and you're probably better off just waiting until my patches are accepted (or I figure out something better).

To run in gnome-shell, you should be able to clone this repo (or make a symlink) in `~/.local/share/gnome-shell/extensions/shellshape@gfxmonk.net/`. Depending on your version of gnome-shell, you'll need to modify `metadata.json` as the shell will refuse to load extensions for a different version of gnome-shell.

## Keyboard shortcuts

Many shortcuts are the same as [bluetile], except where functionality differs. Here's the full list:

Selecting layouts:
**win+d** switch current workspace to tiled mode
**win+f** switch current workspace to floating mode
(the status is also shown and selectable from an indicator)

Window navigation:
**win+j**, **win-tab** select next window
**win+k**, **win-shift-tab** select prev window
**win+space** select main window

Window manipulation
**win+shift+j** swap with next window
**win+shift+k** swap with prev window
**win+shift+space** swap with main window

Tile management:
**win+p** tile (_place_) the current window (also: reset window position to tile boundaries)
**win+y** untile (_yank_) the current window
**win+shift+p** adjust tile boundaries to accommodate current window size
**win+,** more windows in the master area
**win+.** less windows in the master area

Resizing tiles:
**win+h** shrink master area
**win+l** grow master area
**win+u** shrink a slave area
**win+i** grow a slave area

Resizing windows:
**win+shift+h** decrease window's width
**win+shift+l** increase window's width
**win+shift+u** decrease window's height
**win+shift+i** increase window's height
**win+equal** increase window's size
**win+minus** decrease window's size
**win+z** toggle window maximized state

Workspace actions:
**win+alt+j** go to workspace below
**win+alt+k** go to workspace above
**win+alt+shift+j** move window to workspace below
**win+alt+shift+k** move window to workspace above


Actions that are provided by gnome-shell are *not* modified, so I suggest you change the following shortcuts yourself:

**win+shift+c** close window
**win+m** minimize window

Of course, you can still use your mouse to move / resize windows as you normally would in gnome. If you move a tiled window over another tile, their positions will swap.

## Friends
This extension is best used with the natural window placement extension.

Other extensions I use and recommend:
 - alternate status menu (the fact that this is not default bewilders me)
 - workspace switcher
All of these should be available from your package manager, or [the gnome shell extensions page](https://live.gnome.org/GnomeShell/Extensions)

## Hacking
The core layout stuff is in `tiling.coffee`. This should run in both the shell and in the web browser (see `interactive/index.html`; useful for testing layout changes). The mutter / gnome-shell integration is provided by the other .js files in the root directory (except for `tiling.js`, it is generated from `tiling.coffee`).

To report a bug or crash, please see the [github issues page](https://github.com/gfxmonk/shellshape/issues).

[bluetile]: http://bluetile.org/
