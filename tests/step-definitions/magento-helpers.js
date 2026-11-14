'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that downstream packs can require instead of
// copying: the wait budget, the "settled" signal of the admin panel and of the
// storefront, friendly presence assertions, URL building, the users registry,
// the messages, the admin grids (both kinds), the admin forms and the
// confirmation dialogs.
//
// Everything here was written from what the real pages do in a browser; the
// notes are in exploration/*.md of the repository.

const { gotoUrl, friendly } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 15 seconds (an order or a product save can take several), kept below
 * webship-js's 45 second step timeout. WEBSHIP_ASSERT_BUDGET=<milliseconds>
 * changes the 15 seconds (the must-fail check lowers it: every one of its
 * scenarios waits the whole budget before it fails).
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  const floor = Number(process.env.WEBSHIP_ASSERT_BUDGET) || 15000;
  return Math.min(Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, floor), 30000);
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A case-sensitive RegExp that matches the literal text anywhere.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function literal(text) {
  return new RegExp(escapeRegExp(text));
}

/**
 * A RegExp that matches the whole text, ignoring the case and the space around
 * it. The storefront theme prints several labels in capitals through CSS, so a
 * label is compared without its case.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(String(text).trim()).replace(/\s+/g, '\\s+') + '\\s*$', 'i');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * A text as the value of a Playwright `:text-is("…")` pseudo-class.
 *
 * @param {string} text
 * @returns {string}
 */
function quoted(text) {
  return '"' + String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass
 * through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world) + '/';
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * The first path segment of the admin panel (`adminPath` in cucumber.js, the
 * `--backend-frontname` of the installation; "admin" by default).
 *
 * @param {object} world
 * @returns {string}
 */
function adminPath(world) {
  const value = (world.parameters && world.parameters.adminPath) || 'admin';
  return String(value).replace(/^\/+|\/+$/g, '');
}

/**
 * The URL of an admin page from its route ("catalog/product", "admin/cache").
 *
 * @param {object} world
 * @param {string} route
 * @returns {string}
 */
function adminUrl(world, route) {
  const tail = String(route || '').replace(/^\/+|\/+$/g, '');
  return siteRoot(world) + '/' + adminPath(world) + '/' + (tail ? tail + '/' : '');
}

// ---------------------------------------------------------------------------
// The "settled" signal
// ---------------------------------------------------------------------------

// Runs in the page. Returns '' when the page is settled, else what it is still
// doing. Measured in a real browser: `document.readyState` is "complete" long
// before the page works (RequireJS still loads 20 to 130 modules and the
// `text/x-magento-init` blocks are not processed yet), so "page loaded" is not
// the signal. A page is settled when RequireJS has no requested module left to
// load, every init block is consumed, no request is in flight and no loading
// mask shows. The modules load in waves with short idle gaps between them, so
// the caller asks for several quiet readings in a row.
/* istanbul ignore next */
function settledProbe() {
  if (document.readyState !== 'complete') return 'the document is still loading';
  const ctx = window.require && window.require.s && window.require.s.contexts && window.require.s.contexts._;
  if (ctx) {
    // Only the modules somebody asked for count: the admin panel keeps a few named
    // modules nobody requires (globalNavigation, modalPopup, …) in the registry for good.
    const pending = Object.keys(ctx.registry || {}).filter((id) => ctx.registry[id] && ctx.registry[id].enabled);
    if (pending.length) return 'scripts are still loading (' + pending.slice(0, 3).join(', ') + (pending.length > 3 ? ', …' : '') + ')';
  }
  if (document.querySelector('script[type="text/x-magento-init"]')) return 'the page components are not initialised yet';
  if (window.jQuery && window.jQuery.active) return 'a request is in flight';
  const masks = document.querySelectorAll('.loading-mask, [data-role="spinner"], [data-role="loader"], ._block-content-loading, .admin__data-grid-loading-mask, .admin__form-loading-mask, .popup-loading');
  for (const mask of masks) {
    if (getComputedStyle(mask).display !== 'none' && getComputedStyle(mask).visibility !== 'hidden' && mask.getClientRects().length) {
      return 'a loading mask is showing (' + (mask.id ? '#' + mask.id : '.' + String(mask.className).trim().split(/\s+/).join('.')) + ')';
    }
  }
  return '';
}

