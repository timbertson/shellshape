watchdog=0launch http://gfxmonk.net/dist/0install/watchdog.xml
coffee=0launch http://gfxmonk.net/dist/0install/coffee-script.xml
spec=0launch http://gfxmonk.net/dist/0install/coffee-spec.xml

js: phony
	${coffee} -c split.coffee

test: phony
	${spec} tests

auto: phony
	${watchdog} tricks .tricks.yaml

.PHONY: phony

