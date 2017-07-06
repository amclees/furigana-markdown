import { registerOption } from 'pretty-text/pretty-text';

registerOption((siteSettings, opts) => {
  opts.features.furigana = !!siteSettings.furigana_enabled;
  opts.furiganaForms = siteSettings.furigana_plugin_forms;
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

function addFurigana(text, furiganaForms) {
  if (furiganaForms !== previousFuriganaForms) {
    updateRegexList(furiganaForms);
  }
  regexList.forEach(regex => {
    text = text.replace(regex, '<ruby>$1<rt>$2</rt></ruby>');
  });
  return text;
}

export function setup(helper) {
  helper.whiteList([
    'ruby',
    'rt'
  ]);

  helper.addPreProcessor(text => {
    return addFurigana(text, helper.getOptions().furiganaForms);
  });
}
