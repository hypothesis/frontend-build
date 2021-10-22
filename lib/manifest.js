import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';

import glob from 'glob';

/**
 * Generate a manifest that maps asset paths to cache-busted URLs.
 *
 * The generated manifest file is suitable for use with the h-assets Python
 * package (https://pypi.org/project/h-assets/) used by backend Hypothesis
 * projects for serving static assets. The manifest looks like:
 *
 * ```
 * {
 *   "scripts/app.bundle.js": "scripts/app.bundle.js?abc123",
 *   "styles/app.css": "styles/app.css?def456",
 *   ...
 * }
 * ```
 *
 * Returns the data that was written to the manifest.
 *
 * @param {object} options
 *   @param {string} [options.pattern] - Glob pattern that specifies which assets to include
 *   @param {string} [options.manifestPath] - File path to write the manifest to
 * @return {Promise<Record<string, string>>}
 */
export async function generateManifest({
  pattern = 'build/**/*.{css,js,map}',
  manifestPath = 'build/manifest.json',
} = {}) {
  const manifestDir = path.dirname(manifestPath);
  const files = glob.sync(pattern);

  /** @type {Record<string, string>} */
  const manifest = {};

  await Promise.all(
    files.map(async file => {
      const fileContent = await readFile(file);
      const hash = await createHash('sha1');
      hash.update(fileContent);

      const hashSuffix = hash.digest('hex').slice(0, 6);
      const relativePath = path.relative(manifestDir, file);
      manifest[relativePath] = `${relativePath}?${hashSuffix}`;
    })
  );

  const manifestData = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
  await writeFile(manifestPath, manifestData);

  return manifest;
}
