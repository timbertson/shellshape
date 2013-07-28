exec >&2
set -eux
redo-ifchange js
0launch --not-before=0.4 http://gfxmonk.net/dist/0install/coffee-spec.xml -v tests
