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
const furiganaSeperators = '.．。・ ';
const seperatorRegex = new RegExp(`[${furiganaSeperators}]`, 'g');

// Returns true if seperators were created
// TODO: Make options aware for fallback brackets
function createSeperatedRubyTags(state, mainText, rubyText) {
  return false;
}

// Returns true if pattern matching was successful
// TODO: Make options aware for fallback brackets
function patternMatchText(state, mainText, rubyText) {
  let nonKanji = mainText.split(kanjiBlockRegex).filter(emptyStringFilter);

  if (nonKanji.length === 0) { return false; }

  let token,
      copiedRubyText = (' ' + rubyText).slice(1),
      kanji = mainText.split(nonKanjiBlockRegex).filter(emptyStringFilter),
      lastUsedKanjiIndex = 0,
      stateChanges = [];

  nonKanji.forEach((currentNonKanji, index) => {
    if (copiedRubyText === undefined) {
      if (index < kanji.length) {
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
      addRubyTag(state, kanji[indexCopy], splitFurigana[0], '【', '】');
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
      addRubyTag(state, kanji[lastUsedKanjiIndex + 1], copiedRubyText, '【', '】');
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
      oldEnd = state.posMax;

  if (!createSeperatedRubyTags(state, mainText, rubyText)) {
    // Short-circuits if pattern matching is off
    if (!(options.furiganaPatternMatching && patternMatchText(state, mainText, rubyText))) {
      addRubyTag(state, mainText, rubyText, options.furiganaFallbackBrackets.charAt(0), options.furiganaFallbackBrackets.charAt(1));
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
