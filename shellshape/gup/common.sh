set -eux
gup -u "${BASH_SOURCE[0]}"
function compile_sources {
	ls -1 . | grep '\.ts$'
}
function compile_targets {
	compile_sources | sed -e 's/\.ts$/.js/'
}
