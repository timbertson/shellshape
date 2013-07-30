exec >&2
set -eu
redo-ifchange "$2".coffee
0install run --not-before=1.3.1 http://gfxmonk.net/dist/0install/coffee-script.xml \
	--bare -c "$2".coffee
touch "$3"
