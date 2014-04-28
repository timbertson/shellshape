#!/bin/bash
set -eu
if [ which 0install >/dev/null 2>&1 ]; then
	exec 0install run --not-before=1.3.1 http://gfxmonk.net/dist/0install/coffee-script.xml "$@"
else
	exec coffee "$@"
fi

