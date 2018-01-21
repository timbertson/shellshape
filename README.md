<img src="http://gfxmonk.net/dist/status/project/shellshape.png">

### Note: no longer in active development

I am no longer using or actively developing shellshape. I have focused my efforts on [slinger](https://github.com/timbertson/slinger), which I created as a simpler window management utility with many of the same benefits as shellshape, but with a fraction of the code, complexity and bugs. If anyone wishes to maintain shellshape (and fix said bugs ;)), please get in touch.

# shellshape

A tiling window manager extension for gnome-shell. Many tiling window managers are an all-or-nothing affair, shellshape allows you to tile your windows when it makes sense, and still provides powerful direct manipulation when you need it. You don't have to give up any of the gnome features you like, so it makes for a very smooth learning curve.


I must thank [bluetile][bluetile], for it was the inspiration for this extension and many features are lifted directly from it (although not code, JS and haskell are vastly different beasts).

## Running it

You can install it from [the official gnome shell extensions site](https://extensions.gnome.org/extension/294/shellshape/).
This may lag (sometimes months) behind the development release, as they perform manual approval of all updates.

### Running a local version

To build the latest version, you'll need to install `npm` (the node.js package manager). You'll also need python. Then:

 1. clone this repo
 2. run `tools/gup compile`
 3. you can install the extension to a symlink in ~/.local/share/gnome-shell/extensions using:

        tools/gup dev-install

To compile stuff (after changing some source code), run `tools/gup compile`. You can add e.g `-j3` to compile stuff in parallel.

## Package manager
 * **Arch Linux :** [```gnome-shell-extension-shellshape-git```](https://aur.archlinux.org/packages/gnome-shell-extension-shellshape-git/) from AUR

# Important note about ongoing development

I love shellshape, and I love using it. But to be honest, I hate working in gnome-shell these days. It's poorly documented, breaks occasionally, and generally a pain in the ass to hack on (which I do in my spare time). So my main aim in ongoing development is to make sure shellshape keeps working for new gnome releases, and to fix bugs. I may not run the latest gnome version for a while after it's released, because I'm lazy, and being on the cutting edge is not as exciting as it used to be.

I will probably not implement your feature suggestion unless it's brilliant or simple (or both!). It's nothing personal. That's not to say that shellshape will see no new features - if you want to add a new feature, I'll do what I can to get it merged. Please file an issue with your idea first though, so I can let you know how likely it is to (a) be possible, and (b) get merged.

To reflect this, most issues will be tagged with `wishlist` - I am not planning to implement them, but I have no issue with others doing so. I'll try to fix non-wishlist issues myself (_eventually_), especially those tagged "bug". But please feel free to help fix those too, if you can!


## Hacking

The source code is all TypeScript. This is mostly like JavaScript, but it has optional type annotations, a module system, and (sometimes) it yells at you when you do something that makes no sense. Which is a nicer experience than gnome-shell yelling at you, crashing, and disabling all of your extensions.

 - `interactive/`: run the core tiling code in the browser (_without_ killing gnome shell when you break something ;))
 - `src/tiling.ts`: core tiling & layout stuff
 - `src/gjs`: gnome-shell specific stuff (mutter integration, extension system, indicator, etc)
 - `src/node`: nodejs shim, used for running tests
 - `src/xbrowser`: browser shim, used for `interactive/index.html`
 - `src/stub`: nodejs shim, used for running tests
 - `shellshape/`: third party libs, metadata.json, translations, gschemas, etc

Build targets with `tools/gup`. Targets exist wherever there is a corresponding `*.gup` file. You can find those with:

    $ git ls-files | fgrep '.gup' | sed -e 's!/gup/!/!;s!\.gup$!!'

Not all of them will work, as some might depend on tools only I happen to have installed. Patches welcome if you find + fix that sort of thing.

## Debugging

If you export `SHELLSHAPE_DEBUG=all`, you will get a debug log written to `/tmp/shellshape.log`. You can set values other than `all` if you want to debug on specific topics (available topics include `extension`, `indicator`, `tiling`, `workspace` and `window`) - they should be set as a comma-delimited string, e.g `SHELLSHAPE_DEBUG=workspace,tiling`.

## "It doesn't work"

If you don't know why, here's some things to check:

 - Check the extension is enabled (you can see this in the "Shell Extensions" section of `gnome-tweak-tool`)
 - See if there are any errors in looking glass that mention shellshape (press alt-F2, type "`lg`" and then click the "Errors" tab)
 - Check the console output (if running in a console) for any messages that mention shellshape
 - Check /tmp/shellshape.log after launching with $SHELLSHAPE_DEBUG=all

To report a bug or crash, please see the [github issues page](https://github.com/gfxmonk/shellshape/issues).

## Keyboard shortcuts

Are listed at [http://gfxmonk.net/shellshape/](http://gfxmonk.net/shellshape/)

To modify the defaults point dconf-editor at org.gnome.shell.extensions.net.gfxmonk.shellshape.keybindings

Some helpful folk have created graphical (SVG) versions of the keyboard shortcuts, to serve as a handy reference:

**Note:** These are for versions prior to 0.12. Anyone want to update them?

 - [Keyboard overlay image](https://github.com/downloads/gfxmonk/shellshape/keyboardshortcuts.svg) - Jordan Klassen

## Licence
GPLv3

## Changelog

### version 0.13
 - gnome-shell 3.18 compatibility
 - bug fixes, particularly around settings, startup and enable/disable

### version 0.12
 - gnome-shell 3.16 compatibility
 - Changes to keyboard shortcuts
 - Next/Previous layout shortcuts (not bound by default)

### version 0.10
 - Fairly large overhaul to codebase:
    - Removed coffeescript, now using typescript instead. This is a JavaScript superset (so for the most part it's _just JavaScript_), but with optional static typing.
      This has improved the quality of the code in a number of places (it uncovered a number of dumb type-related bugs), and removes the need for contributors to know CoffeeScript.
    - Lots of cleanup of state management. This improves a number of circumstances where shellshape and gnome-shell disagree about the state of windows / workspaces, etc.
    - Made "default layout" setting apply instantly, rather then require a restart.
    - Additional misc bugs fixed while going through the codebase.

### version 0.9
 - Support for gnome-shell 3.12

### version 0.8
 - Preliminary support for multiple monitors
 - Update screen bounds every time we do a layout

### version 0.7
 - API changes for gnome-shell 3.10.
   This makes 0.7 incompatible with anything before 3.10.

### version 0.6.1
 - Fixed "Shellshape settings" indicator menu in gnome-shell 3.8

### version 0.6
 - Support for gnome-shell 3.8
 - Support for localisation (plus german translation) thanks to @jonnius

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
