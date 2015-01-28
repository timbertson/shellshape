#!/bin/bash
set -eu
gup -u ../node_modules

pkg="../node_modules/$1"
bin="$pkg/$2"
dest="$3"

[ -e "$bin" ] || (echo "No such file: $bin"; exit 1)
ln -s "$bin" "$dest"
gup --contents "$pkg/package.json"
