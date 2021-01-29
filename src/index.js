// =============================================================================
//
// • MODULE/PKG: SuperSpeller
// • COPYRIGHT: © Copyright Zayie Software, Inc. 2021
// • LICENSE: Licensed under the CC0-1.0 License (https://creativecommons.org/publicdomain/zero/1.0)
//
// =============================================================================

const fs = require('fs');
const readline = require('readline');
const Editor = require('./editor');
const Helpers = require('./helpers');

class SuggestItem {
	constructor (term = '', distance = 0, count = 0) {
		this.term = term;
		this.distance = distance;
		this.count = count;
	}
	compareTo (other) {
		if (this.distance === other.distance) return this.count - other.count;
		return other.distance - this.distance;
	}
}

class SymSpell {
	static get N () {
		return 1024908267229;
	}

	static get Verbosity () {
		return {
			TOP: 0,
			CLOSEST: 1,
			ALL: 2
		};
	}

	constructor (
		maxDictionaryEditDistance = 2,
		prefixLength = 7,
		countThreshold = 1
	){
		this.maxDictionaryEditDistance = maxDictionaryEditDistance;
		this.prefixLength = prefixLength;
		this.countThreshold = countThreshold;
		this.words = new Map();
		this.maxDictionaryWordLength = 0;
		this.deletes = new Map();
		this.belowThresholdWords = new Map();
		this.bigrams = new Map();
		this.bigramCountMin = Number.MAX_SAFE_INTEGER;
	}

	createDictionaryEntry(key, count) {
		if (count <= 0) {
			if (this.countThreshold > 0) return false;
			count = 0;
		}
		let countPrevious = -1;
		if (this.countThreshold > 1 && this.belowThresholdWords.has(key)) {
			countPrevious = this.belowThresholdWords.get(key);
			count = (Number.MAX_SAFE_INTEGER - countPrevious > count) ? countPrevious + count : Number.MAX_SAFE_INTEGER;
			if (count >= this.countThreshold) {
				this.belowThresholdWords.delete(key)
			} else {
				this.belowThresholdWords.set(key, count);
				return false;
			}
		} else if (this.words.has(key)) {
			countPrevious = this.words.get(key);
			count = (Number.MAX_SAFE_INTEGER - countPrevious > count) ? countPrevious + count : Number.MAX_SAFE_INTEGER;
			this.words.set(key, count);
			return false;
		} else if (count < this.countThreshold) {
			this.belowThresholdWords.set(key, count);
			return false;
		}
		this.words.set(key, count);
		if (key.length > this.maxDictionaryWordLength) this.maxDictionaryWordLength = key.length;
		const edits = this.editsPrefix(key);
		edits.forEach((val, del) => {
			if (!this.deletes.has(del)) this.deletes.set(del, []);
			this.deletes.get(del).push(key);
		});
		return true;
	}

	async loadDictionary(dictFile, termIndex, countIndex, separator = ' ') {
		const lines = readline.createInterface({
			input: fs.createReadStream(dictFile, 'utf8'),
			output: process.stdout,
			terminal: false
		});
		for await (const line of lines) {
			const lineParts = line.trim().split(separator)
			if (lineParts.length >= 2) {
				const key = lineParts[termIndex];
				const count = parseInt(lineParts[countIndex], 10);
				this.createDictionaryEntry(key, count);
			}
		}
		return true;
	}

	async createDictionary(dictFile) {
		const lines = readline.createInterface({
			input: fs.createReadStream(dictFile, 'utf8'),
			output: process.stdout,
			terminal: false
		});
		for await (const line of lines) {
			this.parseWords(line).forEach((key) => {
				this.createDictionaryEntry(key, 1)
			});
		}
		return true;
	}

