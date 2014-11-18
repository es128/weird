module.exports = function genCharArray(ranges) {
	var newArray = new Array(65535);
	for (var i=0; i < ranges.length; i++) {
		if (ranges[i + 1] === '-') {
			for (
				var j = ranges[i].charCodeAt();
				j <= ranges[i+2].charCodeAt();
				j++
			) {
				newArray[j] = String.fromCharCode(j);
			}
			i += 2;
		} else {
			newArray[ranges[i].charCodeAt()] = ranges[i];
		}
	}
	return newArray;
};
