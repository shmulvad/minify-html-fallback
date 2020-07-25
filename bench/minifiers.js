const esbuild = require('esbuild');
const htmlMinifier = require('html-minifier');
const minifyHtml = require('@minify-html/js');
const minimize = require('minimize');

const testJsMinification = process.env.HTML_ONLY !== '1';

const jsMime = new Set([
  undefined,
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
]);

class EsbuildAsync {
  constructor () {
    this.promises = [];
  }

  queue (code) {
    const id = this.promises.push(esbuild.transform(code, {
      minify: true,
      minifyWhitespace: true,
      minifyIdentifiers: true,
      minifySyntax: true,
    })) - 1;
    return `_____ESBUILD_ASYNC_PLACEHOLDER_${id}_____`;
  }

  async finalise (html) {
    const jsTransformResults = await Promise.all(this.promises);
    return html.replace(/_____ESBUILD_ASYNC_PLACEHOLDER_([0-9]+)_____/g, (_, id) => jsTransformResults[id].js.replace(/<\/script/g, '<\\/script'));
  }
}

const minifyHtmlCfg = minifyHtml.createConfiguration({minifyJs: testJsMinification});
const htmlMinifierCfg = {
  collapseBooleanAttributes: true,
  collapseInlineTagWhitespace: true,
  collapseWhitespace: true,
  // minify-html can do context-aware whitespace removal, which is safe when configured correctly to match how whitespace is used in the document.
  // html-minifier cannot, so whitespace must be collapsed conservatively.
  // Alternatively, minify-html can also be made to remove whitespace regardless of context.
  conservativeCollapse: true,
  customEventAttributes: [],
  decodeEntities: true,
  ignoreCustomComments: [],
  ignoreCustomFragments: [/<\?[\s\S]*?\?>/],
  // This will be set to a function if `testJsMinification` is true.
  minifyJS: false,
  processConditionalComments: true,
  removeAttributeQuotes: true,
  removeComments: true,
  removeEmptyAttributes: true,
  removeOptionalTags: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  removeTagWhitespace: true,
  useShortDoctype: true,
};

module.exports = {
  '@minify-html/js': (_, buffer) => minifyHtml.minifyInPlace(Buffer.from(buffer), minifyHtmlCfg),
  'html-minifier': testJsMinification
    ? async (content) => {
      const js = new EsbuildAsync();
      const res = htmlMinifier.minify(content, {
        ...htmlMinifierCfg,
        minifyJS: code => js.queue(code),
      });
      return js.finalise(res);
    }
    : content => htmlMinifier.minify(content, htmlMinifierCfg),
  'minimize': testJsMinification
    ? async (content) => {
      const js = new EsbuildAsync();
      const plugins = [];
      if (testJsMinification) {
        plugins.push({
          id: 'esbuild',
          element: (node, next) => {
            if (node.type === 'text' && node.parent && node.parent.type === 'script' && jsMime.has(node.parent.attribs.type)) {
              node.data = js.queue(node.data);
            }
            next();
          },
        });
      }
      const res = new minimize({plugins}).parse(content);
      return js.finalise(res);
    }
    : content => new minimize().parse(content),
};
