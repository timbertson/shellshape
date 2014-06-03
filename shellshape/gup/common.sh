set -eu
if [ "${GUP_XTRACE:-}" = 1 ]; then
	set -x
fi
gup -u "${BASH_SOURCE[0]}"
function compile_sources {
	find ../src/ -type f | grep '\.ts$'
}
function compile_targets {
	compile_sources | sed -e 's/^.*\///' -e 's/\.ts$/.js/'
}