/**
 * Wait until the page is settled: scripts loaded, components initialised, no
 * request in flight, no loading mask. Three readings in a row must agree, so a
 * navigation that a click has just started is not mistaken for a quiet page.
 * Works in the admin panel and on the storefront.
 *
 * @param {object} world
 * @param {number} [timeout]
 */
async function settle(world, timeout) {
  const page = world.page;
  const limit = Date.now() + (timeout || budget(world));
  let quiet = 0;
  let last = 'the page did not answer';
  while (Date.now() < limit) {
    let state;
    try {
      state = await page.evaluate(settledProbe);
    } catch {
      state = 'the page is navigating';
    }
    if (state === '') {
      quiet += 1;
      if (quiet >= 3) return;
    } else {
      quiet = 0;
      last = state;
    }
    await page.waitForTimeout(120);
  }
  throw friendly({
    message: `The page did not settle within ${timeout || budget(world)} ms: ${last}.`,
    hint: 'A loading mask that never goes away usually means a failed request: open the browser console and the network tab on this page.',
  });
}

/**
 * Open a URL and wait for the page to settle.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  try {
    await gotoUrl(world.page, url);
  } catch (err) {
    // The browser drops a request when the network of the machine changes under
    // it (a container network coming or going on a shared host) and asks for
    // the page to be loaded again: do that once.
    if (!/ERR_NETWORK_CHANGED/.test(String(err && err.message))) throw err;
    await gotoUrl(world.page, url);
  }
  await settle(world);
}

/**
 * Run an action that may load a new page (a click on a link or a submit
 * button), then wait for the page to settle. While a form is being posted the
 * old page still looks settled, so the navigation itself is watched: when the
 * action starts a main-frame navigation request, the step waits until that
 * page has arrived. Nothing is required: the same step works for an AJAX
 * action. The clicks passed in carry `noWaitAfter`: this helper does the
 * waiting, and Playwright's own wait after a click now and then never returns
 * in Firefox although the page has arrived.
 *
 * @param {object} world
 * @param {Function} action
 */
async function actAndSettle(world, action) {
  const page = world.page;
  let started = 0;
  let arrived = 0;
  const onRequest = (request) => {
    // A redirect is a new request of the same navigation: count the first hop only.
    if (request.isNavigationRequest() && request.frame() === page.mainFrame() && !request.redirectedFrom()) started += 1;
  };
  const onNavigated = (frame) => {
    if (frame === page.mainFrame()) arrived += 1;
  };
  page.on('request', onRequest);
  page.on('framenavigated', onNavigated);
  try {
    await action();
    // The request of a click starts within a moment of it.
    const grace = Date.now() + 600;
    while (!started && !arrived && Date.now() < grace) await page.waitForTimeout(50);
    const limit = Date.now() + budget(world);
    while (started > arrived && Date.now() < limit) await page.waitForTimeout(50);
  } finally {
    page.off('request', onRequest);
    page.off('framenavigated', onNavigated);
  }
  await settle(world);
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number, found?: Function}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout, found }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    const seen = found ? await found().catch(() => '') : '';
    throw friendly({
      message: (notCase ? `Expected not to see ${label}, but it is on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`) + (seen ? ` Found instead: ${seen}.` : ''),
      hint,
    });
  }
}

/**
 * Poll a reader until it returns the expected value (or, with `notCase`, any
 * other value) and fail with what was found.
 *
 * @param {object} world
 * @param {Function} read - async () => string
 * @param {string|RegExp} expected
 * @param {{label: string, hint: string, notCase?: string|null}} options
 */
