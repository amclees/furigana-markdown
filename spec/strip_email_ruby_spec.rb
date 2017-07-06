require 'nokogiri'
require_relative '../strip_email_ruby'

RSpec.describe RubyTagStripper do
  it 'strips ruby tags from HTML' do
    doc = Nokogiri::HTML('<html><body><p>Hello, <ruby>世界<rp>(</rp><rt>せかい</rt><rp>)</rp></ruby></p></body></html>')
    RubyTagStripper.strip(doc)
    expect(doc.at('body').inner_html).to eq '<p>Hello, 世界(せかい)</p>'
  end
end
