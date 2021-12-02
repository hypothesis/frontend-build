import { mkdir, writeFile } from 'fs/promises';
import { basename, dirname, extname } from 'path';

import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import sass from 'sass';

/**
 * @typedef {import('tailwindcss/tailwind-config').TailwindConfig} TailwindConfig
 */
const defaultTailwindConfig = /** @type {TailwindConfig} */ ({
  darkMode: false,
  theme: {},
});

/**
 * Build CSS bundles from SASS or CSS inputs.
 *
 * @param {string[]} inputs - An array of CSS or SCSS file paths specifying the
 *   entry points of style bundles. The output files will be written to
 *   `build/styles/[name].css` where `[name]` is the basename of the input file
 *   minus the file extension.
 * @param {object} [options]
 *   @param {TailwindConfig} [options.tailwindConfig]
 *   Optional tailwind config object
 * @return {Promise<void>} Promise for completion of the build.
 */
export async function buildCSS(
  inputs,
  { tailwindConfig = defaultTailwindConfig } = {}
) {
  const outDir = 'build/styles';
  const minify = process.env.NODE_ENV === 'production';
  await mkdir(outDir, { recursive: true });

  /** @type {typeof import('tailwindcss')} */
  let tailwindcss;
  try {
    tailwindcss = (await import('tailwindcss')).default;
  } catch {
    // Ignored
  }

  await Promise.all(
    inputs.map(async input => {
      const output = `${outDir}/${basename(input, extname(input))}.css`;
      const sourcemapPath = output + '.map';

      const sassResult = sass.renderSync({
        file: input,
        includePaths: [dirname(input), 'node_modules'],
        outputStyle: minify ? 'compressed' : 'expanded',
        sourceMap: sourcemapPath,
      });

      const optionalPlugins = [];
      if (tailwindcss) {
        optionalPlugins.push(tailwindcss(tailwindConfig));
      }

      const cssProcessor = postcss([...optionalPlugins, autoprefixer()]);

      const postcssResult = await cssProcessor.process(sassResult.css, {
        from: input,
        to: output,
        map: {
          inline: false,
          prev: sassResult.map?.toString(),
        },
      });

      await writeFile(output, postcssResult.css);
      await writeFile(sourcemapPath, postcssResult.map.toString());
    })
  );
}
