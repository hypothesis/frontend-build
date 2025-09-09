import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, extname, relative } from 'path';

import postcss from 'postcss';

/**
 * @template T
 * @typedef {import('postcss').PluginCreator<T>} PluginCreator
 */

/**
 * @typedef Options
 * @prop {boolean} [autoprefixer] - Enable the Autoprefixer PostCSS plugin
 * @prop {object} [tailwindConfig] - Enable Tailwind v3 with the given configuration.
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
export async function buildCSS(
  inputs,
  { autoprefixer = true, tailwind = false, tailwindConfig } = {},
) {
  const outDir = 'build/styles';
  const minify = process.env.NODE_ENV === 'production';
  await mkdir(outDir, { recursive: true });

  if (tailwind && tailwindConfig) {
    throw new Error(
      'Only one of `tailwind` (for Tailwind v4+) or `tailwindConfig` (for Tailwind v3) should be set',
    );
  }

  /** @type {PluginCreator<any>} */
  let tailwindcss;
  if (tailwindConfig) {
    tailwindcss = /** @type {any} */ (await import('tailwindcss')).default;
  } else if (tailwind) {
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
        plugins.push(tailwindcss(tailwindConfig));
      }
      if (autoprefixer) {
        const autoprefixerPlugin = (await import('autoprefixer')).default;
        plugins.push(autoprefixerPlugin());
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
      const sourceMappingURL = relative(dirname(output), sourceMapPath);

      await writeFile(
        output,
        // We have to manually add the sourceMappingURL comment, because
        // `sass.compile(...)` does not do it by itself.
        // https://sass-lang.com/documentation/js-api/interfaces/Options#sourceMap
        // It's important to know that URI-encoding the sourceMappingURL might
        // be needed if we start using characters outside the [0-9a-zA-Z-_.] set
        // in file names
        `${postcssResult.css}\n/*# sourceMappingURL=${sourceMappingURL} */`,
      );
      await writeFile(sourceMapPath, postcssResult.map.toString());
    }),
  );
}
