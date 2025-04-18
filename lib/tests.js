import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

import { program } from 'commander';
import { globSync } from 'glob';
import log from 'fancy-log';

import { buildJS, watchJS } from './rollup.js';

/**
 * Build a bundle of tests and run them using Karma.
 *
 * @param {object} options
 *   @param {string} options.bootstrapFile - Entry point for the test bundle that initializes the environment
 *   @param {string} options.rollupConfig - Rollup config that generates the test bundle using
 *     `${outputDir}/test-inputs.js` as an entry point
 *   @param {string} [options.karmaConfig] - Karma config file. Will use karma to run tests
 *   @param {string} [options.vitestConfig] - Vitest config file. Will use vitest to run tests
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
  vitestConfig,
  testsPattern,
}) {
  // Parse command-line options for test execution.
  program
    .allowExcessArguments()
    .option(
      '--grep <pattern>',
      'Run only tests where filename matches a regex pattern',
    )
    .option('--live', 'Continuously run tests (default: false)', false)
    .parse(process.argv);

  const { grep, live } = program.opts();
  const singleRun = !live;

  // Generate an entry file for the test bundle. This imports all the test
  // modules, filtered by the pattern specified by the `--grep` CLI option.
  const testFiles = [
    bootstrapFile,
    ...globSync(testsPattern)
      .filter(path => (grep ? path.match(grep) : true))
      .sort(),
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

  if (karmaConfig) {
    // Run the tests with karma.
    log('Starting Karma...');
    const { default: karma } = await import('karma');
    const parsedConfig = await karma.config.parseConfig(
      path.resolve(karmaConfig),
      { singleRun },
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
  } else if (vitestConfig) {
    // Run the tests with vitest. Karma takes precedence if both are defined
    log('Starting vitest...');
    const [{ startVitest }, vitestOptions] = await Promise.all([
      import('vitest/node'),
      import(path.resolve(vitestConfig)),
    ]);
    await startVitest('test', [], {
      watch: live,
      ...vitestOptions,
    });
  }
}