async function assertValue(world, read, expected, { label, hint, notCase }) {
  const limit = Date.now() + budget(world);
  const matches = (value) => (expected instanceof RegExp ? expected.test(value) : value === String(expected));
  let value = '';
  for (;;) {
    value = clean(await read().catch(() => ''));
    if (matches(value) !== Boolean(notCase)) return value;
    if (Date.now() > limit) break;
    await world.page.waitForTimeout(150);
  }
  const wanted = expected instanceof RegExp ? String(expected) : `"${expected}"`;
  throw friendly({
    message: notCase ? `Expected ${label} not to be ${wanted}, but it is.` : `Expected ${label} to be ${wanted}, but found "${value}".`,
    hint,
  });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * An account of the `users` registry in cucumber.js (`worldParameters.users`).
 * Admin accounts carry `username`, customers carry `email`.
 *
 * @param {object} world
 * @param {string} handle
 * @param {'admin'|'customer'} kind
 * @returns {{login: string, password: string, name: string}}
 */
function resolveUser(world, handle, kind) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  const key = kind === 'customer' ? 'email' : 'username';
  const known = Object.keys(users).filter((name) => users[name] && users[name][key]);
  if (!entry || !entry[key]) {
    throw friendly({
      message: `"${handle}" is not ${kind === 'customer' ? 'a customer' : 'an admin user'} of the users registry. Known: ${known.join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: ${handle}: { ${key}: '...', password: process.env.${handle.toUpperCase()}_PASSWORD }. The account itself is created once by the site build script, never by a feature.`,
    });
  }
  if (!entry.password) {
    throw friendly({
      message: `The user "${handle}" has no password in the users registry.`,
      hint: `Set worldParameters.users.${handle}.password in cucumber.js, from an environment variable.`,
    });
  }
  return { login: entry[key], password: entry.password, name: entry.name || '' };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_TYPES = ['success', 'error', 'warning', 'notice'];

/**
 * The messages of the page: `#messages .message` in the admin panel,
 * `.page.messages .message` on the storefront (rendered there by KnockoutJS
 * from the messages cookie and section), optionally of one type and with a
 * text.
 *
 * @param {object} world
 * @param {string} [type] success, error, warning or notice
 * @param {string} [text]
 * @returns {import('playwright').Locator}
 */
function messages(world, type, text) {
  const kind = type ? '.message-' + String(type).toLowerCase() : '';
  // `.login-content .messages` is the message area of the admin sign-in page, which has no `#messages`.
  let locator = world.page.locator(`#messages .message${kind}, .login-content .messages .message${kind}, .page.messages .message${kind}, .column.main > .message${kind === '.message-notice' ? '.notice' : kind}`);
  if (text !== undefined && text !== null && text !== '') locator = locator.filter({ hasText: literal(text) });
  return locator;
}

/**
 * The text of every message on the page, for a failure message.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function messagesSeen(world) {
  const texts = await world.page.locator('#messages .message, .login-content .messages .message, .page.messages .message, .column.main > .message').allInnerTexts().catch(() => []);
  return texts.length ? texts.map((text) => `"${clean(text)}"`).join(', ') : 'no message';
}

// ---------------------------------------------------------------------------
// Confirmation dialogs
// ---------------------------------------------------------------------------

/**
 * The open dialog of the page (`.modal-popup._show`).
 *
 * @param {object} world
 * @returns {import('playwright').Locator}
 */
function dialog(world) {
  return world.page.locator('.modal-popup._show').last();
}

/**
 * Press OK (or Cancel) in the open confirmation dialog and wait for what
 * follows.
 *
 * @param {object} world
 * @param {boolean} accept
 */
async function answerDialog(world, accept) {
  const box = dialog(world);
  try {
    await box.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({
      message: 'No confirmation dialog is open.',
      hint: 'The dialog opens after an action that asks "Are you sure…?" (Delete, Cancel an order, a grid action).',
    });
  }
  const button = box.locator(accept ? 'button.action-accept' : 'button.action-dismiss').first();
  await actAndSettle(world, () => button.click({ noWaitAfter: true }));
}

// ---------------------------------------------------------------------------
// Admin panel: session and pages
// ---------------------------------------------------------------------------

// The named admin pages, by the name of their menu item. The value is the route
// after the admin path.
const ADMIN_PAGES = {
  'dashboard': 'admin/dashboard',
  'orders': 'sales/order',
  'invoices': 'sales/invoice',
  'shipments': 'sales/shipment',
  'credit memos': 'sales/creditmemo',
  'products': 'catalog/product',
  'new product': 'catalog/product/new/set/4/type/simple',
  'categories': 'catalog/category',
  'customers': 'customer/index',
  'customer groups': 'customer/group',
  'cart price rules': 'sales_rule/promo_quote',
  'new cart price rule': 'sales_rule/promo_quote/new',
  'catalog price rules': 'catalog_rule/promo_catalog',
  'newsletter subscribers': 'newsletter/subscriber',
  'reviews': 'review/product/index',
  'pending reviews': 'review/product/pending',
  'pages': 'cms/page',
  'new page': 'cms/page/new',
  'blocks': 'cms/block',
  'configuration': 'admin/system_config',
  'cache management': 'admin/cache',
  'index management': 'indexer/indexer/list',
  'users': 'admin/user',
  'roles': 'admin/user_role',
  'product attributes': 'catalog/product_attribute',
  'order statuses': 'sales/order_status',
  'my account': 'admin/system_account/index',
};

/**
 * The route of a named admin page. A name that is not in the table but looks
 * like a route ("sales/order", "cms/page/new") is used as it is.
 *
 * @param {string} name
 * @returns {string}
 */
function adminRoute(name) {
  const key = clean(name).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ADMIN_PAGES, key)) return ADMIN_PAGES[key];
  if (/^[a-z0-9_]+(\/[A-Za-z0-9_=.-]+)+\/?$/.test(clean(name))) return clean(name);
  throw friendly({
    message: `"${name}" is not a known admin page.`,
    hint: `Use one of: ${Object.keys(ADMIN_PAGES).join(', ')}; or a route such as "sales/order".`,
  });
}

