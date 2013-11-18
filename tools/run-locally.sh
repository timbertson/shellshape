#!/bin/bash
# only use this on a throwaway VM - it will override the list
# of installed extensions
set -ex

base="$(readlink -f "$(dirname "$(dirname "$0")")")"
cd "$base"
gsettings set org.gnome.shell enabled-extensions "['shellshape@gfxmonk.net']"
export XDG_DATA_DIRS="$base/xdg/data:$XDG_DATA_DIRS:/usr/local/share/:/usr/share/"
export GJS_PATH="$base/lib:$GJS_PATH"
export SHELLSHAPE_DEBUG=1
exec gnome-shell "$@"
