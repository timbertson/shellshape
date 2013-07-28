set -eux
exec >&2
mkdir -p compiled
redo-ifchange inputs
#cat *.gschema.xml | redo-stamp
glib-compile-schemas . --targetdir="compiled"
mv compiled/gschemas.compiled "$3"
rm -rf compiled
