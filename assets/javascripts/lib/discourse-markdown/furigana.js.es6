import { registerOption } from 'pretty-text/pretty-text';

registerOption((siteSettings, opts) => {
  opts.features.furigana = !!siteSettings.furigana_enabled;
  opts.furiganaForms = siteSettings.furigana_plugin_forms;
  opts.furiganaFallbackBrackets = siteSettings.furigana_fallback_brackets;
});

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
      `${escapeForRegex(mainBrackets[0])}(${innerRegexString})${escapeForRegex(mainBrackets[1])}${escapeForRegex(seperator)}${escapeForRegex(furiganaBrackets[0])}(${innerRegexString})${escapeForRegex(furiganaBrackets[1])}`,
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
    text = text.replace(regex, replacementTemplate);
  });
  return text;
}

export function setup(helper) {
  helper.whiteList([
    'ruby',
    'rt',
    'rp'
  ]);

  helper.addPreProcessor(text => {
    return addFurigana(text, helper.getOptions());
  });
}
