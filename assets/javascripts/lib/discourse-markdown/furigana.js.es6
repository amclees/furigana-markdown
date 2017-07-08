import { registerOption } from 'pretty-text/pretty-text';

registerOption((siteSettings, opts) => {
  opts.features.furigana = !!siteSettings.furigana_enabled;
  opts.furiganaForms = siteSettings.furigana_plugin_forms;
  opts.furiganaFallbackBrackets = siteSettings.furigana_fallback_brackets;
  opts.furiganaStrictMode = !!siteSettings.furigana_strict_mode;
  opts.furiganaAutoBracketSets = siteSettings.furigana_plugin_auto_bracket_sets;
  opts.furiganaPatternMatching = siteSettings.furigana_pattern_matching;
});

// This function escapes special characters for use in a regex constructor.
function escapeForRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function emptyStringFilter(block) {
  return block !== '';
}

const kanjiRange = '\\u4e00-\\u9faf';
const kanjiBlockRegex = new RegExp(`[${kanjiRange}]+`, 'g');
const nonKanjiBlockRegex = new RegExp(`[^${kanjiRange}]+`, 'g');
const kanaWithAnnotations = '\\u3041-\\u3095\\u3099-\\u309c\\u3081-\\u30fa\\u30fc';
const furiganaSeperators = '.．。・';
const seperatorRegex = new RegExp(`[${furiganaSeperators}]`, 'g');

const singleKanjiRegex = new RegExp(`^[${kanjiRange}]$`);
function isKanji(character) {
  return character.match(singleKanjiRegex);
}

let regexList = [];
let previousFuriganaForms = '';

function updateRegexList(furiganaForms) {
  previousFuriganaForms = furiganaForms;
  const innerRegexString = '(?:[^\\u0000-\\u007F]|\\w)+';
  let formArray = furiganaForms.split('|');
  if (formArray.length === 0) {
    formArray = ['[]:^:()'];
  }
  regexList = formArray.map(form => {
    let furiganaComponents = form.split(':');
    if (furiganaComponents.length !== 3) {
      furiganaComponents = ['[]', '^', '()'];
    }
    const mainBrackets = furiganaComponents[0];
    const seperator = furiganaComponents[1];
    const furiganaBrackets = furiganaComponents[2];
    return new RegExp(
      escapeForRegex(mainBrackets[0]) +
      '(' + innerRegexString + ')' +
      escapeForRegex(mainBrackets[1]) +
      escapeForRegex(seperator) +
      escapeForRegex(furiganaBrackets[0]) +
      '(' + innerRegexString + ')' +
      escapeForRegex(furiganaBrackets[1]),
      'g'
    );
  });
}

let autoRegexList = [];
let previousAutoBracketSets = '';

function updateAutoRegexList(autoBracketSets) {
  previousAutoBracketSets = autoBracketSets;
  autoRegexList = autoBracketSets.split('|').map(brackets => {
    /*
      Sample built regex (hiragana only):
      (^|[^\u4e00-\u9faf])([\u4e00-\u9faf]+)([\u3041-\u3095\u3099-\u309c]*)【([^\u4e00-\u9faf]+)】
    */
    return new RegExp(
      `(^|[^${escapeForRegex(brackets)}${kanjiRange}])` +
      `([${kanjiRange}]+)` +
      `([${kanaWithAnnotations}]*)` +
      escapeForRegex(brackets[0]) +
      `((?:[^${escapeForRegex(brackets)}${kanjiRange}]|\w)+)` +
      escapeForRegex(brackets[1]),
      'g'
    );
  });
}

let replacementTemplate = '';
let replacementBrackets = '';

function updateReplacementTemplate(furiganaFallbackBrackets) {
  if (furiganaFallbackBrackets.length !== 2) {
    furiganaFallbackBrackets = '【】';
  }
  replacementBrackets = furiganaFallbackBrackets;
  replacementTemplate = `<ruby>$1<rp>${furiganaFallbackBrackets[0]}</rp><rt>$2</rt><rp>${furiganaFallbackBrackets[1]}</rp></ruby>`;
}

updateReplacementTemplate('【】');

