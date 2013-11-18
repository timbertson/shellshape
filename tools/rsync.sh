#!/bin/bash
set -eux
rsync --delete -av ./ liveuser@linux.local:Desktop/shellshape \
	--exclude='.git' --exclude='video' --exclude='gnome-shell'
