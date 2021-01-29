![](https://i.imgur.com/uVN8IP9.png)

<br>

# SuperSpeller
A Javascript library from Zayie to spell correct your sentences using dozens of ngram/frequency dictionaries from Pluue, Google, Oxford and more.

## Installation
To use Speller, you'll need to install via source or using a package manager like [NPM](https://npmjs.com), Github NPM, Apt or Yarn.

```
gh repo clone Zayie/SuperSpeller
git clone https://github.com/zayie/superspeller

npm install superspeller
apt-get install superspeller
yarn install superspeller
```

## Initalization

Once you've installed the library and sourced it in your code, just like this. (Use whatever variable you want.)

```javascript
const SuperSpeller = require('superspeller');
const speller = new SuperSpeller(maxEditDistance, prefixLength);

// Example

const SuperSpeller = require('superspeller');
const speller = new SuperSpeller(2, 7);
```

## Usage

First you need to add your dictionary to the system, to do so you can specify a file formated like the example below or manually add each word sepretally.

```javascript
await speller.loadDictionary(file, termIndex, countIndex, keyValueSeperator);

// Example

await speller.loadDictionary("./my_dict.txt", 0, 1, " ");
```

Then once the dictionary is all loaded up, you can use it by sending a request to the function `symSpell.lookupCompound()` like so.

```javascript
speller.lookupCompound(string);
// or
speller.lookupCompound(string, editDistance);
// or
speller.lookupCompound(string, editDistance, { ignoreNonWords, transferCasing});

// Example

speller.lookupCompound("Miy eXampull straneig.");

// Example Output

[
    {
        "term":"My example string.",
        "confidence": 0.57329911293
    }
];

```

And you've got a usable output ready for processing. :\)

## Footnotes

Improvements, controbutions, and editors are welcome! Email opensource@zayie.com for more information.