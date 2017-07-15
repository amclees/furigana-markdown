function addRubyTag(state, mainText, rubyText, fallbackOpening, fallbackClosing) {
  let token;

  token = state.push('ruby_open', 'ruby', 1);
  token = state.push('text', '', 0);
  token.content = mainText;

  token = state.push('rp_open', 'rp', 1);
  token = state.push('text', '', 0);
  token.content = fallbackOpening;
  token = state.push('rp_close', 'rp', -1);

  token = state.push('rt_open', 'rt', 1);

  token = state.push('text', '', 0);
  token.content = rubyText;

  token = state.push('rt_open', 'rt', -1);

  token = state.push('rp_open', 'rp', 1);
  token = state.push('text', '', 0);
  token.content = fallbackClosing;
  token = state.push('rp_close', 'rp', -1);


  token = state.push('ruby_close', 'ruby', -1);
}

function escapeForRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function emptyStringFilter(block) {
  return block !== '';
}

const kanjiRange = '\\u4e00-\\u9faf';
const kanjiBlockRegex = new RegExp(`[${kanjiRange}]+`, 'g');
const nonKanjiBlockRegex = new RegExp(`[^${kanjiRange}]+`, 'g');
// Allows spaces, full and not full width.
let furiganaSeperators = '';
let seperatorRegex = /[\.． 　。・]/g;

// Returns true if seperators were created
function createSeperatedRubyTags(state, mainText, rubyText, fallbackOpening, fallbackClosing) {
  if (!seperatorRegex.test(rubyText)) { return false; }

  let mainChars = mainText.split('');
  let rubyGroups = rubyText.split(seperatorRegex);

  if (mainChars.length !== rubyGroups.length) { return false; }

  for (let i = 0; i < mainChars.length; i++) {
    addRubyTag(state, mainChars[i], rubyGroups[i], fallbackOpening, fallbackClosing);
  }
  return true;
}

// Returns true if pattern matching was successful
function patternMatchText(state, mainText, rubyText, fallbackOpening, fallbackClosing) {
  // お and ご are very common prefixes, this allows them inside pattern matching.
  const firstChar = mainText.charAt(0),
        firstIsHonorific = firstChar === 'お' || firstChar === 'ご';
  let stateChanges = [];

  // No kanji or honorific start
  if (!kanjiBlockRegex.test(firstChar) && !firstIsHonorific) { return false; }

  // Ruby text doesn't have the honorific, quit since main text doesn't start with kanji
  if (firstIsHonorific && firstChar !== rubyText.charAt(0)) { return false; }

  if (firstIsHonorific) {
    mainText = mainText.slice(1);
    rubyText = rubyText.slice(1);
    stateChanges.push(() => {
      token = state.push('text', '', 0);
      token.content = firstChar;
    });
  }

  let nonKanji = mainText.split(kanjiBlockRegex).filter(emptyStringFilter);
  if (nonKanji.length === 0) { return false; }

  let kanji = mainText.split(nonKanjiBlockRegex).filter(emptyStringFilter);
  if (kanji.length === 0) { return false; }

  let token,
      copiedRubyText = (' ' + rubyText).slice(1),
      lastUsedKanjiIndex = 0;

  nonKanji.forEach((currentNonKanji, index) => {
    if (copiedRubyText === undefined) {
      if (index < kanji.length) {
        lastUsedKanjiIndex = index;
        stateChanges.push(() => {
          token = state.push('text', '', 0);
          token.content = kanji[index];
        });
      }

      let currentNonKanjiCopy = (' ' + currentNonKanji).slice(1);
      stateChanges.push(() => {
        token = state.push('text', '', 0);
        token.content = currentNonKanjiCopy;
      });
      return;
    }
    let splitFurigana = copiedRubyText.split(new RegExp(escapeForRegex(currentNonKanji) + '(.*)')).filter(emptyStringFilter);

    lastUsedKanjiIndex = index;

    let indexCopy = index;
    stateChanges.push(() => {
      addRubyTag(state, kanji[indexCopy], splitFurigana[0], fallbackOpening, fallbackClosing);
    });

    let currentNonKanjiCopy = (' ' + currentNonKanji).slice(1);
    stateChanges.push(() => {
      token = state.push('text', '', 0);
      token.content = currentNonKanjiCopy;
    });

    copiedRubyText = splitFurigana[1];
  });
  if (copiedRubyText !== undefined && lastUsedKanjiIndex + 1 < kanji.length) {
    stateChanges.push(() => {
      addRubyTag(state, kanji[lastUsedKanjiIndex + 1], copiedRubyText, fallbackOpening, fallbackClosing);
    });
  } else if (copiedRubyText !== undefined) {
    return false;
  } else if (lastUsedKanjiIndex + 1 < kanji.length) {
    stateChanges.push(() => {
      token = state.push('text', '', 0);
      token.content = kanji[lastUsedKanjiIndex + 1];
    });
  }
  for (let i = 0; i < stateChanges.length; i++) {
    stateChanges[i]();
  }
  return true;
}

