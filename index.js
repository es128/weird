'use strict';

var fs = require('fs');
var recast = require('recast');
var globals = require('globals');

var chars = require('./identifier-characters').shuffled;

var reserved = Object.create(null);
['builtin', 'browser', 'node'].forEach(function(group) {
	Object.keys(globals[group]).forEach(function(global) {
		reserved[global] = 1;
	});
});

var weirdIdentifiers = Object.create(null);
var weirdIdentifiersInv = Object.create(null);
var opts = {};
function weirdAST(body) {
	if (!body || !body.type) return;
	if (body.type === 'Identifier' &&
		(
			!reserved[body.name] ||
			(opts.aliasGlobals && reserved[body.name] < 4)
		)
	) {
		if (!(body.name in weirdIdentifiers)) {
			var newIdentifier;
			var length = body.name.length;
			var charsStart = chars.start;
			var charsAll = chars.all;
			while (!newIdentifier || newIdentifier in weirdIdentifiersInv) {
				var i = Math.floor(Math.random() * (charsAll.length - length));
				newIdentifier =
					charsStart[Math.floor(Math.random() * charsStart.length)] +
					charsAll.slice(i, i + length - 1).join('');
			}
			weirdIdentifiers[body.name] = newIdentifier;
			weirdIdentifiersInv[newIdentifier] = body.name;
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
				if (!(prop in reserved) && !weirdIdentifiers[prop]) {
					reserved[prop] = 2;
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

function specialLists(arr, id) {
	if (!Array.isArray(arr)) return;
	arr.forEach(function(word) { reserved[word] = id });
}

module.exports = function weird(code, options) {
	code += ''; // coerce to string
	if (!options) options = {};
	opts = options;
	var shebang, sbr = /^\#\![^\n]+/g;
	if (shebang = code.match(sbr)) code = code.replace(sbr, '');
	specialLists(options.globals, 3);
	specialLists(options.unreserved, 0);
	specialLists(options.reserved, 4);
	var ast = recast.parse(code, options);
	ast.program.body.forEach(weirdAST);
	var result = recast.print(ast, options);
	if (shebang) result.code = shebang[0] + result.code;
	return result;
};