	lookup (input, verbosity, maxEditDistance = null, { includeUnknown, ignoreToken, transferCasing } = {}) {
		if (maxEditDistance === null) maxEditDistance = this.maxDictionaryEditDistance;
		let suggestions = [];
		const inputLen = input.length;
		let originalPhrase = '';
		if (transferCasing) {
			originalPhrase = input;
			input = input.toLowerCase();
		}
		const earlyExit = () => {
			if (includeUnknown && suggestions.length === 0) {
				suggestions.push(new SuggestItem(input, maxEditDistance + 1, 0));
			}
			return suggestions;
		}
		if (inputLen - maxEditDistance > this.maxDictionaryWordLength) return earlyExit()
		let suggestionCount = 0;
		if (this.words.has(input)) {
			suggestionCount = this.words.get(input)
			suggestions.push(new SuggestItem(input, 0, suggestionCount))
			if (verbosity !== SymSpell.Verbosity.ALL) return earlyExit();
		}
		if (ignoreToken && input.match(ignoreToken)) {
			suggestionCount = 1;
			suggestions.push(new SuggestItem(input, 0, suggestionCount));
			if (verbosity !== SymSpell.Verbosity.ALL) return earlyExit();
		}
		if (maxEditDistance === 0) return earlyExit();
		const consideredDeletes = new Set();
		const consideredSuggestions = new Set();
		consideredSuggestions.add(input);
		let maxEditDistance2 = maxEditDistance;
		let candidatePointer = 0;
		const candidates = [];
		let inputPrefixLen = inputLen;
		if (inputPrefixLen > this.prefixLength) {
			inputPrefixLen = this.prefixLength;
			candidates.push(input.substr(0, inputPrefixLen));
		} else {
			candidates.push(input);
		}
		const distanceComparer = new Editor();
		while (candidatePointer < candidates.length) {
			const candidate = candidates[candidatePointer];
			candidatePointer += 1;
			const candidateLen = candidate.length;
			const lengthDiff = inputPrefixLen - candidateLen;
			if (lengthDiff > maxEditDistance2) {
				if (verbosity === SymSpell.Verbosity.ALL) continue;
				break;
			}
			if (this.deletes.has(candidate)) {
				const dictSuggestions = this.deletes.get(candidate);
				for (let i = 0; i < dictSuggestions.length; i++) {
					const suggestion = dictSuggestions[i];
					if (suggestion === input) {
						continue;
					}
					const suggestionLen = suggestion.length;
					if (
						Math.abs(suggestionLen - inputLen) > maxEditDistance2 ||
						suggestionLen < candidateLen ||
						(suggestionLen === candidateLen && suggestion !== candidate)
					) continue;
					const suggPrefixLen = Math.min(suggestionLen, this.prefixLength);
					if (suggPrefixLen > inputPrefixLen && (suggPrefixLen - candidateLen) > maxEditDistance2) continue;
					let distance = 0;
					let min = 0;
					if (candidateLen === 0) {
						distance = Math.max(inputLen, suggestionLen);
						if (distance > maxEditDistance2 || consideredSuggestions.has(suggestion)) continue;
					} else if (suggestionLen === 1) {
						distance = (input.indexOf(suggestion[0]) < 0) ? inputLen : inputLen - 1;
						if (distance > maxEditDistance2 || consideredSuggestions.has(suggestion)) continue;
					} else {
						if (this.prefixLength - maxEditDistance === candidateLen) min = Math.min(inputLen, suggestionLen) - this.prefixLength;
						if (
							this.prefixLength - maxEditDistance === candidateLen &&
							((
								min > 1 &&
								input.substr(inputLen + 1 - min) !== suggestion.substr(suggestionLen + 1 - min)
							) ||
							(
								min > 0 &&
								input[inputLen - min] !== suggestion[suggestionLen - min] &&
								(
									input[inputLen - min - 1] !== suggestion[suggestionLen - min] ||
									input[inputLen - min] !== suggestion[suggestionLen - min - 1]
								)
							))
						) {
							continue;
						} else {
							if (
								(
									verbosity !== SymSpell.Verbosity.ALL &&
									!this.deleteInSuggestionPrefix(candidate, candidateLen, suggestion, suggestionLen)
								) || consideredSuggestions.has(suggestion)
							) {
								continue;
							}
							consideredSuggestions.add(suggestion);
							distance = distanceComparer.compare(input, suggestion, maxEditDistance2);
							if (distance < 0) continue;
						}
					}
					if (distance <= maxEditDistance2) {
						const suggestionCount = this.words.get(suggestion);
						const si = new SuggestItem(suggestion, distance, suggestionCount);
						if (suggestions.length > 0) {
							switch (verbosity) {
							case SymSpell.Verbosity.CLOSEST: {
								if (distance < maxEditDistance2) suggestions = [];
								break;
							}
							case SymSpell.Verbosity.TOP: {
								if (distance < maxEditDistance2 || suggestionCount > suggestions[0].count) {
									maxEditDistance2 = distance;
									suggestions[0] = si;
								}
								continue;
							}
							}
						}
						if (verbosity !== SymSpell.Verbosity.ALL) maxEditDistance2 = distance;
						suggestions.push(si);
					}
				}
			}

			if (lengthDiff < maxEditDistance && candidateLen <= this.prefixLength) {
				if (verbosity !== SymSpell.Verbosity.ALL && lengthDiff >= maxEditDistance2) continue;
				for (let i = 0; i < candidateLen; i++) {
					const del = candidate.slice(0, i) + candidate.slice(i + 1, candidate.length);
					if (!consideredDeletes.has(del)) {
						consideredDeletes.add(del);
						candidates.push(del);
					}
				}
			}
		}
		if (suggestions.length > 1) suggestions.sort((a, b) => a.compareTo(b)).reverse();
		if (transferCasing) {
			suggestions = suggestions.map((s) => {
				return new SuggestItem(Helpers.transferCasingSimilar(originalPhrase, s.term), s.distance, s.count);
			});
		}
		return earlyExit();
	}

