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

function addFurigana(state, silent, options) {
  // Declare variables
  let baseText,
      furigana,
      baseTextStart,
      baseTextEnd,
      rubyTextStart,
      rubyTextEnd;

  // Quit unless it starts with a [
  if (state.src.charCodeAt(state.pos) !== 0x5B/* [ */) { return false; }

  // Determine limits of base text
  baseTextStart = state.pos + 1;
  baseTextEnd = parseInnerText(state, baseTextStart, 0x5D/* ] */);

  // Quit if there is no ]
  if (baseTextEnd === -1) { return false; }

  // Quit without an immediate {
  state.pos = baseTextEnd + 1;
  if (state.src.charCodeAt(state.pos) !== 0x7B) { return false; }
  rubyTextStart = state.pos;

  // Find terminating }
  rubyTextEnd = parseInnerText(state, rubyTextStart, 0x7D);

  // Quit if there is no }
  if (rubyTextEnd === -1) { return false; }
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
      addFurigana(state, silent, helper.getOptions());
    });
  });
}
