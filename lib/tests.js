import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

import { program } from 'commander';
import { globSync } from 'glob';
import log from 'fancy-log';

import { buildJS, watchJS } from './rollup.js';

/**
 * Build a bundle of tests and run them using Vitest.
 *
 * @param {object} options
 *   @param {string} options.bootstrapFile - Entry point for the test bundle that initializes the environment
 *   @param {string} options.rollupConfig - Rollup config that generates the test bundle using
 *     `${outputDir}/test-inputs.js` as an entry point
 *   @param {string} options.vitestConfig - Vitest config file.
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

  // Run the tests with vitest
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
