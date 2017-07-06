import { acceptance } from 'helpers/qunit-helpers';

acceptance('Furigana post', { loggedIn: true });

test('furigana post', (assert) => {
  visit('/');

  click('#create-topic');

  fillIn('.d-editor-input', '[鳥]^(とり)は飛んだ');

  andThen(() => {
    assert.equal(
      find('.d-editor-preview').html(),
      `<ruby>鳥<rt>とり</rt></ruby>`,
      'it should contain the ruby HTML'
    );
  });
});
