var chars = require('../identifier-characters')
var obj = {}
chars.dense.all.forEach(function (a, i) {
	obj[a] = {
		id: a.charCodeAt(),
		denseAllId: i,
		hex: a.charCodeAt().toString(16),
		tags: []
	}
})
require('fs').writeFile('charTags.json', JSON.stringify(obj))
