#!/bin/bash
set -eux

TEMP_DIR=/tmp/shellshape-test

remove_tempdir () {
	rm -rf "${TEMP_DIR}"
}

trap remove_tempdir EXIT

here="$(pwd)"
remove_tempdir

(
	mkdir -p ${TEMP_DIR}
	cd ${TEMP_DIR}
	gup -u "$here/zip"
	unzip "$here/0inst/shellshape.zip"
)

unset XDG_DATA_DIRS
gup -u "$here/dev-install"
SHELLSHAPE_DEBUG=1 /usr/bin/gnome-shell --replace &
read _wait;

