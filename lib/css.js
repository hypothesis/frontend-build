import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname, relative } from 'path';

import postcss from 'postcss';

/**
 * @template T
 * @typedef {import('postcss').PluginCreator<T>} PluginCreator
 */

/**
 * @typedef Options
 * @prop {boolean} [tailwind] - Enable Tailwind v4 or later.
 */

/**
 * Build CSS bundles from SASS or CSS inputs.
 *
 * @param {string[]} inputs - An array of CSS or SCSS file paths specifying the
 *   entry points of style bundles. The output files will be written to
 *   `build/styles/[name].css` where `[name]` is the basename of the input file
 *   minus the file extension.
 * @param {Options} options
 * @return {Promise<void>} Promise for completion of the build.
 */
export async function buildCSS(inputs, { tailwind = false } = {}) {
  const outDir = 'build/styles';
  const minify = process.env.NODE_ENV === 'production';
  await mkdir(outDir, { recursive: true });

  /** @type {PluginCreator<any>} */
  let tailwindcss;
  if (tailwind) {
    tailwindcss = (await import('@tailwindcss/postcss')).default;
  }

  await Promise.all(
    inputs.map(async input => {
      const output = `${outDir}/${basename(input, extname(input))}.css`;
      const sourceMapPath = `${output}.map`;

      let css;
      let sourceMap;

      if (input.endsWith('.scss')) {
        const sass = await import('sass');
        const sassResult = sass.compile(input, {
          loadPaths: [dirname(input), 'node_modules'],
          style: minify ? 'compressed' : 'expanded',
          sourceMap: true,
        });
        css = sassResult.css;
        sourceMap = sassResult.sourceMap;
      } else {
        css = await readFile(input, { encoding: 'utf-8' });
      }

      const plugins = [];
      if (tailwindcss) {
        plugins.push(tailwindcss());
      }

      const cssProcessor = postcss(plugins);

      const postcssResult = await cssProcessor.process(css, {
        from: input,
        to: output,
        map: {
          inline: false,
          prev: sourceMap ? JSON.stringify(sourceMap) : undefined,
        },
      });

      const sourceMappingURL =
        sourceMap && relative(dirname(output), sourceMapPath);

      // We have to manually add the sourceMappingURL comment, because
      // `sass.compile(...)` does not do it by itself.
      // https://sass-lang.com/documentation/js-api/interfaces/Options#sourceMap
      // It's important to know that URI-encoding the sourceMappingURL might
      // be needed if we start using characters outside the [0-9a-zA-Z-_.] set
      // in file names
      const content = sourceMappingURL
        ? `${postcssResult.css}\n/*# sourceMappingURL=${sourceMappingURL} */`
        : postcssResult.css;

      await writeFile(output, content);
      await writeFile(sourceMapPath, postcssResult.map.toString());
    }),
  );
}
