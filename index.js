'use strict';

var fs = require('fs');
var recast = require('recast');
var globals = require('globals');
var shuffle = require('knuth-shuffle').knuthShuffle;

var genCharArray = require('./generate-character-array');
var chars = require('./identifier-characters');
var charSets = require('./char-sets');
var charMaps = require('./char-maps');

var reserved = Object.create(null);
['builtin', 'browser', 'node'].forEach(function(group) {
	Object.keys(globals[group]).forEach(function(global) {
		reserved[global] = 1;
	});
});

var weirdIdentifiers = Object.create(null);
var weirdIdentifiersInv = Object.create(null);
var opts = {};

function randPick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function makeWeirdIdentifier(name) {
	var newIdentifier;
	var length = name.length;
	var charsStart = chars.sparse.start;
	var charsAll = chars.sparse.all;
	if (opts.map && charMaps[opts.map]) {
		var mapper = charMaps[opts.map];
		newIdentifier = (mapper.fn ? mapper.fn.apply(name) : name)
			.split('').map(function(a) {
				if (!mapper[a]) return a;
				var map = mapper[a].split('').filter(function(c) {
					return c.charCodeAt() in (i ? charsAll : charsStart);
				});
				return randPick(map);
			}).join('');
	} else {
		var startSet;
		var allSet;
		if (opts.set && charSets[opts.set]) {
			var charArray = genCharArray(charSets[opts.set]);
			startSet = shuffle(charArray.filter(function(a) {
				return a.charCodeAt() in charsStart;
			}));
			allSet = shuffle(charArray.filter(function(a) {
				return a.charCodeAt() in charsStart;
			}));
		} else {
			startSet = shuffle(chars.dense.start.slice());
			allSet = shuffle(chars.dense.all.slice());
		}
		while (!newIdentifier || newIdentifier in weirdIdentifiersInv) {
			var i = Math.floor(Math.random() * (allSet.length - length));
			newIdentifier = randPick(startSet) +
				allSet.slice(i, i + length - 1).join('');
		}
	}
	weirdIdentifiers[name] = newIdentifier;
	weirdIdentifiersInv[newIdentifier] = name;
}

function weirdAST(body) {
	if (!body || !body.type) return;
	if (body.type === 'Identifier' &&
		(
			!reserved[body.name] ||
			(opts.aliasGlobals && reserved[body.name] < 4)
		)
	) {
		if (!(body.name in weirdIdentifiers)) makeWeirdIdentifier(body.name);
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
