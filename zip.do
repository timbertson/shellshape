set -eu
redo compile
exec >&2
ZIP_FILE=0inst/shellshape.zip
rm -f $ZIP_FILE

cd shellshape
zip -r ../$ZIP_FILE * --exclude '*.do' --exclude '*.stamp' --exclude '*.coffee'
cd ..
zip -gr $ZIP_FILE xdg/data/glib-2.0
zip -gr $ZIP_FILE xdg/data/icons
