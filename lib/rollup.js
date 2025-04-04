import { resolve } from 'path';
import url from 'url';

import log from 'fancy-log';
import * as rollup from 'rollup';

/** @param {import('rollup').RollupLog} warning */
function logRollupWarning(warning) {
  log.warn(`Rollup warning: ${warning} (${warning.url})`);
}

/** @param {string} path */
async function readConfig(path) {
  const fileURL = url.pathToFileURL(resolve(path)).toString();
  const { default: config } = await import(fileURL);
  return Array.isArray(config) ? config : [config];
}

/**
 * Build a JavaScript bundle using a Rollup config.
 *
 * @param {string} rollupConfig - Path to Rollup config file
 */
export async function buildJS(rollupConfig) {
  const configs = await readConfig(rollupConfig);

  await Promise.all(
    configs.map(async config => {
      const bundle = await rollup.rollup({
        onwarn: logRollupWarning,
        ...config,
      });
      await bundle.write(config.output);
    }),
  );
}

/**
 * Build a JavaScript bundle using a Rollup config and auto-rebuild when any
 * source files change.
 *
 * @param {string} rollupConfig - Path to Rollup config file
 * @return {Promise<void>}
 */
export async function watchJS(rollupConfig) {
  const configs = await readConfig(rollupConfig);

  const watcher = rollup.watch(
    configs.map(config => ({
      onwarn: logRollupWarning,
      ...config,
    })),
  );

  return new Promise(resolve => {
    watcher.on('event', event => {
      switch (event.code) {
        case 'START':
          log.info('JS build starting...');
          break;
        case 'BUNDLE_END':
          event.result.close();
          break;
        case 'ERROR':
          log.info('JS build error', event.error);
          break;
        case 'END':
          log.info('JS build completed.');
          resolve(); // Resolve once the initial build completes.
          break;
      }
    });
  });
}
