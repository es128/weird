'use strict';

var fs = require('fs');
var recast = require('recast');

var chars = require('./identifier-characters').shuffled;

var ast = recast.parse(fs.readFileSync('../chokidar/index.js'));

var reserved = [
	'undefined', 'null', 'void', 'global', 'window', 'document', 'process',
	'console', 'eval', 'arguments', 'require', 'exports', 'module',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'setImmediate', 'clearImmediate', 'toString', 'parseInt', 'Object',
	'Function', 'Array', 'String', 'RegExp', 'Buffer', 'Boolean', 'Date',
	'Math', 'Number', 'NaN', 'Infinity',
];

var weirdIdentifiers = Object.create(null);
function weirdAST(body) {
	if (!body || !body.type) return;
	if (body.type === 'Identifier' && reserved.indexOf(body.name) < 0) {
		if (!(body.name in weirdIdentifiers)) {
			weirdIdentifiers[body.name] = chars.start.shift();
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

ast.program.body.forEach(weirdAST);

console.log(recast.print(ast).code);
