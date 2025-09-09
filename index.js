export { default as log } from 'fancy-log';

export { buildCSS } from './lib/css.js';
export { buildJS, watchJS } from './lib/rollup.js';
export { generateManifest } from './lib/manifest.js';
export { runTests } from './lib/tests.js';
export { run } from './lib/run.js';
