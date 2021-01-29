// =============================================================================
//
// • MODULE/PKG: SuperSpeller
// • COPYRIGHT: © Copyright Zayie Software, Inc. 2021
// • LICENSE: Licensed under the CC0-1.0 License (https://creativecommons.org/publicdomain/zero/1.0)
//
// =============================================================================

const Helpers = require('./helpers');

class Editor {
	constructor () {
		this.baseChar1Costs = []
		this.basePrevChar1Costs = []
	}

	compare(string1, string2, maxDistance) {
		return this.distance(string1, string2, maxDistance);
	}

	distance(string1 = null, string2 = null, maxDistance) {
		if (string1 === null || string2 === null) return Helpers.nullDistanceResults(string1, string2, maxDistance);
		if (maxDistance <= 0) return (string1 === string2) ? 0 : -1;
		maxDistance = Math.ceil(maxDistance);
		const iMaxDistance = (maxDistance <= Number.MAX_SAFE_INTEGER) ? maxDistance : Number.MAX_SAFE_INTEGER;
		if (string1.length > string2.length) {
			const t = string1;
			string1 = string2;
			string2 = t;
		}
		if (string2.length - string1.length > iMaxDistance) return -1;
		const { len1, len2, start } = Helpers.prefixSuffixPrep(string1, string2);
		if (len1 === 0) return (len2 <= iMaxDistance) ? len2 : -1;
		if (len2 > this.baseChar1Costs.length) {
			this.baseChar1Costs = new Array(len2);
			this.basePrevChar1Costs = new Array(len2);
		}
		if (iMaxDistance < len2) return this._distanceMax(string1, string2, len1, len2, start, iMaxDistance, this.baseChar1Costs, this.basePrevChar1Costs);
		return this._distance(string1, string2, len1, len2, start, this.baseChar1Costs, this.basePrevChar1Costs);
	}

	_distance(string1, string2, len1, len2, start, char1Costs, prevChar1Costs) {
		char1Costs = [];
		for (let j = 0; j < len2;) {
			char1Costs[j] = ++j;
		}
		let char1 = ' ';
		let currentCost = 0;
		for (let i = 0; i < len1; ++i) {
			const prevChar1 = char1;
			char1 = string1[start + i];
			let char2 = ' ';
			let aboveCharCost = i;
			let leftCharCost = i;
			let nextTransCost = 0;
			for (let j = 0; j < len2; ++j) {
				const thisTransCost = nextTransCost;
				nextTransCost = prevChar1Costs[j];
				currentCost = leftCharCost;
				prevChar1Costs[j] = leftCharCost;
				leftCharCost = char1Costs[j];
				const prevChar2 = char2;
				char2 = string2[start + j];
				if (char1 !== char2) {
					if (aboveCharCost < currentCost) currentCost = aboveCharCost;
					if (leftCharCost < currentCost) currentCost = leftCharCost;
					++currentCost;
					if (
						(i !== 0) && (j !== 0) &&
						(char1 === prevChar2) &&
						(prevChar1 === char2) &&
						(thisTransCost + 1 < currentCost)
					) {
						currentCost = thisTransCost + 1;
					}
				}
				char1Costs[j] = aboveCharCost = currentCost;
			}
		}
		return currentCost;
	}

	_distanceMax(string1, string2, len1, len2, start, maxDistance, char1Costs, prevChar1Costs) {
		char1Costs = [];
		for (let j = 0; j < len2; j++) {
			if (j < maxDistance) {
				char1Costs[j] = j + 1;
			} else {
				char1Costs[j] = maxDistance + 1;
			}
		}
		const lenDiff = len2 - len1;
		const jStartOffset = maxDistance - lenDiff;
		let jStart = 0;
		let jEnd = maxDistance;
		let char1 = ' ';
		let currentCost = 0;
		for (let i = 0; i < len1; ++i) {
			const prevChar1 = char1;
			char1 = string1[start + i];
			let char2 = ' ';
			let leftCharCost = i;
			let aboveCharCost = i;
			let nextTransCost = 0;
			jStart += (i > jStartOffset) ? 1 : 0;
			jEnd += (jEnd < len2) ? 1 : 0;
			for (let j = jStart; j < jEnd; ++j) {
				const thisTransCost = nextTransCost;
				nextTransCost = prevChar1Costs[j];
				currentCost = leftCharCost;
				prevChar1Costs[j] = leftCharCost;
				leftCharCost = char1Costs[j];
				const prevChar2 = char2;
				char2 = string2[start + j];
				if (char1 !== char2) {
					if (aboveCharCost < currentCost) currentCost = aboveCharCost;
					if (leftCharCost < currentCost) currentCost = leftCharCost;
					currentCost += 1;
					if (
						i !== 0 && j !== 0 &&
						char1 === prevChar2 &&
						prevChar1 === char2 &&
						thisTransCost + 1 < currentCost
					) {
						currentCost = thisTransCost + 1 ;
					}
				}
				aboveCharCost = currentCost;
				char1Costs[j] = currentCost;
			}
			if (char1Costs[i + lenDiff] > maxDistance) return -1;
		}
		return (currentCost <= maxDistance) ? currentCost : -1;
	}
}

module.exports = Editor;
