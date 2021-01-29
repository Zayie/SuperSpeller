// =============================================================================
//
// • MODULE/PKG: SuperSpeller
// • COPYRIGHT: © Copyright Zayie Software, Inc. 2021
// • LICENSE: Licensed under the CC0-1.0 License (https://creativecommons.org/publicdomain/zero/1.0)
//
// =============================================================================

const difflib = require('difflib');
const itertools = require('iter-tools');
const { zip, zipLongest } = itertools;

const isAcronym = (word) => {
	return word.match(/\b[A-Z0-9]{2,}\b/);
}

const parseWordsCase = (phrase, preserveCase) => {
	if (!preserveCase) phrase = phrase.toLowerCase();
	return Array.from(phrase.matchAll(/([^\W_]+['’]*[^\W_]*)/g), (m) => m[0]);
}

const transferCasingMatching = (textWithCasing, textWithoutCasing) => {
	return Array.from(zip(textWithCasing, textWithoutCasing)).map(([x, y]) => {
		return x === x.toUpperCase() ? y.toUpperCase() : y.toLowerCase();
	}).join('');
}

const transferCasingSimilar = (textWithCasing, textWithoutCasing) => {
	const _sm = new difflib.SequenceMatcher(null, textWithCasing.toLowerCase(), textWithoutCasing);
	let c = '';
	_sm.getOpcodes().forEach(([tag, i1, i2, j1, j2]) => {
		if (tag === 'insert') {
			if (i1 === 0 || textWithCasing[i1 - 1] === ' ') {
				if (textWithCasing[i1] && textWithCasing[i1].toUpperCase() === textWithCasing[i1]) {
					c += textWithoutCasing.slice(j1, j2).toUpperCase();
				} else c += textWithoutCasing.slice(j1, j2).toLowerCase();
			} else {
				if (textWithCasing[i1 - 1].toUpperCase() === textWithCasing[i1 - 1]) {
					c += textWithoutCasing.slice(j1, j2).toUpperCase();
				} else c += textWithoutCasing.slice(j1, j2).toLowerCase();
			}
		} else if (tag === 'equal') {
			c += textWithCasing.slice(i1, i2);
		} else if (tag === 'replace') {
			const _withCasing = textWithCasing.slice(i1, i2)
			const _withoutCasing = textWithoutCasing.slice(j1, j2)
			if (_withCasing.length === _withoutCasing.length) {
				c += transferCasingMatching(_withCasing, _withoutCasing);
			} else {
				let _last = 'lower';
				for (const [w, wo] of zipLongest(_withCasing, _withoutCasing)) {
					if (w && wo) {
						if (w === w.toUpperCase()) {
							c += wo.toUpperCase();
							_last = 'upper';
						} else {
							c += wo.toLowerCase();
							_last = 'lower';
						}
					} else if (!w && wo) {
						c += _last === 'upper' ? wo.toUpperCase() : wo.toLowerCase();
					}
				}
			}
		}
	})
	return c;
}

const nullDistanceResults = (string1, string2, maxDistance) => {
	if (string1 === null) return string2 === null ? 0 : (string2.length <= maxDistance) ? string2.length : -1;
	return string1.length <= maxDistance ? string1.length : -1;
}

const prefixSuffixPrep = (string1, string2) => {
	let len2 = string2.length;
	let len1 = string1.length;
	while (len1 !== 0 && string1[len1 - 1] === string2[len2 - 1]) {
		len1 = len1 - 1; len2 = len2 - 1;
	}
	let start = 0;
	while (start !== len1 && string1[start] === string2[start]) {
		start++;
	}
	if (start !== 0) {
		len2 -= start;
		len1 -= start;
	}
	return { len1, len2, start };
}

module.exports = {
	isAcronym,
	parseWordsCase,
	transferCasingMatching,
	transferCasingSimilar,
	nullDistanceResults,
	prefixSuffixPrep
};