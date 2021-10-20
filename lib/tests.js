import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

import { program } from 'commander';
import glob from 'glob';
import log from 'fancy-log';

import { buildJS, watchJS } from './rollup.js';

/**
 * Build a bundle of tests and run them using Karma.
 *
 * @param {object} options
 *   @param {string} options.bootstrapFile - Entry point for the test bundle that initializes the environment
 *   @param {string} options.rollupConfig - Rollup config that generates the test bundle using
 *     `${outputDir}/test-inputs.js` as an entry point
 *   @param {string} options.karmaConfig - Karma config file
 *   @param {string} options.outputDir - Directory in which to generate test bundle. Defaults to
 *     `build/scripts`
 *   @param {string} options.testsPattern - Minimatch pattern that specifies which test files to
 *   load
 * @return {Promise<void>} - Promise that resolves when test run completes
 */
export async function runTests({
  bootstrapFile,
  rollupConfig,
  outputDir = 'build/scripts',
  karmaConfig,
  testsPattern,
}) {
  // Parse command-line options for test execution.
  program
    .option(
      '--grep <pattern>',
      'Run only tests where filename matches a regex pattern'
    )
    .option('--watch', 'Continuously run tests (default: false)', false)
    .parse(process.argv);

  const { grep, watch } = program.opts();
  const singleRun = !watch;

  // Generate an entry file for the test bundle. This imports all the test
  // modules, filtered by the pattern specified by the `--grep` CLI option.
  const testFiles = [
    bootstrapFile,
    ...glob.sync(testsPattern).filter(path => (grep ? path.match(grep) : true)),
  ];

  const testSource = testFiles
    .map(path => `import "../../${path}";`)
    .join('\n');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(`${outputDir}/test-inputs.js`, testSource);

  // Build the test bundle.
  log(`Building test bundle... (${testFiles.length} files)`);
  if (singleRun) {
    await buildJS(rollupConfig);
  } else {
    await watchJS(rollupConfig);
  }

  // Run the tests.
  log('Starting Karma...');
  const { default: karma } = await import('karma');
  const parsedConfig = await karma.config.parseConfig(
    path.resolve(karmaConfig),
    { singleRun }
  );

  return new Promise((resolve, reject) => {
    new karma.Server(parsedConfig, exitCode => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject(new Error(`Karma run failed with status ${exitCode}`));
      }
    }).start();

    process.on('SIGINT', () => {
      // Give Karma a chance to handle SIGINT and cleanup, but forcibly
      // exit if it takes too long.
      setTimeout(() => {
        resolve();
        process.exit(1);
      }, 5000);
    });
  });
}
