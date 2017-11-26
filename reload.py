#!/usr/bin/env python3
#!nix-shell -i python3 -p python3Packages.pygobject3 -p gnome3.dconf.lib

import sys, os
from gi.repository import Gio

args = sys.argv[1:]
gsettings = Gio.Settings.new('org.gnome.shell')
ext = 'shellshape@gfxmonk.net'
if args:
	ext, = args
KEY = 'enabled-extensions'
enabled = gsettings[KEY]
if ext in enabled:
	enabled = enabled[:]
	enabled.remove(ext)
	gsettings[KEY] = enabled

enabled = enabled[:]
enabled.append(ext)
if os.environ.get('DISABLE') != '1':
	gsettings[KEY] = enabled
