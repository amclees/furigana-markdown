module RubyTagStripper
  def self.strip(fragment)
    fragment.css('ruby').each do |node|
      node.replace(node.content)
    end
  end
end
