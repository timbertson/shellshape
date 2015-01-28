set -eu
if [ "${GUP_XTRACE:-}" = 1 ]; then
	set -x
fi
COMPILE_MODE="$(dirname "$2")"
GUPDIR="$(dirname "${BASH_SOURCE[0]}")"
mkdir -p "$COMPILE_MODE"
gup -u "$GUPDIR/common.sh"

function compile_sources {
	prefix="../src/$COMPILE_MODE/"
	find . ! -type d -printf "$prefix%p\n$prefix%l\n" | grep '\.ts$'
}
function compile_targets {
	compile_sources | sed -e 's/^.*\///' -e 's/\.ts$/.js/'
}
