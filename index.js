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
	switch (body.type) {
    case 'Identifier':
		if (reserved.indexOf(body.name) < 0) {
			weirdIdentifiers[body.name] = body.name;
			body.name = 'elan';
		}
		return;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    	weirdAST(body.id);
		//if (body.id) weirdIdentifiers[body.id.name] = body.id.name;
		body.params.forEach(weirdAST);
		weirdAST(body.body);
    	return;
    case 'VariableDeclaration':
    	body.declarations.forEach(function(declaration) {
			weirdAST(declaration.id);
			weirdAST(declaration.init);
		});
    	return;
    case 'SwitchStatement':
		weirdAST(body.discriminant);
		body.cases.forEach(function(kase) {
			weirdAST(kase.test);
			kase.consequent.forEach(weirdAST);
		});
    	return;
    case 'TryStatement':
		body.block.body.forEach(weirdAST);
		body.handlers.forEach(function(handler) {
			weirdAST(handler.param);
			weirdAST(handler.body);
		});
		weirdAST(body.finalizer);
    	return;
    case 'ObjectExpression':
		body.properties.map(function(prop){
			return prop.value;
		}).forEach(weirdAST);
		return;
    case 'CallExpression':
    case 'NewExpression':
    	weirdAST(body.callee);
		body.arguments.forEach(weirdAST);
    	return;
    case 'UpdateExpression':
    case 'ReturnStatement':
    	return weirdAST(body.argument);
    case 'IfStatement':
    case 'ConditionalExpression':
		weirdAST(body.test);
		weirdAST(body.consequent);
		weirdAST(body.alternate);
		return;
    case 'MemberExpression':
    	weirdAST(body.object);
    	if (body.computed) weirdAST(body.property);
    	return;
    case 'AssignmentExpression':
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'ForInStatement':
		weirdAST(body.left);
		weirdAST(body.right);
		if (body.body) weirdAST(body.body);
    	return;
    case 'UnaryExpression': return weirdAST(body.argument);
    case 'ArrayExpression': return body.elements.forEach(weirdAST);
    case 'BlockStatement': return body.body.forEach(weirdAST);
    case 'ExpressionStatement': return weirdAST(body.expression);
    }
}


ast.program.body.forEach(weirdAST);

console.log(recast.print(ast).code);
console.log(weirdIdentifiers);
console.log(process.hrtime(startTime))
