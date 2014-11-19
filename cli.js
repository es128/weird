#!/usr/bin/env node
var weird = require('./');
var fs = require('fs');

var code = '';
if (process.argv.length < 3) {
	process.stdin
	.on('readable', function() { code += process.stdin.read(); })
	.on('end', weirdify)
	.setEncoding('utf8');
} else {
	fs.readFile(process.argv[2], function(err, data) {
		if (err) throw err;
		code += data;
		weirdify();
	});
}

function weirdify() {
	process.stdout.write(weird(code).code);
}
