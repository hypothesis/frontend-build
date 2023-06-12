import { mkdir, writeFile } from 'fs/promises';
import { basename, dirname, extname, relative } from 'path';

import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import sass from 'sass';

/**
 * @typedef {import('tailwindcss').Config} TailwindConfig
 */

/**
 * Build CSS bundles from SASS or CSS inputs.
 *
 * @param {string[]} inputs - An array of CSS or SCSS file paths specifying the
 *   entry points of style bundles. The output files will be written to
 *   `build/styles/[name].css` where `[name]` is the basename of the input file
 *   minus the file extension.
 * @param {object} options
 *   @param {TailwindConfig} [options.tailwindConfig]
 *   Optional tailwind config object
 * @return {Promise<void>} Promise for completion of the build.
 */
export async function buildCSS(inputs, { tailwindConfig } = {}) {
  const outDir = 'build/styles';
  const minify = process.env.NODE_ENV === 'production';
  await mkdir(outDir, { recursive: true });

  /** @type {import('postcss').PluginCreator<TailwindConfig>} */
  let tailwindcss;
  try {
    tailwindcss = (await import('tailwindcss')).default;
  } catch {
    // Ignored
  }

  await Promise.all(
    inputs.map(async input => {
      const output = `${outDir}/${basename(input, extname(input))}.css`;
      const sourceMapPath = `${output}.map`;

      const sassResult = sass.compile(input, {
        loadPaths: [dirname(input), 'node_modules'],
        style: minify ? 'compressed' : 'expanded',
        sourceMap: true,
      });

      const optionalPlugins = [];
      if (tailwindcss && tailwindConfig) {
        optionalPlugins.push(tailwindcss(tailwindConfig));
      }

      const cssProcessor = postcss([...optionalPlugins, autoprefixer()]);

      const postcssResult = await cssProcessor.process(sassResult.css, {
        from: input,
        to: output,
        map: {
          inline: false,
          prev: JSON.stringify(sassResult.sourceMap),
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
        `${postcssResult.css}\n/*# sourceMappingURL=${sourceMappingURL} */`
      );
      await writeFile(sourceMapPath, postcssResult.map.toString());
    })
  );
}
