import type { LaunchOptions, BrowserContextOptions } from 'playwright';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const browser = (process.env.BROWSER || 'chromium') as BrowserName;

const chromiumArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--ignore-certificate-errors',
  '--disable-extensions',
  '--incognito',
  '--disable-infobars',
];

interface PlaywrightConfig {
  browser: BrowserName;
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
}

const config: PlaywrightConfig = {
  browser,
  launchOptions: {
    headless: true,
    // The steps wait on the signals of the page, so no pause is added between actions. SLOW_MO=300 slows a headed run down for watching.
    slowMo: Number(process.env.SLOW_MO || 0),
    args: browser === 'chromium' ? chromiumArgs : [],
    // On a host where container networks come and go, Chromium aborts every request in flight with
    // net::ERR_NETWORK_CHANGED. Firefox can be told not to react to network changes: BROWSER=firefox.
    ...(browser === 'firefox' ? { firefoxUserPrefs: { 'network.notify.changed': false } } : {}),
  },
  contextOptions: {
    viewport: { width: 1600, height: 1200 },
    ignoreHTTPSErrors: true,
  },
};

export = config;
