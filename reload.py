#!/usr/bin/env python3
#!nix-shell -i python3 -p python3Packages.pygobject3 -p gnome3.dconf.lib

from gi.repository import Gio
gsettings = Gio.Settings.new('org.gnome.shell')
ext = 'shellshape@gfxmonk.net'
KEY = 'enabled-extensions'
enabled = gsettings[KEY]
if ext in enabled:
	enabled = enabled[:]
	enabled.remove(ext)
	gsettings[KEY] = enabled

enabled = enabled[:]
enabled.append(ext)
gsettings[KEY] = enabled
