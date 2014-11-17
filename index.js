'use strict';

var fs = require('fs');
var recast = require('recast');

var ast = recast.parse(fs.readFileSync('../chokidar/index.js'));

var startTime = process.hrtime();

var reserved = [
	'global', 'window', 'process', 'console', 'require', 'exports', 'module',
	'arguments', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'setImmediate', 'clearImmediate', 'toString', 'parseInt', 'Object',
	'Function', 'Array', 'String', 'RegExp', 'Buffer', 'Boolean', 'Date',
	'Math', 'Number', 'NaN', 'Infinity', 'document', 'eval',
];

var weirdIdentifiers = Object.create(null);
function weirdAST(body) {
	if (!body || !body.type) return;
	if (body.type === 'Identifier' && reserved.indexOf(body.name) < 0) {
		weirdIdentifiers[body.name] = body.name;
		body.name = 'elan';
	} else {
		Object.keys(body).forEach(function(key) {
			if (key === 'property' || key === 'key') return;
			var obj = body[key];
			if (obj && obj.type) weirdAST(obj);
			else if (Array.isArray(obj)) obj.forEach(weirdAST);
		});
	}
}

ast.program.body.forEach(weirdAST);

console.log(recast.print(ast).code);
console.log(Object.keys(weirdIdentifiers).sort());
console.log(Object.keys(weirdIdentifiers).length);
console.log(process.hrtime(startTime))