function processParsedRubyMarkup(state, start, end, mainText, rubyText, options) {
  let oldStart = state.pos,
      oldEnd = state.posMax,
      fallbackOpening = options.furiganaFallbackBrackets.charAt(0),
      fallbackClosing = options.furiganaFallbackBrackets.charAt(1);

  if (options.furiganaEnableSeperators && options.furiganaSeperators !== furiganaSeperators) {
    furiganaSeperators = options.furiganaSeperators;
    seperatorRegex = new RegExp(`[${escapeForRegex(furiganaSeperators)}]`, 'g');
  }

  if (!(options.furiganaEnableSeperators && createSeperatedRubyTags(state, mainText, rubyText, fallbackOpening, fallbackClosing))) {
    // Short-circuits if pattern matching is off
    if (!(options.furiganaPatternMatching && patternMatchText(state, mainText, rubyText, fallbackOpening, fallbackClosing))) {
      addRubyTag(state, mainText, rubyText, fallbackOpening, fallbackClosing);
    }
  }

  state.pos = oldStart;
  state.posMax = oldEnd;
}

// Given the position of a starting char, finds all text before terminator or fails with -1.
function parseInnerText(state, start, terminatorCode) {
  let oldPos = state.pos,
      posMax = state.posMax,
      found = false,
      endPosition = -1;

  state.pos = start + 1;
  while (state.pos < posMax) {
    // Short-circuits in all cases except closing immediately following opening
    // For example, the second condition prohibits [] but will not run on anything else.
    if (state.src.charCodeAt(state.pos) === terminatorCode && state.pos !== start + 1) {
      found = true;
      break;
    }
    state.pos++;
  }

  if (found) {
    endPosition = state.pos;
  }

  state.pos = oldPos;
  return endPosition;
}

// charCodeAt is much faster than charAt in Chrome
function ruby(state, silent, options) {
  if (state.src.charCodeAt(state.pos) !== 0x5B/* [ */) { return false; }

  // Ends are where the closing brackets are
  let pos = state.pos,
    startingPosition = state.pos,
    mainTextEnd,
    rubyTextStart,
    rubyTextEnd;

  mainTextEnd = parseInnerText(state, pos, 0x5D/* ] */);

  if (mainTextEnd === -1) { return false; }

  pos = mainTextEnd + 1;

  if (state.src.charCodeAt(pos) !== 0x7B/* { */) { return false; }

  rubyTextStart = pos + 1;

  rubyTextEnd = parseInnerText(state, pos, 0x7D/* } */);

  if (rubyTextEnd === -1) { return false; }

  state.pos = rubyTextEnd + 1;

  if (!silent) {
    processParsedRubyMarkup(state, startingPosition, rubyTextEnd, state.src.slice(startingPosition + 1, mainTextEnd), state.src.slice(rubyTextStart, rubyTextEnd), options);
  }

  return true;
}

export function setup(helper) {
  if (!helper.markdownIt) { return; }

  helper.registerOptions((opts, siteSettings) => {
    // Needed to allow disabling, enabled by default if not set
    opts.features.furigana = !!siteSettings.furigana;

    // TODO: Decide whether to fully support custom furigana forms
    // opts.furiganaForms = siteSettings.furigana_plugin_forms;

    opts.furiganaFallbackBrackets = siteSettings.furigana_fallback_brackets;

    if (!opts.furiganaFallbackBrackets) {
      opts.furiganaFallbackBrackets = '【】';
    }

    opts.furiganaPatternMatching = siteSettings.furigana_pattern_matching;

    opts.furiganaEnableSeperators = !!siteSettings.furigana_enable_seperators;
    opts.furiganaSeperators = siteSettings.furigana_seperators;
  });

  helper.whiteList([
    'ruby',
    'rt',
    'rp'
  ]);

  helper.registerPlugin((md) => {
    md.inline.ruler.push('furigana', (state, silent) => {
      return ruby(state, silent, helper.getOptions());
    });
  });
}
