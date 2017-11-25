/// <reference path="common.ts" />
function init() {
	const self = imports.misc.extensionUtils.getCurrentExtension();
	const autoImport = (function(searchPath) {
		imports.searchPath = ["/"];
		try {
			return imports[self.path + "/auto-import"];
		} finally {
			imports.searchPath = searchPath;
		}
	})(imports.searchPath.slice());
	return autoImport.wrapExtensionModule(self, 'extension_impl');
}