/**
 * The username shown in the admin header, or '' when nobody is signed in.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function adminUser(world) {
  const name = world.page.locator('.admin-user .admin-user-account-text');
  if (!(await name.count())) return '';
  return clean(await name.first().textContent());
}

/**
 * Fail with a hint when the admin sign-in form shows instead of a page.
 *
 * @param {object} world
 * @param {string} what
 */
async function requireAdminSession(world, what) {
  if (await world.page.locator('body.adminhtml-auth-login').count()) {
    throw friendly({
      message: `The admin sign-in form is showing instead of "${what}": nobody is logged in to the admin panel.`,
      hint: 'Add `Given I am logged in to the admin panel as "admin"` before this step.',
    });
  }
}

/**
 * Open an admin page by route and make sure a session is there.
 *
 * @param {object} world
 * @param {string} route
 * @param {string} what
 */
async function openAdmin(world, route, what) {
  await open(world, adminUrl(world, route));
  await requireAdminSession(world, what || route);
}

// ---------------------------------------------------------------------------
// Admin grids
// ---------------------------------------------------------------------------
//
// The admin panel has two kinds of grid:
//   "ui"      the UI-component listing (products, orders, customers, pages):
//             `.admin__data-grid-outer-wrap` with a toolbar (keyword search,
//             Filters panel, Actions, pager) and `tr.data-row` rows. It keeps a
//             hidden copy of its header and of its table head in
//             `.sticky-header`, FIRST in the DOM: every lookup goes through the
//             direct children of the visible wrapper.
//   "legacy"  the older grid (cart price rules, reviews, subscribers, cache,
//             index): `table.data-grid` with a filter row, "Search" and "Reset
//             Filter" buttons and a mass-action select.
// Both remember their filters for the admin user between visits.

/**
 * The grid of the page.
 *
 * @param {object} world
 * @returns {Promise<{kind: string, wrap: import('playwright').Locator, header: import('playwright').Locator, table: import('playwright').Locator, rows: import('playwright').Locator}>}
 */
