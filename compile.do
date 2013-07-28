exec >&2
redo-always
0install run --not-before=1.3.1 http://gfxmonk.net/dist/0install/coffee-script.xml --bare -c shellshape/tiling.coffee
redo-ifchange schemas

