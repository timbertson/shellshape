{pkgs ? import <nixpkgs> {}}:
with pkgs;
lib.overrideDerivation (callPackage ./nix {}) (o: {
	name = "shellshape-local";
	src = ./nix/local.tgz;
})
