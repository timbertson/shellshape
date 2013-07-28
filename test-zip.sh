#!/bin/bash
set -eux

SHELLSHAPE_LOCALLY=~/.local/share/gnome-shell/extensions/shellshape@gfxmonk.net
TEMP_DIR=/tmp/shellshape-test

remove_tempdir () {
	rm -rf "${TEMP_DIR}"
}

uninstall_symlink () {
	if [ -L ${SHELLSHAPE_LOCALLY} ]; then
		rm ${SHELLSHAPE_LOCALLY}
	fi
}

cleanup () {
	uninstall_symlink
	remove_tempdir
}

trap cleanup EXIT

remove_tempdir
(here="$(pwd)"
	mkdir -p ${TEMP_DIR}
	cd ${TEMP_DIR}
	unzip "$here/0inst/shellshape.zip")

unset XDG_DATA_DIRS
mkdir -p "$(dirname "$SHELLSHAPE_LOCALLY")"
ln -sf "$TEMP_DIR" "$SHELLSHAPE_LOCALLY"
SHELLSHAPE_DEBUG=1 /usr/bin/gnome-shell --replace &
read _wait;

