watchdog=0launch http://gfxmonk.net/dist/0install/watchdog.xml
coffee=0launch http://gfxmonk.net/dist/0install/coffee-script.xml
spec=0launch http://gfxmonk.net/dist/0install/coffee-spec.xml
markdown=0launch http://gfxmonk.net/dist/0install/markdown.xml
template=0launch http://gfxmonk.net/dist/0install/template.xml

js: phony
	${coffee} --bare -c tiling.coffee

test: phony js
	${spec} -vc tests

auto: phony js
	${watchdog} tricks .tricks.yaml

index.html: README.md index.html.template
	export readme_content="`${markdown} README.md`" && ${template} index.html.template index.html

.PHONY: phony