async function grid(world) {
  const page = world.page;
  await settle(world);
  const ui = page.locator('.admin__data-grid-outer-wrap:visible').first();
  if (await ui.count()) {
    const table = ui.locator(':scope > .admin__data-grid-wrap > table.data-grid');
    return { kind: 'ui', wrap: ui, header: ui.locator(':scope > .admin__data-grid-header'), table, rows: table.locator('tbody tr.data-row') };
  }
  const table = page.locator('table.data-grid:visible').first();
  if (await table.count()) {
    const wrap = table.locator('xpath=ancestor::*[@data-grid-id or contains(concat(" ", normalize-space(@class), " "), " admin__scope-old ") or @id="container"][1]');
    return { kind: 'legacy', wrap, header: wrap.locator('.admin__data-grid-header').first(), table, rows: table.locator('tbody tr:not(.data-grid-tr-no-data)') };
  }
  throw friendly({
    message: 'There is no grid on this page.',
    hint: 'Open a list page first, for example `When I go to the "products" admin page`.',
  });
}

/**
 * The column titles of a grid, in order (one entry per cell of the head row).
 *
 * @param {{table: import('playwright').Locator}} g
 * @returns {Promise<string[]>}
 */
async function gridColumns(g) {
  return g.table.locator('thead tr').first().locator('th').evaluateAll((cells) => cells.map((cell) => {
    const own = cell.querySelector('.data-grid-cell-content, span[data-sort], a span, span') || cell;
    return (own.textContent || '').replace(/\s+/g, ' ').trim();
  }));
}

/**
 * The index of a column by its title.
 *
 * @param {{table: import('playwright').Locator}} g
 * @param {string} title
 * @returns {Promise<number>}
 */
async function gridColumnIndex(g, title) {
  const columns = await gridColumns(g);
  const wanted = clean(title).toLowerCase();
  const index = columns.findIndex((column) => column.toLowerCase() === wanted);
  if (index === -1) {
    throw friendly({
      message: `The grid has no "${title}" column. Its columns: ${columns.filter(Boolean).join(', ')}.`,
      hint: 'Use the column title as the grid shows it; a hidden column is added with the "Columns" button of the grid.',
    });
  }
  return index;
}

/**
 * The rows of a grid that contain a text.
 *
 * @param {{rows: import('playwright').Locator}} g
 * @param {string} text
 * @returns {import('playwright').Locator}
 */
function gridRows(g, text) {
  return g.rows.filter({ hasText: literal(text) });
}

/**
 * What the grid shows, for a failure message.
 *
 * @param {{rows: import('playwright').Locator}} g
 * @returns {Promise<string>}
 */
async function gridSeen(g) {
  const texts = await g.rows.allInnerTexts().catch(() => []);
  if (!texts.length) return 'an empty grid';
  return `${texts.length} row(s): ` + texts.slice(0, 5).map((text) => `"${clean(text).slice(0, 80)}"`).join(', ') + (texts.length > 5 ? ', …' : '');
}

/**
 * Remove every filter of the grid (the keyword too), when one is set.
 *
 * @param {object} world
 */
async function clearGrid(world) {
  const g = await grid(world);
  if (g.kind === 'ui') {
    const clear = g.header.locator('.admin__data-grid-filters-current._show button.action-clear');
    if (await clear.count() && await clear.first().isVisible()) {
      await clear.first().click();
      await settle(world);
    }
    return;
  }
  const reset = g.wrap.locator('button[data-action="grid-filter-reset"]').first();
  const filled = await g.table.locator('thead tr.data-grid-filters').locator('input[type="text"], select').evaluateAll((controls) => controls.some((control) => control.value !== ''));
  if (filled && await reset.count()) {
    await actAndSettle(world, () => reset.click({ noWaitAfter: true }));
  }
}

/**
 * Run an action that changes what a UI grid remembers for the admin user (its
 * page size, its sorting, its page) and wait until the grid has saved it. The
 * grid posts its state to `mui/bookmark/save` about two seconds after a
 * change: a scenario that ends before that leaves the old state behind for the
 * next one.
 *
 * @param {object} world
 * @param {Function} action
 */
async function actAndSaveGridState(world, action) {
  const saved = world.page.waitForResponse((response) => /\/mui\/bookmark\/save/.test(response.url()), { timeout: 6000 }).catch(() => null);
  await action();
  await settle(world);
  await saved;
  await settle(world);
}

/**
 * Search a UI grid by keyword.
 *
 * @param {object} world
 * @param {string} keyword
 */
