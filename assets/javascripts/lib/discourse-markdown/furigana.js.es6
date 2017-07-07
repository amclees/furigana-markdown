import { registerOption } from 'pretty-text/pretty-text';

registerOption((siteSettings, opts) => {
  opts.features.furigana = !!siteSettings.furigana_enabled;
  opts.furiganaForms = siteSettings.furigana_plugin_forms;
  opts.furiganaFallbackBrackets = siteSettings.furigana_fallback_brackets;
});

// This function escapes special characters for use in a regex constructor.
function escapeForRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
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
    text = text.replace(regex, (match, match1, match2, offset, mainText) => {
      if (match.indexOf('\\') === -1 && mainText[offset - 1] !== '\\') {
        return replacementTemplate.replace('$1', match1).replace('$2', match2);
      } else {
        return match;
      }
    });
  });
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
