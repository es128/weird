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
function weirdAST(body) {
	if (!body || !body.type) return;
	if (body.type === 'Identifier' && !reserved[body.name]) {
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
				if (!reserved[prop] && !weirdIdentifiers[prop]) {
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

module.exports = function weird(code, options) {
	code += ''; // coerce to string
	if (!options) options = {};
	var shebang, sbr = /^\#\![^\n]+/g;
	if (shebang = code.match(sbr)) code = code.replace(sbr, '');
	if (Array.isArray(options.reserved)) {
		options.reserved.forEach(function(word) {
			reserved[word] = 3;
		});
	}
	var ast = recast.parse(code, options);
	ast.program.body.forEach(weirdAST);
	var result = recast.print(ast, options);
	if (shebang) result.code = shebang[0] + result.code;
	return result;
};
