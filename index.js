'use strict';

var recast = require('recast');
var globals = require('globals');
var shuffle = require('knuth-shuffle').knuthShuffle;

var genCharArray = require('./generate-character-array');
var chars = require('./identifier-characters');
var charSets = require('./char-sets');
var charMaps = require('./char-maps');

function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function mapList(arr, id) {
	if (!Array.isArray(arr)) return;
	arr.forEach(function(word) { this[word] = id });
}

function Weird(options) {
	this.options = options || {};
	var reserved = {arguments: {value: 4, enumerable: true}};
	var globalEnvs = ['builtin'];
	var env = options.env;
	if (env) {
		if (!Array.isArray(options.env)) env = env.split(/[,\s]+/);
		globalEnvs.concat(env);
	}
	globalEnvs.forEach(function(group) {
		if (!globals[group]) return;
		Object.keys(globals[group]).forEach(function(global) {
			reserved[global] = {value: 1, enumerable: true}; // common globals
		});
	});
	this.reserved = Object.create(null, reserved);

	var processReserved = mapList.bind(this.reserved);
	processReserved(options.globals, 3); // user-provided globals
	processReserved(options.unreserved, 0); // user-provided unreserved
	processReserved(options.reserved, 4); // user-provided reserved

	this.identifiers = Object.create(null);
	this.identifiersInv = Object.create(null);
	return this;
}

Weird.prototype.makeIdentifier = function(name) {
	var newIdentifier;
	var length = name.length;
	var charsStart = chars.sparse.start;
	var charsAll = chars.sparse.all;
	var opts = this.options;
	if (opts.map && charMaps[opts.map]) {
		var mapper = charMaps[opts.map];
		newIdentifier = (mapper.fn ? mapper.fn.apply(name) : name)
			.split('').map(function(a, i) {
				if (!mapper[a]) return a;
				var map = mapper[a].split('').filter(function(c) {
					return c.charCodeAt() in (i ? charsAll : charsStart);
				});
				return randPick(map) || a;
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
		while (!newIdentifier || newIdentifier in this.identifiersInv) {
			var i = Math.floor(Math.random() * (allSet.length - length));
			newIdentifier = randPick(startSet) +
				allSet.slice(i, i + length - 1).join('');
		}
	}
	this.identifiers[name] = newIdentifier;
	this.identifiersInv[newIdentifier] = name;
};

Weird.prototype.processAST = function(body) {
	if (!body || !body.type) return;
	var reserved = this.reserved;
	var opts = this.options;
	var resCode = reserved[body.name];
	var canChange = !resCode || (opts.aliasGlobals && resCode < 4);
	if (body.type === 'Identifier' && canChange) {
		if (!(body.name in this.identifiers)) this.makeIdentifier(body.name);
		body.name = this.identifiers[body.name];
	} else {
		var hasIdentifier = !body.computed || body.property.type === 'Literal';
		if (body.type === 'MemberExpression' && hasIdentifier) {
			var object = body.object.name;
			if (object === 'window' || object === 'global') {
				var prop = body.property[body.computed ? 'value' : 'name'];
				if (!(prop in reserved) && !this.identifiers[prop]) {
					reserved[prop] = 2; // global bindings detected from source
				}
			}
		}
		Object.keys(body).forEach(function(key) {
			if (key === 'key' || key === 'property' && !body.computed) return;
			var obj = body[key];
			if (obj && obj.type) this.processAST(obj);
			else if (Array.isArray(obj)) obj.forEach(this.processAST, this);
		}, this);
	}
};

Weird.prototype.aliasGlobals = function(ast) {
	var b = recast.types.builders;
	var block = ast.program.body;
	var position = 0;

	// ensure 'use strict' stays on top
	var topExpr = block[0].type.expression;
	if (topExpr && topExpr.value === 'use strict') {
		position = 1;
	}

	// if entire script is an iife, keep it that way by wrapping in a new one
	var nextExpr = block[position].expression;
	if (block.length === position + 1 && nextExpr && nextExpr.type === 'CallExpression') {
		var newBlock = b.blockStatement([block[position]]);
		block[position] = b.expressionStatement(
			b.callExpression(b.functionExpression(null, [], newBlock), [])
		);
		block = newBlock.body;
		position = 0;
	}

	block.splice(position, 0, b.variableDeclaration('var',
		Object.keys(this.identifiers).filter(function(id) {
			return this.reserved[id] < 4;
		}, this).map(function(id) {
			return b.variableDeclarator(
				b.identifier(this.identifiers[id]),
				b.identifier(id)
			);
		}, this)
	));
};

Weird.prototype.processCode = function(code) {
	code += ''; // coerce to string
	var shebang, sbr = /^\#\![^\n]+/g;
	if (shebang = code.match(sbr)) code = code.replace(sbr, '');
	var ast = recast.parse(code, this.options);
	ast.program.body.forEach(this.processAST, this);
	if (this.options.aliasGlobals) this.aliasGlobals(ast);
	var result = recast.print(ast, this.options);
	if (shebang) result.code = shebang[0] + result.code;
	return result;
};

module.exports = function(code, options) {
	return (new Weird(options)).processCode(code);
};

module.exports.Processor = Weird;
