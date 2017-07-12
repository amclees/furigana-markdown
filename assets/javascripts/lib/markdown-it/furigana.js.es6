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

const innerRegexString = '(?:[^\\u0000-\\u007F]|\\w)+';

let regexList = [];
let previousFuriganaForms = '';

function updateRegexList(furiganaForms) {
  previousFuriganaForms = furiganaForms;
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
      Sample built regex:
      /(^|[^\u4e00-\u9faf]|)([\u4e00-\u9faf]+)([\u3041-\u3095\u3099-\u309c\u3081-\u30fa\u30fc]*)【((?:[^【】\u4e00-\u9faf]|w)+)】/g
    */
    return new RegExp(
      `(^|[^${kanjiRange}]|)` +
      `([${kanjiRange}]+)` +
      `([${kanaWithAnnotations}]*)` +
      escapeForRegex(brackets[0]) +
      `((?:[^${escapeForRegex(brackets)}\\u0000-\\u007F]|\\w|[${furiganaSeperators}])+)` +
      escapeForRegex(brackets[1]),
      'g'
    );
  });
}

function addRubyTag(state, start, end, mainText, furiganaText, furiganaFallbackBrackets) {
  if (furiganaFallbackBrackets.length !== 2) {
    furiganaFallbackBrackets = '【】';
  }
  let token,
      oldStart = state.pos,
      oldEnd = state.posMax;

  state.pos = start;
  state.posMax = end;

  token = state.push('ruby_open', 'ruby', 1);
  token = state.push('text', '', 0);
  token.content = mainText;

  token = state.push('rp_open', 'rp', 1);
  token = state.push('text', '', 0);
  token.content = furiganaFallbackBrackets[0];
  token = state.push('rp_close', 'rp', -1);

  token = state.push('rt_open', 'rt', 1);

  token = state.push('text', '', 0);
  token.content = furiganaText;

  token = state.push('rt_open', 'rt', -1);

  token = state.push('rp_open', 'rp', 1);
  token = state.push('text', '', 0);
  token.content = furiganaFallbackBrackets[1];
  token = state.push('rp_close', 'rp', -1);


  token = state.push('ruby_close', 'ruby', -1);
  state.pos = oldStart;
  state.posMax = oldEnd;
  console.log(state);
}

function addFurigana(state, silent, options) {
  if (options.furiganaForms !== previousFuriganaForms) {
    updateRegexList(options.furiganaForms);
  }

  regexList.forEach(regex => {
    state.src.replace(regex, (match, wordText, furiganaText, offset, mainText) => {
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
}

export function setup(helper) {
  if (!helper.markdownIt) { return; }

  helper.registerOptions((opts, siteSettings) => {
    // Needed to allow disabling, enabled by default if not set
    opts.features.furigana = !!siteSettings.furigana;

    opts.furiganaForms = siteSettings.furigana_plugin_forms;
    opts.furiganaFallbackBrackets = siteSettings.furigana_fallback_brackets;
    opts.furiganaStrictMode = !!siteSettings.furigana_strict_mode;
    opts.furiganaAutoBracketSets = siteSettings.furigana_plugin_auto_bracket_sets;
    opts.furiganaPatternMatching = siteSettings.furigana_pattern_matching;
  });

  helper.whiteList([
    'ruby',
    'rt',
    'rp'
  ]);

  helper.registerPlugin((md) => {
    md.inline.ruler.push('furigana', (state, silent) => {
      if (!silent) addRubyTag(state, state.pos, state.posMax, 'test1', 'test2', '【】');
      state.pos = state.pos + 1;
      return true;
      //return addFurigana(state, silent, helper.getOptions());
    });
  });
}
