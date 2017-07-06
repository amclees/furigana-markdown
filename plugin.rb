# name: furigana-markdown
# about: HTML5 <ruby> markdown notation for Discourse
# version: 0.0.1
# authors: Andrew McLees
# url: https://github.com/amclees/furigana-markdown

require_relative './strip_email_ruby'

enabled_site_setting :furigana_enabled

after_initialize do
  Email::Styles.register_plugin_style do |fragment|
    strip_ruby_tags fragment
  end
end
