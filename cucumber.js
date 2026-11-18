// A feature file, a scenario (file:line), a folder or a rerun file named on
// the command line of cucumber-js runs alone: `npx cucumber-js
// tests/features/login.feature`. cucumber-js 12 adds the paths of the command
// line to the `paths` of this file instead of using them alone, so `paths` is
// left empty when the command line names any, as in webship-js itself.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  // Only when cucumber-js itself runs, not when another script reads this file.
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions (auto HTML report on exit; disable: WEBSHIP_REPORT_DISABLE=1).
      // 'node_modules/webship-js/tests/step-definitions-diffy/**/*.js', // Diffy step definitions (optional).
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset too.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : (commandLinePaths().length ? [] : ['tests/features/**/*.feature']),
    // CUCUMBER_TAGS=@admin (or @storefront, @critical) runs a lane. The default keeps out work in progress and the
    // @must-fail scenarios, which prove that the assertions fail when they must (npm run test:must-fail runs them).
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
    // CUCUMBER_RETRY=1 runs a failed scenario once more. The default is no retry: a scenario that needs one is a finding.
    retry: Number(process.env.CUCUMBER_RETRY || 0),
    format: [
      '@cucumber/pretty-formatter',
      'json:tests/reports/cucumber_report.json',
    ],
    formatOptions: {
      // Colours follow the terminal (GitHub Actions counts as one); FORCE_COLOR=1
      // or FORCE_COLOR=0 sets them. cucumber-js 12 deprecated `colorsEnabled`.
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      // The default is the local DDEV site that scripts/build-site.sh builds (project "magentosteps"),
      // never a site of somebody else: the suite logs in with the accounts below. LAUNCH_URL points it at another site.
      launchUrl: process.env.LAUNCH_URL || 'https://magentosteps.ddev.site',
      // The first path segment of the admin panel (the --backend-frontname of the installation).
      adminPath: process.env.ADMIN_PATH || 'admin',
      // How the suite rebuilds invalid indexes (`When I rebuild the invalid indexes`): the admin panel has no reindex
      // button, so a shell command does it, run in siteDir (the project folder of the site).
      reindexCommand: process.env.REINDEX_COMMAND || 'ddev exec php bin/magento indexer:reindex',
      siteDir: process.env.SITE_DIR || '../magento-site',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them; @js-fail, @js-warn and @js-off per scenario.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },
      // The accounts the session steps use, by handle. They are configuration, not test
      // data: scripts/build-site.sh creates them once and a feature never creates or
      // deletes one of them. An admin user carries `username`, a customer carries `email`.
      //   admin     administrator (every resource)       logs in to the admin panel
      //   sales     admin user with the "Sales" role     logs in to the admin panel, sees Sales only
      //   customer  customer with a default address      logs in to the store
      //   shopper   a second customer with an address    logs in to the store
      users: {
        admin: { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASSWORD || 'Admin123456789!' },
        sales: { username: process.env.SALES_USER || 'sales', password: process.env.SALES_PASSWORD || 'Sales123456789!' },
        customer: { email: process.env.CUSTOMER_EMAIL || 'customer@example.com', password: process.env.CUSTOMER_PASSWORD || 'Customer123456789!', name: 'Casey Customer' },
        shopper: { email: process.env.SHOPPER_EMAIL || 'shopper@example.com', password: process.env.SHOPPER_PASSWORD || 'Shopper123456789!', name: 'Sam Shopper' },
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
      selectors: {
        css: {},
        xpath: {},
        filesPath: './tests/selectors/',
        files: [],
        offset: 60,
        breakpoints: {
          xs:   { width: 375,  height: 667  },
          sm:   { width: 576,  height: 800  },
          md:   { width: 768,  height: 1024 },
          lg:   { width: 992,  height: 768  },
          xl:   { width: 1200, height: 900, default: true },
          xxl:  { width: 1400, height: 900  },
          xxxl: { width: 1920, height: 1080 },
        },
      },
      screenshot: {
        dir: './screenshots',
        purge: false,
        onFailed: true,
        onEveryStep: false,
        alwaysFullscreen: false,
        failedPrefix: 'failed_',
        filenamePattern: '{datetime}.{feature_file}.feature_{step_line}.{ext}',
        filenamePatternFailed: '{failed_prefix}{datetime}.{feature_file}.feature_{step_line}.{ext}',
        infoTypes: '',
      },
      // Diffy visual-regression (optional). Uncomment and set apiKey / projectId to enable.
      // diffy: {
      //   apiKey: '',                                 // DIFFY_API_KEY
      //   projectId: 0,                               // DIFFY_PROJECT_ID
      //   breakpoints: '640,1200',                    // DIFFY_BREAKPOINTS
      //   windowHeight: 2000,                         // DIFFY_WINDOW_HEIGHT
      //   screenshotsDir: '',                         // DIFFY_SCREENSHOTS_DIR
      //   baseUrl: 'https://app.diffy.website/api/',  // DIFFY_API_BASE_URL
      //   maxWait: 30,                                // DIFFY_MAX_WAIT (seconds)
      //   env1Url: '',                                // DIFFY_ENV1_URL
      //   env2Url: '',                                // DIFFY_ENV2_URL
      // },
    },
  },
};