async function searchGrid(world, keyword) {
  const g = await grid(world);
  if (g.kind !== 'ui') {
    throw friendly({
      message: 'This grid has no keyword search.',
      hint: 'Filter it by a column instead: `When I filter the grid by "Rule" with "…"`.',
    });
  }
  const box = g.header.getByRole('textbox', { name: 'Search by keyword' }).first();
  await box.fill(keyword);
  await box.press('Enter');
  await settle(world);
}

/**
 * Filter a grid by one field: the Filters panel of a UI grid (field by its
 * label), the filter row of a legacy grid (field under the column title).
 *
 * @param {object} world
 * @param {string} label
 * @param {string} value
 */
async function filterGrid(world, label, value) {
  const g = await grid(world);
  if (g.kind === 'ui') {
    const panel = g.header.locator('.admin__data-grid-filters-wrap');
    if (!/(^|\s)_show(\s|$)/.test((await panel.getAttribute('class')) || '')) {
      await g.header.locator('button[data-action="grid-filter-expand"]').click();
      await panel.locator('.admin__data-grid-filters-footer').waitFor({ state: 'visible', timeout: budget(world) });
    }
    const field = panel.locator('.admin__form-field').filter({ has: world.page.locator('label, legend', { hasText: exactly(label) }) }).last();
    if (!(await field.count())) {
      const labels = await panel.locator('.admin__form-field > label, .admin__form-field > legend').allInnerTexts();
      throw friendly({
        message: `The grid has no "${label}" filter. Its filters: ${[...new Set(labels.map(clean).filter(Boolean))].join(', ')}.`,
        hint: 'Use the label of the field as the Filters panel shows it.',
      });
    }
    const control = field.locator('select, input[type="text"]').first();
    if ((await control.evaluate((el) => el.tagName)) === 'SELECT') {
      await control.selectOption({ label: value });
    } else {
      await control.fill(value);
      await control.dispatchEvent('change');
    }
    await panel.locator('button[data-action="grid-filter-apply"]').click();
    await settle(world);
    return;
  }
  const index = await gridColumnIndex(g, label);
  const cell = g.table.locator('thead tr.data-grid-filters > *').nth(index);
  const control = cell.locator('select, input[type="text"]').first();
  if (!(await control.count())) {
    throw friendly({
      message: `The "${label}" column of this grid cannot be filtered.`,
      hint: 'Filter by another column.',
    });
  }
  if ((await control.evaluate((el) => el.tagName)) === 'SELECT') {
    await control.selectOption({ label: value });
  } else {
    await control.fill(value);
  }
  await actAndSettle(world, () => g.wrap.locator('button[data-action="grid-filter-apply"]').first().click({ noWaitAfter: true }));
}

/**
 * Tick the checkbox of the rows that contain a text.
 *
 * @param {object} world
 * @param {string} text
 * @returns {Promise<number>} how many rows were ticked
 */
async function selectGridRows(world, text) {
  const g = await grid(world);
  const rows = gridRows(g, text);
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const box = rows.nth(i).locator('input[type="checkbox"]').first();
    await box.check();
  }
  return count;
}

/**
 * Run an action of the grid's "Actions" control on the ticked rows. A nested
 * action is written "Change status > Disable".
 *
 * @param {object} world
 * @param {string} action
 */
