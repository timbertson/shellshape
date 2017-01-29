{stdenv, nodePackages, gup, glib, which, python}:
stdenv.mkDerivation {
	name = "shellshape";
	src = null; # TODO
	buildInputs = [ gup nodePackages.typescript glib which python ];
	buildPhase = ''
		gup compile
	'';
	installPhase = ''
		dest=$out/share/gnome-shell/extensions
		mkdir -p $dest
		cp -r --dereference shellshape $dest/shellshape@gfxmonk.net
	'';
}
