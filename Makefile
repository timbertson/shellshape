watchdog=0launch http://gfxmonk.net/dist/0install/watchdog.xml
coffee=0launch http://gfxmonk.net/dist/0install/coffee-script.xml
spec=0launch http://gfxmonk.net/dist/0install/coffee-spec.xml

js: phony
	${coffee} -c interactive/js/tiling.coffee

test: js
	${spec} -v tests

auto: phony js
	${watchdog} tricks .tricks.yaml

.PHONY: phony

