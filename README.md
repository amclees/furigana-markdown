### furigana-markdown

HTML5 `<ruby>` markdown notation for [Discourse](https://www.discourse.org).

## Usage

The following is the default format: `[main]^(annotation)`
For example:

```
[世界]^(せかい)
```

Will be displayed as 世界 with せかい above it.

## Custom Formats

By changing the `furigana plugin forms` setting, you can allow multiple
furigana markdown types.

* Each type is seperated by a `|`.
Each component of the type is seperated by a `:`.
* Please do not use `|` or `:` except as seperators in the configuration.
* If you do not want a seperator, leave it out. However, both sets of brackets are required.

For example:
```
[]:^:()|[]::{}
```
Will allow either `[main]^(annotation)` or `[main]{annotation}` to be used.



## Installation

Follow the [Install a Plugin](https://meta.discourse.org/t/install-a-plugin/19157) howto.

## Browser Support
Has been tested in the following as of 2017-7-5
* Firefox
* Chrome
* IE 11
* Opera

`<ruby>` is available and works in all modern browsers (and IE) except Opera Mini according to [Can I Use?](http://caniuse.com/#feat=ruby).

## License

MIT
