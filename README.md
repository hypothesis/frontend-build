# @hypothesis/frontend-build

This package contains functions for building assets and running tests in
Hypothesis frontend projects, typically as part of [Gulp](https://gulpjs.com) tasks.

It assumes that the project is using our standard frontend tech stack and
follows certain conventions about the location and naming of files.

## Prerequisites

This project assumes our standard tech stack for frontend projects:

- [Gulp](https://gulpjs.com) for running tasks [1]
- [Rollup](https://rollupjs.org/guide/en/) for building JavaScript bundles
- [Sass](https://sass-lang.com) for authoring styles
- [Karma](https://karma-runner.github.io/latest/index.html) for running tests

[1] Gulp is not required as the task runner, but is how most of our projects
are currently set up.

## Usage

The typical structure of a Hypothesis frontend project looks like:

```sh
gulpfile.mjs  # Gulp tasks

src/  # Source files ("$PROJECT_NAME/static/scripts" in Python projects)
  karma.config.js  # Karma config file
  tests/
    bootstrap.js  # JS module that configures test environment

rollup.config.mjs  # Rollup config that builds application/library bundles
rollup-tests.config.mjs  # Rollup config that builds test bundle from `build/scripts/test-inputs.js`

build/  # Compiled frontend assets
  scripts/  # Generated JS bundles
    some-app.bundle.js
    some-app.bundle.js.map

  styles/  # Generated CSS bundles
    some-app.css
    some-app.css.map
```

Compiling frontend assets from source files is handled by tasks defined in
`gulpfile.mjs`.

To use this package, first add it as a dependency to the project:

```js
yarn add --dev @hypothesis/frontend-build
```

Then use the functions within Gulp tasks. For example:

```js
import { buildCSS, buildJS, watchCSS, runTests } from '@hypothesis/frontend-build';

gulp.task('build-js', () => buildJS('rollup.config.mjs'));
gulp.task('watch-js', () => watchJS('rollup.config.mjs'));
gulp.task('build-css', () => buildCSS(
  ['src/my-app.scss', 'src/other-app.scss'],
  { tailwindConfig }
));
gulp.task('watch-css', () => gulp.watch('src/**/*.scss', 'build-css'));
gulp.task('watch', gulp.parallel('watch-js', 'watch-css'));
gulp.task('test', () => runTests({
  bootstrapFile: 'src/tests/bootstrap.js',
  karmaConfig: 'src/karma.config.js',
  rollupConfig: 'rollup-tests.config.mjs',
  testsPattern: '**/*-test.js',
});

// Project-specific tasks...
```

## API reference

This section provides an overview of the functions in this package. See the
JSDoc comments for individual functions for full details.

### Building asset bundles

`buildJS(rollupConfig)` - Build one or more JavaScript bundles defined in a
Rollup config file. The Rollup config file must be an ES module.

`watchJS(rollupConfig)` - Same as `buildJS`, but watches for updates to input files
after building the bundle and rebuilds if they change.

`buildCSS(inputs, options = {})` - Build one or more CSS bundles from CSS or SASS
entry points, with optional support for Tailwind.

- `options.tailwindConfig` : Optional [Tailwind config/preset](https://tailwindcss.com/docs/configuration)

`generateManifest(options)` - Generate a JSON asset manifest suitable for use
with the [h-assets](https://pypi.org/project/h-assets/) package used by Python
apps to serve static assets.

### Running tests

`runTests(config)` - Build a JavaScript bundle of tests from a set of input files
and run them in Karma.

The test bundle is created by first finding all test files that match the
`testsPattern` argument and generating an entry point,
`build/scripts/test-inputs.js`, which imports all of the test files. The
bundle is then built by passing the config specified by `rollupConfig` to
Rollup. Once the bundle has been generated, Karma is started using the config
file specified by `karmaConfig`, which should load the test bundle.

This command supports filtering which tests are run
by using the `--grep <file pattern>` CLI argument. If the `--watch` CLI flag is
set, the test runner watches for changes and rebuild and re-runs the tests if
the input files change.

### Utilities

`run(command, args)` - Run a CLI command and forward the output to the terminal.

## Additional documentation

[Release guide](https://github.com/hypothesis/frontend-shared/blob/main/docs/releases.md). _Note this is in the frontend-shared repository. The process is the same for this one._
