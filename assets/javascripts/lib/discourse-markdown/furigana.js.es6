import { registerOption } from 'pretty-text/pretty-text';

registerOption((siteSettings, opts) => {
  opts.features.furigana = !!siteSettings.furigana_enabled;
});

function addFurigana(text) {
  return text.replace(/\[((?:[^\u0000-\u007F]|\w)+)\]\^\(((?:[^\u0000-\u007F]|\w)+)\)/g, '<ruby>$1 <rt>$2</rt></ruby>');
}

export function setup(helper) {
  helper.whiteList([
    'ruby',
    'rt'
  ]);

  helper.addPreProcessor(text => {
    return addFurigana(text);
  });
}
