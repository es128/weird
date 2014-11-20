'use strict';

var fs = require('fs');
var recast = require('recast');

var chars = require('./identifier-characters').shuffled;

var reserved = [
	'undefined', 'null', 'void', 'window', 'document', 'top', 'location',
	'global', 'process', 'console', 'require', 'exports', 'module', 'define',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'setImmediate', 'clearImmediate', 'arguments', 'atob', 'btoa',
	'Object', 'Function', 'Boolean', 'Symbol', 'String', 'RegExp', 'Buffer',
	'Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
	'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
	'ParallelArray', 'ArrayBuffer', 'DataView', 'JSON', 'toString',
	'Map', 'Set', 'WeakMap', 'WeakSet', 'parseInt', 'parseFloat', 'DOMParser',
	'Date', 'Math', 'Number', 'NaN', 'Infinity', 'isNaN', 'isFinite',
	'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
	'XMLHttpRequest', 'navigator', 'StopIteration', '__filename', '__dirname',
	'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
	'URIError', 'EvalError', 'eval', 'uneval', 'escape', 'unescape',
	'Iterator', 'Generator', 'Promise', 'Reflect', 'Proxy', 'Intl'

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
		if (
			body.type === 'MemberExpression' &&
			(!body.computed || body.property.type === 'Literal')
		) {
			var object = body.object.name;
			if (object === 'window' || object === 'global') {
				var prop = body.property[body.computed ? 'value' : 'name'];
				if (reserved.indexOf(prop) < 0 && !weirdIdentifiers[prop]) {
					reserved.push(prop);
				}
			}
		}
		Object.keys(body).forEach(function(key) {
			if (key === 'key' || key === 'property' && !body.computed) return;
			var obj = body[key];
			if (obj && obj.type) weirdAST(obj);
			else if (Array.isArray(obj)) obj.forEach(weirdAST);
		});
	}
}

module.exports = function weird(code, options) {
	code += ''; // coerce to string
	var shebang, sbr = /^\#\![^\n]+/g;
	if (shebang = code.match(sbr)) code = code.replace(sbr, '');
	var ast = recast.parse(code, options);
	ast.program.body.forEach(weirdAST);
	var result = recast.print(ast, options);
	if (shebang) result.code = shebang[0] + result.code;
	return result;
};
