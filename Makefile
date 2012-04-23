watchdog=0launch http://gfxmonk.net/dist/0install/watchdog.xml
coffee=0launch http://gfxmonk.net/dist/0install/coffee-script.xml
spec=0launch --not-before=0.4 http://gfxmonk.net/dist/0install/coffee-spec.xml
markdown=0launch http://gfxmonk.net/dist/0install/markdown.xml
template=0launch http://gfxmonk.net/dist/0install/template.xml

all: js shellshape/schemas

shellshape/schemas: phony
	make -C shellshape/schemas

js: phony
	${coffee} --bare -c shellshape/tiling.coffee

test: phony js
	${spec} -vc tests

auto: phony js
	${watchdog} tricks .tricks.yaml

0: phony js
	mkzero-gfxmonk \
		-p gnome-shell.desktop \
		-p run-gnome-shell \
		-p shellshape \
		-p xdg \
		-p lib \
		shellshape.xml

.PHONY: phony