function addFurigana(text, options) {
  if (options.furiganaForms !== previousFuriganaForms) {
    updateRegexList(options.furiganaForms);
  }
  if (options.furiganaFallbackBrackets !== replacementBrackets) {
    updateReplacementTemplate(options.furiganaFallbackBrackets);
  }
  regexList.forEach(regex => {
    text = text.replace(regex, (match, wordText, furiganaText, offset, mainText) => {
      if (match.indexOf('\\') === -1 && mainText[offset - 1] !== '\\') {
        if ((!options.furiganaPatternMatching) || wordText.search(kanjiBlockRegex) === -1 || wordText[0].search(kanjiBlockRegex) === -1) {
          return replacementTemplate.replace('$1', wordText).replace('$2', furiganaText);
        } else {
          let originalFuriganaText = (' ' + furiganaText).slice(1);
          let nonKanji = wordText.split(kanjiBlockRegex).filter(emptyStringFilter);
          let kanji = wordText.split(nonKanjiBlockRegex).filter(emptyStringFilter);
          let replacementText = '';
          let lastUsedKanjiIndex = 0;
          if (nonKanji.length === 0) {
            return replacementTemplate.replace('$1', wordText).replace('$2', furiganaText);
          }

          nonKanji.forEach((currentNonKanji, index) => {
            if (furiganaText === undefined) {
              if (index < kanji.length) {
                replacementText += kanji[index];
              }

              replacementText += currentNonKanji;
              return;
            }
            let splitFurigana = furiganaText.split(new RegExp(escapeForRegex(currentNonKanji) + '(.*)')).filter(emptyStringFilter);

            lastUsedKanjiIndex = index;
            replacementText += replacementTemplate.replace('$1', kanji[index]).replace('$2', splitFurigana[0]);
            replacementText += currentNonKanji;

            furiganaText = splitFurigana[1];
          });
          if (furiganaText !== undefined && lastUsedKanjiIndex + 1 < kanji.length) {
            replacementText += replacementTemplate.replace('$1', kanji[lastUsedKanjiIndex + 1]).replace('$2', furiganaText);
          } else if (furiganaText !== undefined) {
            return replacementTemplate.replace('$1', wordText).replace('$2', originalFuriganaText);
          } else if (lastUsedKanjiIndex + 1 < kanji.length) {
            replacementText += kanji[lastUsedKanjiIndex + 1];
          }
          return replacementText;
        }
      } else {
        return match;
      }
    });
  });

  if (!options.furiganaStrictMode) {
    if (options.furiganaAutoBracketSets !== previousAutoBracketSets) {
      updateAutoRegexList(options.furiganaAutoBracketSets);
    }
    autoRegexList.forEach(regex => {
      text = text.replace(regex, (match, preWordTerminator, wordKanji, wordKanaSuffix, furiganaText, offset, mainText) => {
        if (match.indexOf('\\') === -1) {
          if (options.furiganaPatternMatching) {
            let rubies = [];

            let furigana = furiganaText;

            //put in if
            let stem = (' ' + wordKanaSuffix).slice(1);
            for (let i = furiganaText.length - 1; i >= 0; i--) {
              if (wordKanaSuffix.length === 0) {
                furigana = furiganaText.substring(0, i + 1);
                break;
              }
              if (furiganaText[i] !== wordKanaSuffix.slice(-1)) {
                furigana = furiganaText.substring(0, i + 1);
                break;
              }
              wordKanaSuffix = wordKanaSuffix.slice(0, -1);
            }

            if (furiganaSeperators.split('').reduce(
              (noSeperator, seperator) => {
                return noSeperator && (furigana.indexOf(seperator) === -1);
              },
              true
            )) {
              rubies = [replacementTemplate.replace('$1', wordKanji).replace('$2', furigana)];
            } else {
              let kanaParts = furigana.split(seperatorRegex);
              let kanji = wordKanji.split('');
              if (kanaParts.length !== kanji.length) {
                rubies = [replacementTemplate.replace('$1', wordKanji).replace('$2', furigana)];
              } else {
                for (let i = 0; i < wordKanji.length; i++) {
                  rubies.push(replacementTemplate.replace('$1', wordKanji).replace('$2', kanaParts[i]));
                }
              }
            }

            return preWordTerminator + rubies.join('') + stem;
          } else {
            return preWordTerminator + replacementTemplate.replace('$1', wordKanji).replace('$2', furiganaText) + wordKanaSuffix;
          }
        } else {
          return match;
        }
      });
    });
  }
  return text;
}

function handleEscapedSpecialBrackets(text) {
  // By default 【 and 】 cannot be escaped in markdown, this will remove backslashes from in front of them to give that effect.
  return text.replace(/\\([【】])/g, '$1');
}

export function setup(helper) {
  helper.whiteList([
    'ruby',
    'rt',
    'rp'
  ]);

  helper.addPreProcessor(text => {
    return handleEscapedSpecialBrackets(addFurigana(text, helper.getOptions()));
  });
}
