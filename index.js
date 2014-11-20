'use strict';

var fs = require('fs');
var recast = require('recast');

var chars = require('./identifier-characters').shuffled;

var reserved = [
	'undefined', 'null', 'void', 'window', 'document', 'top', 'location',
	'global', 'process', 'console', 'require', 'exports', 'module', 'define',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'setImmediate', 'clearImmediate', 'arguments', 'eval', 'Error',
	'Object', 'Function', 'Array', 'String', 'RegExp', 'Buffer', 'Boolean',
	'Date', 'Math', 'Number', 'NaN', 'Infinity', 'parseInt', 'parseFloat',
	'toString', 'JSON', 'DOMParser', 'XMLHttpRequest', 'atob', 'btoa',
	'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
	'__filename', '__dirname'

];

var weirdIdentifiers = Object.create(null);
function weirdAST(body) {
	if (!body || !body.type) return;
	if (body.type === 'Identifier' && reserved.indexOf(body.name) < 0) {
		if (!(body.name in weirdIdentifiers)) {
			weirdIdentifiers[body.name] =
				chars.start.splice(0, body.name.length).join('');
		}
		body.name = weirdIdentifiers[body.name];
	} else {
		Object.keys(body).forEach(function(key) {
			if (key === 'key' || key === 'property' && !body.computed) return;
			var obj = body[key];
			if (obj && obj.type) weirdAST(obj);
			else if (Array.isArray(obj)) obj.forEach(weirdAST);
		});
	}
}

module.exports = function weird(code, options) {
	var shebang, sbr = /^\#\![^\n]+/g;
	if (shebang = code.match(sbr)) code = code.replace(sbr, '');
	var ast = recast.parse(code, options);
	ast.program.body.forEach(weirdAST);
	var result = recast.print(ast, options);
	if (shebang) result.code = shebang[0] + result.code;
	return result;
};
