function addRubyTag(state, start, end, mainText, rubyText, fallbackOpening, fallbackClosing) {
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
    addRubyTag(state, startingPosition, rubyTextEnd, state.src.slice(startingPosition + 1, mainTextEnd), state.src.slice(rubyTextStart, rubyTextEnd), '【', '】');
  }

  return true;
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
      return ruby(state, silent, helper.getOptions());
    });
  });
}