	deleteInSuggestionPrefix(del, deleteLen, suggestion, suggestionLen) {
		if (deleteLen === 0) return true;
		if (this.prefixLength < suggestionLen) suggestionLen = this.prefixLength;
		let j = 0;
		for (let i = 0; i < deleteLen; i++) {
			const delChar = del[i];
			while (j < suggestionLen && delChar !== suggestion[j]) {
				j++;
			}
			if (j === suggestionLen) {
				return false;
			}
		}
		return true;
	}

	parseWords(text) {
		const matches = text.toLowerCase().matchAll(/(([^\W_]|['’])+)/g);
		return Array.from(matches, (match) => match[0]);
	}

	edits(word, edits, deleteWords) {
		edits++;
		if (word.length > 1) {
			for (let i = 0; i < word.length; i++) {
				const del = word.slice(0, i) + word.slice(i + 1, word.length);
				if (!deleteWords.has(del)) {
					deleteWords.add(del);
					if (edits < this.maxDictionaryEditDistance) this.edits(del, edits, deleteWords);
				}
			}
		}
		return deleteWords;
	}

	editsPrefix(key) {
		const hashSet = new Set();
		if (key.length <= this.maxDictionaryEditDistance) hashSet.add('');
		if (key.length > this.prefixLength) key = key.substr(0, this.prefixLength);
		hashSet.add(key);
		return this.edits(key, 0, hashSet);
	}

	lookupCompound(input, maxEditDistance = null, { ignoreNonWords, transferCasing } = {}) {
		if (maxEditDistance === null) maxEditDistance = this.maxDictionaryEditDistance;
		const termList1 = Helpers.parseWordsCase(input);
		let termList2 = [];
		if (ignoreNonWords) termList2 = Helpers.parseWordsCase(input, true);
		let suggestions = [];
		const suggestionParts = [];
		const distanceComparer = new Editor();
		let lastCombi = false;
		for (let i = 0; i < termList1.length; i++) {
			if (ignoreNonWords) {
				if (parseInt(termList1[i], 10)) {
					suggestionParts.push(new SuggestItem(termList1[i], 0, 0));
					continue;
				}
				if (Helpers.isAcronym(termList2[i])) {
					suggestionParts.push(new SuggestItem(termList2[i], 0, 0));
					continue;
				}
			}
			suggestions = this.lookup(termList1[i], SymSpell.Verbosity.TOP, maxEditDistance);
			if (i > 0 && !lastCombi) {
				const suggestionsCombi = this.lookup(termList1[i - 1] + termList1[i], SymSpell.Verbosity.TOP, maxEditDistance);
				if (suggestionsCombi.length > 0) {
					const best1 = suggestionParts[suggestionParts.length - 1];
					let best2 = new SuggestItem();
					if (suggestions.length > 0) {
						best2 = suggestions[0];
					} else {
						best2.term = termList1[i];
						best2.distance = maxEditDistance + 1;
						best2.count = 10 / Math.pow(10, best2.term.length);
					}
					const distance1 = best1.distance + best2.distance;
					if (
						distance1 >= 0 &&
						(
							suggestionsCombi[0].distance + 1 < distance1 ||
							(
								suggestionsCombi[0].distance + 1 === distance1 &&
								suggestionsCombi[0].count > best1.count / SymSpell.N * best2.count
							)
						)
					) {
						suggestionsCombi[0].distance++;
						suggestionParts[suggestionParts.length - 1] = suggestionsCombi[0];
						lastCombi = true;
						continue;
					}
				}
			}
			lastCombi = false;
			if (suggestions.length > 0 && (suggestions[0].distance === 0 || termList1[i].length === 1)) {
				suggestionParts.push(suggestions[0]);
			} else {
				let suggestionSplitBest = null;
				if (suggestions.length > 0) suggestionSplitBest = suggestions[0];
				if (termList1[i].length > 1) {
					for (let j = 1; j < termList1[i].length; j++) {
						const part1 = termList1[i].substr(0, j);
						const part2 = termList1[i].substr(j);
						const suggestionSplit = new SuggestItem();
						const suggestions1 = this.lookup(part1, SymSpell.Verbosity.TOP, maxEditDistance);
						if (suggestions1.length > 0) {
							const suggestions2 = this.lookup(part2, SymSpell.Verbosity.TOP, maxEditDistance);
							if (suggestions2.length > 0) {
								suggestionSplit.term = suggestions1[0].term + ' ' + suggestions2[0].term;
								let distance2 = distanceComparer.compare(termList1[i], suggestionSplit.term, maxEditDistance);
								if (distance2 < 0) distance2 = maxEditDistance + 1;
								if (suggestionSplitBest !== null) {
									if (distance2 > suggestionSplitBest.distance) continue;
									if (distance2 < suggestionSplitBest.distance) suggestionSplitBest = null;
								}
								suggestionSplit.distance = distance2;
								if (this.bigrams.has(suggestionSplit.term)) {
									const bigramCount = this.bigrams.get(suggestionSplit.term);
									suggestionSplit.count = bigramCount;
									if (suggestions.length > 0) {
										if ((suggestions1[0].term + suggestions2[0].term === termList1[i])) {
											suggestionSplit.count = Math.max(suggestionSplit.count, suggestions[0].count + 2);
										} else if (suggestions1[0].term === suggestions[0].term || suggestions2[0].term === suggestions[0].term) {
											suggestionSplit.count = Math.max(suggestionSplit.count, suggestions[0].count + 1);
										}
									} else if (suggestions1[0].term + suggestions2[0].term === termList1[i]) suggestionSplit.count = Math.max(suggestionSplit.count, Math.max(suggestions1[0].count, suggestions2[0].count) + 2);
								} else suggestionSplit.count = Math.floor(Math.min(this.bigramCountMin, suggestions1[0].count / SymSpell.N * suggestions2[0].count));
								if (suggestionSplitBest === null || suggestionSplit.count > suggestionSplitBest.count) suggestionSplitBest = suggestionSplit;
							}
						}
					}
					if (suggestionSplitBest !== null) {
						suggestionParts.push(suggestionSplitBest);
					} else {
						const si = new SuggestItem();
						si.term = termList1[i];
						si.count = Math.floor(10 / Math.pow(10, si.term.length));
						si.distance = maxEditDistance + 1;
						suggestionParts.push(si);
					}
				} else {
					const si = new SuggestItem();
					si.term = termList1[i];
					si.count = Math.floor(10 / Math.pow(10, si.term.length));
					si.distance = maxEditDistance + 1;
					suggestionParts.push(si);
				}
			}
		}
		const suggestion = new SuggestItem();
		let count = SymSpell.N;
		let s = '';
		suggestionParts.forEach((si) => {
			s += si.term + ' ';
			count *= si.count / SymSpell.N;
		});
		suggestion.count = Math.floor(count);
		suggestion.term = s.trimEnd();
		if (transferCasing) suggestion.term = Helpers.transferCasingSimilar(input, suggestion.term);
		suggestion.distance = distanceComparer.compare(input, suggestion.term, Number.MAX_SAFE_INTEGER);
		const suggestionsLine = [];
		suggestionsLine.push(suggestion);
		return suggestionsLine;
	}

	wordSegmentation(input, { maxEditDistance = null, maxSegmentationWordLength = null, ignoreToken } = {}) {
		if (maxEditDistance === null) maxEditDistance = this.maxDictionaryEditDistance;
		if (maxSegmentationWordLength === null) maxSegmentationWordLength = this.maxDictionaryWordLength;
		const arraySize = Math.min(maxSegmentationWordLength, input.length);
		const compositions = new Array(arraySize);
		let circularIndex = -1;
		for (let j = 0; j < input.length; j++) {
			const imax = Math.min(input.length - j, maxSegmentationWordLength);
			for (let i = 1; i <= imax; i++) {
				let part = input.substr(j, i);
				let separatorLength = 0;
				let topEd = 0;
				let topProbabilityLog = 0;
				let topResult = '';
				if (part[0].match(/\s/)) {
					part = part.substr(1);
				} else {
					separatorLength = 1;
				}
				topEd += part.length;
				part = part.replace(/\s+/g, '');
				topEd -= part.length;
				const results = this.lookup(part, SymSpell.Verbosity.TOP, maxEditDistance, { ignoreToken });
				if (results.length > 0) {
					topResult = results[0].term;
					topEd += results[0].distance;
					topProbabilityLog = Math.log10(results[0].count / SymSpell.N);
				} else {
					topResult = part;
					topEd += part.length;
					topProbabilityLog = Math.log10(10.0 / (SymSpell.N / Math.pow(10.0, part.length)));
				}
				const destinationIndex = (i + circularIndex) % arraySize;
				if (j === 0) {
					compositions[destinationIndex] = { 
						segmentedString: part,
						correctedString: topResult,
						distanceSum: topEd,
						probabilityLogSum: topProbabilityLog
					};
				}
				else if ((i === maxSegmentationWordLength) ||
                    (((compositions[circularIndex].distanceSum + topEd === compositions[destinationIndex].distanceSum) || (compositions[circularIndex].distanceSum + separatorLength + topEd === compositions[destinationIndex].distanceSum)) && (compositions[destinationIndex].probabilityLogSum < compositions[circularIndex].probabilityLogSum + topProbabilityLog)) ||
                    (compositions[circularIndex].distanceSum + separatorLength + topEd < compositions[destinationIndex].distanceSum)) {
					compositions[destinationIndex] = {
						segmentedString: (compositions[circularIndex].segmentedString || '') + ' ' + part,
						correctedString: (compositions[circularIndex].correctedString || '') + ' ' + topResult,
						distanceSum: (compositions[circularIndex].distanceSum || 0) + separatorLength + topEd,
						probabilityLogSum: (compositions[circularIndex].probabilityLogSum || 0) + topProbabilityLog
					}
				}
			}
			circularIndex += 1;
			if (circularIndex === arraySize) circularIndex = 0
		}
		return compositions[circularIndex];
	}
}

module.exports = SymSpell;