async function runGridAction(world, action) {
  const g = await grid(world);
  const path = String(action).split('>').map(clean);
  if (g.kind === 'ui') {
    const wrap = g.header.locator('.action-select-wrap').filter({ has: world.page.locator(':scope > button.action-select') }).first();
    await wrap.locator(':scope > button.action-select').click();
    let scope = wrap.locator('.action-menu-items > ul.action-menu');
    for (let i = 0; i < path.length; i += 1) {
      const item = scope.locator(':scope > li').filter({ has: world.page.locator(':scope > .action-menu-item', { hasText: exactly(path[i]) }) }).first();
      if (!(await item.count())) {
        const all = await scope.locator(':scope > li > .action-menu-item').allInnerTexts();
        throw friendly({
          message: `The grid has no "${path[i]}" action. Its actions: ${all.map(clean).join(', ')}.`,
          hint: 'Write a nested action as "Change status > Disable".',
        });
      }
      const last = i === path.length - 1;
      if (last) await actAndSettle(world, () => item.locator(':scope > .action-menu-item').click({ noWaitAfter: true }));
      else await item.locator(':scope > .action-menu-item').click();
      scope = item.locator(':scope > ul.action-submenu');
    }
    return;
  }
  const select = g.wrap.locator('select[id$="_massaction-select"]').first();
  if (!(await select.count())) {
    throw friendly({ message: 'This grid has no "Actions" control.', hint: 'Open the row and use the buttons of its page instead.' });
  }
  await select.selectOption({ label: path[0] });
  await actAndSettle(world, () => g.wrap.locator('[id$="_massaction"] button', { hasText: /Submit/ }).first().click({ noWaitAfter: true }));
}

/**
 * Open the row that contains a text: its "Edit" or "View" link, the "Edit"
 * entry of its "Select" menu, or the row itself in a legacy grid.
 *
 * @param {object} world
 * @param {string} text
 */
async function openGridRow(world, text) {
  const g = await grid(world);
  const row = gridRows(g, text).first();
  if (!(await row.count())) {
    throw friendly({
      message: `The grid has no row with "${text}". It shows ${await gridSeen(g)}.`,
      hint: 'Search or filter the grid for the row first; a grid shows 20 rows a page.',
    });
  }
  const direct = row.locator('td.data-grid-actions-cell > a.action-menu-item, td a', { hasText: /^\s*(Edit|View)\s*$/ }).first();
  if (await direct.count() && await direct.isVisible()) {
    await actAndSettle(world, () => direct.click({ noWaitAfter: true }));
    return;
  }
  const menu = row.locator('button.action-select').first();
  if (await menu.count()) {
    await menu.click();
    await actAndSettle(world, () => row.locator('a[data-action="item-edit"], ul.action-menu a.action-menu-item').first().click({ noWaitAfter: true }));
    return;
  }
  await actAndSettle(world, () => row.locator('td', { hasText: literal(text) }).first().click({ noWaitAfter: true }));
}

// ---------------------------------------------------------------------------
// Admin forms
// ---------------------------------------------------------------------------
//
// A form field is an `.admin__field` with its label in `.admin__field-label`.
// The label is NOT always the accessible name of the control (several selects
// carry `aria-label="notice-…"`), so a field is found by the label text of its
// wrapper. The forms are KnockoutJS models that read an input on its `change`
// event: a value is filled, `change` is dispatched and the value is read back.

/**
 * The form field with a label.
 *
 * @param {object} world
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function formField(world, label) {
  const page = world.page;
  const text = quoted(clean(label));
  const selector = [
    `.admin__field:has(> .admin__field-label :text-is(${text}))`,
    `.admin__field:has(> label.admin__field-label:text-is(${text}))`,
    `.admin__field:has(> .admin__field-label:text-is(${text}))`,
    `.admin__field:has(> legend.admin__field-label :text-is(${text}))`,
  ].join(', ');
  const fields = page.locator(selector);
  try {
    await fields.first().waitFor({ state: 'attached', timeout: budget(world) });
  } catch {
    const labels = await page.locator('.admin__field:visible > .admin__field-label').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The form has no "${label}" field. Visible fields: ${[...new Set(labels.map(clean).filter(Boolean))].slice(0, 30).join(', ') || '(none)'}.`,
      hint: 'A field of a closed section is not visible: open the section first (`When I open the "…" form section`).',
    });
  }
  const count = await fields.count();
  for (let i = 0; i < count; i += 1) {
    if (await fields.nth(i).isVisible()) return fields.nth(i);
  }
  throw friendly({
    message: `The "${label}" field is in the form but not visible.`,
    hint: 'Open its section or tab first (`When I open the "…" form section`, `When I open the "…" admin tab`).',
  });
}

/**
 * The control of a form field (the first input, select or textarea that is not
 * hidden).
 *
 * @param {import('playwright').Locator} field
 * @returns {import('playwright').Locator}
 */
