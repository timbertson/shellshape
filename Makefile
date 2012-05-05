watchdog=0launch http://gfxmonk.net/dist/0install/watchdog.xml
coffee=0launch http://gfxmonk.net/dist/0install/coffee-script.xml
spec=0launch --not-before=0.4 http://gfxmonk.net/dist/0install/coffee-spec.xml
markdown=0launch http://gfxmonk.net/dist/0install/markdown.xml
template=0launch http://gfxmonk.net/dist/0install/template.xml

all: js shellshape/schemas

schemas: phony
	make -C schemas

js: phony
	${coffee} --bare -c shellshape/tiling.coffee

test: phony js
	${spec} -vc tests

auto: phony js
	${watchdog} tricks .tricks.yaml

0: phony js
	mkzero-gfxmonk \
		-p gnome-shell.desktop \
		-p shellshape \
		-p xdg \
		-p lib \
		shellshape.xml

ZIP_FILE=0inst/shellshape.zip
zip: phony
	rm -f ${ZIP_FILE}
	(cd shellshape && \
		zip -r ../${ZIP_FILE} * && \
		cd .. && \
		zip -gr ${ZIP_FILE} xdg/data/glib-2.0 && \
		zip -gr ${ZIP_FILE} xdg/data/icons \
	)

test-zip: extract-zip
	unset XDG_DATA_DIRS && \
		ln -sf ${TEMP_DIR} ${SHELLSHAPE_LOCALLY} && \
		SHELLSHAPE_DEBUG=1 /usr/bin/gnome-shell --replace & \
		read _wait; \
		${MAKE} uninstall-symlink remove-tempdir

SHELLSHAPE_LOCALLY=~/.local/share/gnome-shell/extensions/shellshape@gfxmonk.net
TEMP_DIR=/tmp/shellshape-test

extract-zip: zip remove-tempdir
	(here="$$(pwd)" && \
		mkdir -p ${TEMP_DIR} && \
		cd ${TEMP_DIR} && \
		unzip "$$here/${ZIP_FILE}")

uninstall-symlink: phony
	[ -L ${SHELLSHAPE_LOCALLY} ]
	rm ${SHELLSHAPE_LOCALLY}

remove-tempdir: phony
	rm -rf "${TEMP_DIR}"

.PHONY: phony