function formControl(field) {
  return field.locator('input:not([type="hidden"]):not([type="file"]), select, textarea').first();
}

/**
 * Set a form field: text, select (by option text) or switch/checkbox
 * ("Yes"/"No"). The value is read back; a model that did not take it fails the
 * step.
 *
 * @param {object} world
 * @param {string} label
 * @param {string} value
 */
async function setFormField(world, label, value) {
  const field = await formField(world, label);
  const control = formControl(field);
  const info = await control.evaluate((el) => ({ tag: el.tagName, type: (el.getAttribute('type') || '').toLowerCase(), multiple: Boolean(el.multiple) }));
  if (info.tag === 'SELECT') {
    const labels = info.multiple ? String(value).split(',').map(clean).map((item) => ({ label: item })) : { label: value };
    await actOrExplain('select', `${value} in ${label}`, () => control.selectOption(labels, { timeout: budget(world) }), `Check the option texts of the "${label}" field.`);
    return;
  }
  if (info.type === 'checkbox' || info.type === 'radio') {
    const on = /^(yes|on|true|1|enabled|checked)$/i.test(clean(value));
    if ((await control.isChecked()) !== on) {
      const toggle = field.locator('label.admin__actions-switch-label, label[for]').last();
      if (await toggle.count()) await toggle.click();
      else await control.setChecked(on, { force: true });
    }
    if ((await control.isChecked()) !== on) {
      throw friendly({ message: `The "${label}" switch did not turn ${on ? 'on' : 'off'}.`, hint: 'The switch may be disabled for this record or scope.' });
    }
    return;
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await control.fill(String(value));
    await control.dispatchEvent('change');
    await control.blur();
    if ((await control.inputValue()) === String(value)) return;
  }
  throw friendly({
    message: `The "${label}" field holds "${await control.inputValue()}" after filling it with "${value}".`,
    hint: 'The form rewrote the value (a mask, a length limit or a value copied from another field).',
  });
}

/**
 * Open (or close) a collapsible section of a form by its title.
 *
 * @param {object} world
 * @param {string} title
 * @param {boolean} open
 */
async function toggleFormSection(world, title, open) {
  const page = world.page;
  // The title element also holds two hidden tooltips ("Changes have been made to this section…"): the name is its first span.
  const section = page.locator('.fieldset-wrapper, .admin__collapsible-block-wrapper').filter({ has: page.locator(':scope > .fieldset-wrapper-title .admin__collapsible-title > span:first-child, :scope > .fieldset-wrapper-title > .title', { hasText: exactly(title) }) }).last();
  try {
    await section.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    const titles = await page.locator('.fieldset-wrapper:visible > .fieldset-wrapper-title').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The form has no "${title}" section. Its sections: ${titles.map(clean).filter(Boolean).join(', ') || '(none)'}.`,
      hint: 'Use the section title as the form shows it.',
    });
  }
  const isOpen = async () => /(^|\s)_show(\s|$)/.test((await section.getAttribute('class')) || '');
  if ((await isOpen()) !== open) {
    await section.locator(':scope > .fieldset-wrapper-title').click();
    const limit = Date.now() + budget(world);
    while ((await isOpen()) !== open && Date.now() < limit) await page.waitForTimeout(100);
  }
  await settle(world);
}

module.exports = {
  budget,
  escapeRegExp,
  literal,
  exactly,
  clean,
  quoted,
  siteRoot,
  siteUrl,
  adminPath,
  adminUrl,
  settle,
  open,
  actAndSettle,
  actOrExplain,
  assertPresence,
  assertValue,
  resolveUser,
  MESSAGE_TYPES,
  messages,
  messagesSeen,
  dialog,
  answerDialog,
  ADMIN_PAGES,
  adminRoute,
  adminUser,
  requireAdminSession,
  openAdmin,
  grid,
  gridColumns,
  gridColumnIndex,
  gridRows,
  gridSeen,
  clearGrid,
  actAndSaveGridState,
  searchGrid,
  filterGrid,
  selectGridRows,
  runGridAction,
  openGridRow,
  formField,
  formControl,
  setFormField,
  toggleFormSection,
};
