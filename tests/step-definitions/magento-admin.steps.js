'use strict';

// Admin panel step definitions: the session (log in by account handle, log
// out, who is logged in), named pages and the page title, the menu, the access
// denied page, the grids (keyword search, filters, sorting, paging, row
// selection, actions, cell values), the forms (fields by label, switches,
// sections, tabs, field errors, save) and the page buttons.
//
// Content-specific steps (catalog, orders, customers, configuration, cache and
// index, clean-up) are in magento-admin-content.steps.js.
//
// The selectors come from the pages as a browser shows them; see
// exploration/01…05 in the repository.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  literal,
  exactly,
  quoted,
  adminUrl,
  settle,
  open,
  actAndSettle,
  actOrExplain,
  assertPresence,
  assertValue,
  resolveUser,
  adminRoute,
  adminUser,
  requireAdminSession,
  openAdmin,
  grid,
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
} = require('./magento-helpers');

const SESSION_HINT = 'The admin accounts are named in worldParameters.users of cucumber.js and created by the site build script. Two-factor authentication and the CAPTCHA must be off on a test site.';
const GRID_HINT = 'Open the list page first (`When I go to the "products" admin page`); a grid opened by that step starts without filters.';

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Sign in on the admin sign-in form with a username and a password, without
 * asserting the result.
 *
 * @param {object} world
 * @param {string} username
 * @param {string} password
 */
async function submitAdminLogin(world, username, password) {
  const page = world.page;
  await open(world, adminUrl(world, ''));
  const current = await adminUser(world);
  if (current) {
    await open(world, adminUrl(world, 'admin/auth/logout'));
  }
  await actOrExplain('fill in the admin sign-in form', username, async () => {
    await page.locator('#username').fill(username, { timeout: budget(world) });
    await page.locator('#login').fill(password);
  }, 'The sign-in form (`#username`, `#login`) did not show: check `adminPath` in cucumber.js against the admin address of the site.');
  await actAndSettle(world, () => page.locator('.action-login').click());
}

/**
 * Log in to the admin panel as an account of the users registry in cucumber.js
 * (`worldParameters.users`), by its handle. A session of the same user is
 * reused; another user is logged out first. The step ends when the admin
 * header shows the username: an account with a restricted role does not land
 * on the Dashboard.
 *
 * Example #1: Given I am logged in to the admin panel as "admin"
 * Example #2: Given I am logged in to the admin panel as "sales"
 * Example #3: When I log in to the admin panel as "admin"
 * Example #4: Given we are logged in to the admin panel as "admin"
 * Example #5: When we log in to the admin panel as "sales"
 *
 */
Given(/^(?:(?:I am |we are )+logged in|(?:I |we )*log in) to the admin panel as "([^"]*)"$/, async function (handle) {
  const account = resolveUser(this, handle, 'admin');
  await open(this, adminUrl(this, ''));
  if ((await adminUser(this)) === account.login) return;
  await submitAdminLogin(this, account.login, account.password);
  const name = await adminUser(this);
  if (name !== account.login) {
    const error = clean(await this.page.locator('.message-error').first().innerText().catch(() => ''));
    throw friendly({
      message: `Could not log in to the admin panel as "${handle}" (${account.login}).` + (error ? ` The page says: "${error}".` : ''),
      hint: SESSION_HINT,
    });
  }
});

/**
 * Submit the admin sign-in form with a username and a password, for the
 * scenarios that check a refused sign-in. Nothing is asserted: follow it with a
 * message or a session assertion.
 *
 * Example #1: When I log in to the admin panel with the username "admin" and the password "wrong-password"
 * Example #2: When I log in to the admin panel with the username "nobody" and the password "Secret123456789!"
 * Example #3: And I log in to the admin panel with the username "sales" and the password "wrong"
 * Example #4: When we log in to the admin panel with the username "admin" and the password "wrong-password"
 * Example #5: When log in to the admin panel with the username "admin" and the password ""
 *
 */
When(/^(I |we )*log in to the admin panel with the username "([^"]*)" and the password "([^"]*)"$/, async function (pronounCase, username, password) {
  await submitAdminLogin(this, username, password);
});

/**
 * Log out of the admin panel through the account menu of the header.
 *
 * Example #1: When I log out of the admin panel
 * Example #2: And I log out of the admin panel
 * Example #3: When we log out of the admin panel
 * Example #4: When log out of the admin panel
 * Example #5: And we log out of the admin panel
 *
 */
When(/^(I |we )*log out of the admin panel$/, async function (pronounCase) {
  const page = this.page;
  if (!(await adminUser(this))) {
    await open(this, adminUrl(this, ''));
    if (!(await adminUser(this))) {
      throw friendly({ message: 'Nobody is logged in to the admin panel, so there is nothing to log out of.', hint: 'Log in first: `Given I am logged in to the admin panel as "admin"`.' });
    }
  }
  await actOrExplain('log out of', 'the admin panel', async () => {
    await page.locator('.admin-user .admin__action-dropdown').click();
    await actAndSettle(this, () => page.locator('.admin-user a.account-signout').click());
  }, 'The account menu of the admin header (`.admin-user`) holds the "Sign Out" link.');
});

/**
 * Make sure nobody is logged in to the admin panel (logs out when somebody
 * is).
 *
 * Example #1: Given I am not logged in to the admin panel
 * Example #2: Given we are not logged in to the admin panel
 * Example #3: And I am not logged in to the admin panel
 * Example #4: Given am not logged in to the admin panel
 * Example #5: And we are not logged in to the admin panel
 *
 */
Given(/^(I |we )*(?:am|are) not logged in to the admin panel$/, async function (pronounCase) {
  await open(this, adminUrl(this, ''));
  if (await adminUser(this)) await open(this, adminUrl(this, 'admin/auth/logout'));
});

/**
 * Assert somebody is (or nobody is) logged in to the admin panel, optionally
 * which account of the users registry.
 *
 * Example #1: Then I should be logged in to the admin panel
 * Example #2: Then I should not be logged in to the admin panel
 * Example #3: Then I should be logged in to the admin panel as "admin"
 * Example #4: Then we should be logged in to the admin panel as "sales"
 * Example #5: And I should not be logged in to the admin panel as "sales"
 *
 */
Then(/^(I |we )*should( not)* be logged in to the admin panel(?: as "([^"]*)")?$/, async function (pronounCase, notCase, handle) {
  await settle(this);
  const name = await adminUser(this);
  const wanted = handle ? resolveUser(this, handle, 'admin').login : null;
  const holds = wanted ? name === wanted : name !== '';
  if (holds === Boolean(notCase)) {
    throw friendly({
      message: notCase
        ? `Expected ${wanted ? `"${wanted}" not to be logged in` : 'nobody to be logged in'} to the admin panel, but the header shows "${name}".`
        : `Expected ${wanted ? `"${wanted}"` : 'somebody'} to be logged in to the admin panel, but ${name ? `the header shows "${name}"` : 'nobody is (the page has no admin header)'}.`,
      hint: 'The admin header shows the username in `.admin-user-account-text`. ' + SESSION_HINT,
    });
  }
});

// ---------------------------------------------------------------------------
// Pages, title, menu, access denied
// ---------------------------------------------------------------------------

/**
 * Open an admin page by the name of its menu item ("products", "orders",
 * "customers", "cart price rules", "pages", "cache management", …) or by its
 * route ("sales/order"). A grid on the page starts without the filters the
 * admin user left behind.
 *
 * Example #1: When I go to the "products" admin page
 * Example #2: Given I am on the "orders" admin page
 * Example #3: When I go to the "cart price rules" admin page
 * Example #4: When we go to the "cache management" admin page
 * Example #5: Given we are on the "sales/invoice" admin page
 *
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the "([^"]*)" admin page$/, async function (name) {
  await openAdmin(this, adminRoute(name), name);
  if (await this.page.locator('.admin__data-grid-outer-wrap:visible, table.data-grid:visible').count()) {
    await clearGrid(this);
  }
});

/**
 * Assert the heading of the admin page (`h1.page-title`): "Products",
 * "New Product", "#000000003".
 *
 * Example #1: Then the admin page title should be "Products"
 * Example #2: Then the admin page title should be "New Product"
 * Example #3: And the admin page title should be "Cache Management"
 * Example #4: Then the admin page title should not be "Dashboard"
 * Example #5: Then the admin page title should be "Customers"
 *
 */
Then(/^the admin page title should( not)* be "([^"]*)"$/, async function (notCase, title) {
  await settle(this);
  await requireAdminSession(this, title);
  await assertValue(this, () => this.page.locator('h1.page-title').first().innerText(), title, {
    label: 'the admin page title',
    notCase,
    hint: 'The title is the `h1.page-title` of the page. On the access denied page it is "Magento Admin" only in the browser tab; assert `I should see the access denied page` there.',
  });
});

/**
 * The top-level entry of the admin menu with a name.
 *
 * @param {object} world
 * @param {string} name
 * @returns {import('playwright').Locator}
 */
function menuTop(world, name) {
  return world.page.locator('nav.admin__menu li.level-0').filter({ has: world.page.locator(':scope > a', { hasText: exactly(name) }) });
}

/**
 * Assert a top-level entry (or, with a path "Sales > Orders", an item) is, or
 * is not, in the admin menu. The menu holds only what the role of the user
 * allows.
 *
 * Example #1: Then I should see the "Sales" admin menu
 * Example #2: Then I should not see the "Catalog" admin menu
 * Example #3: Then I should see the "Sales > Orders" admin menu
 * Example #4: And I should not see the "Stores > Configuration" admin menu
 * Example #5: Then we should see the "Catalog > Products" admin menu
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" admin menu$/, async function (pronounCase, notCase, path) {
  await settle(this);
  await requireAdminSession(this, 'the admin menu');
  const parts = path.split('>').map(clean);
  const top = menuTop(this, parts[0]);
  let found = (await top.count()) > 0;
  if (found && parts.length > 1) {
    // The items of a closed panel are in the DOM but not rendered: read them by text content.
    const items = await top.first().locator('.submenu a').evaluateAll((links) => links.map((link) => (link.textContent || '').replace(/\s+/g, ' ').trim()));
    found = items.some((item) => item.toLowerCase() === parts[parts.length - 1].toLowerCase());
  }
  if (found === Boolean(notCase)) {
    const tops = await this.page.locator('nav.admin__menu li.level-0 > a').evaluateAll((links) => links.map((link) => (link.textContent || '').replace(/\s+/g, ' ').trim()));
    throw friendly({
      message: notCase ? `Expected the admin menu not to hold "${path}", but it does.` : `Expected the admin menu to hold "${path}". Its top-level entries: ${tops.join(', ') || '(none)'}.`,
      hint: 'The menu shows what the role of the logged-in user allows. Write an item as "Sales > Orders".',
    });
  }
});

/**
 * Open an item of the admin menu the way a person does: click the top-level
 * entry, then the item of its panel ("Catalog > Products",
 * "Marketing > Cart Price Rules"). "Dashboard" is a direct link.
 *
 * Example #1: When I open the "Catalog > Products" admin menu item
 * Example #2: When I open the "Sales > Orders" admin menu item
 * Example #3: And I open the "Customers > All Customers" admin menu item
 * Example #4: When we open the "Content > Pages" admin menu item
 * Example #5: When I open the "Dashboard" admin menu item
 *
 */
When(/^(I |we )*open the "([^"]*)" admin menu item$/, async function (pronounCase, path) {
  await settle(this);
  await requireAdminSession(this, 'the admin menu');
  const parts = path.split('>').map(clean);
  const top = menuTop(this, parts[0]).first();
  await actOrExplain('open the admin menu item', path, async () => {
    await top.waitFor({ state: 'visible', timeout: budget(this) });
    if (parts.length === 1) {
      await actAndSettle(this, () => top.locator(':scope > a').click());
      return;
    }
    await top.locator(':scope > a').click();
    const item = top.locator('.submenu a').filter({ hasText: exactly(parts[parts.length - 1]) }).first();
    await item.waitFor({ state: 'visible', timeout: budget(this) });
    await actAndSettle(this, () => item.click());
  }, 'Write the path as the menu shows it: "Catalog > Products". The menu holds only what the role of the user allows.');
});

/**
 * Assert the admin panel shows (or does not show) its access denied page
 * ("Sorry, you need permissions to view this content."), which it serves with
 * the status 403 to a user whose role does not allow the page.
 *
 * Example #1: Then I should see the access denied page
 * Example #2: Then I should not see the access denied page
 * Example #3: And I should see the access denied page
 * Example #4: Then we should see the access denied page
 * Example #5: And we should not see the access denied page
 *
 */
Then(/^(I |we )*should( not)* see the access denied page$/, async function (pronounCase, notCase) {
  await settle(this);
  await requireAdminSession(this, 'the page');
  await assertPresence(this.page.locator('.access-denied-page'), notCase, {
    label: 'the access denied page',
    hint: 'The admin panel shows `.access-denied-page` ("Sorry, you need permissions to view this content.") when the role of the user does not allow the page.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => `the page "${clean(await this.page.locator('h1.page-title, h1').first().innerText().catch(() => ''))}"`,
  });
});

/**
 * Click a button of the page's action bar (`.page-main-actions`: "Add New
 * Page", "Hold", "Delete", "Flush Cache Storage") or of the bar above the
 * category tree ("Add Subcategory") and wait for what follows.
 *
 * Example #1: When I click the "Add New Page" page action
 * Example #2: When I click the "Hold" page action
 * Example #3: And I click the "Add Subcategory" page action
 * Example #4: When we click the "Flush Cache Storage" page action
 * Example #5: When I click the "Back" page action
 *
 */
When(/^(I |we )*click the "([^"]*)" page action$/, async function (pronounCase, name) {
  await settle(this);
  // The action bar of the page, and the buttons above the category tree ("Add Subcategory").
  const bar = this.page.locator('.page-main-actions:visible, .sidebar-actions:visible');
  const button = bar.locator('button:visible').filter({ hasText: exactly(name) }).first();
  if (!(await button.count())) {
    const all = await bar.locator('button:visible').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The page has no "${name}" action button. Its buttons: ${all.map(clean).filter(Boolean).join(', ') || '(none)'}.`,
      hint: 'The buttons depend on the state of the record (an invoiced order has no "Invoice" button) and on the role of the user.',
    });
  }
  await actAndSettle(this, () => button.click());
});

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------

/**
 * Search the grid of the page by keyword (the "Search by keyword" box of a
 * list such as products, orders, customers or pages).
 *
 * Example #1: When I search the grid for "Joust Duffle Bag"
 * Example #2: When I search the grid for "24-MB01"
 * Example #3: And I search the grid for "customer@example.com"
 * Example #4: When we search the grid for "000000003"
 * Example #5: When search the grid for "Home Page"
 *
 */
When(/^(I |we )*search the grid for "([^"]*)"$/, async function (pronounCase, keyword) {
  await searchGrid(this, keyword);
});

/**
 * Filter the grid by one field: a field of the "Filters" panel by its label
 * (a text or an option of a select), or, in an older grid, the filter under
 * the column title.
 *
 * Example #1: When I filter the grid by "Name" with "Tank"
 * Example #2: When I filter the grid by "Type" with "Configurable Product"
 * Example #3: And I filter the grid by "Status" with "Enabled"
 * Example #4: When we filter the grid by "Rule" with "20% OFF"
 * Example #5: When I filter the grid by "SKU" with "24-MB01"
 *
 */
When(/^(I |we )*filter the grid by "([^"]*)" with "([^"]*)"$/, async function (pronounCase, label, value) {
  await filterGrid(this, label, value);
});

/**
 * Remove every filter of the grid, the keyword included ("Clear all", or
 * "Reset Filter" in an older grid).
 *
 * Example #1: When I clear the grid filters
 * Example #2: And I clear the grid filters
 * Example #3: When we clear the grid filters
 * Example #4: When clear the grid filters
 * Example #5: And we clear the grid filters
 *
 */
When(/^(I |we )*clear the grid filters$/, async function (pronounCase) {
  await clearGrid(this);
});

/**
 * Assert how many records the grid found ("19 records found" in its toolbar),
 * over all its pages.
 *
 * Example #1: Then the grid should show 19 records
 * Example #2: Then the grid should show 1 record
 * Example #3: And the grid should show 0 records
 * Example #4: Then the grid should show 2040 records
 * Example #5: Then the grid should show 4 records
 *
 */
Then(/^the grid should show (\d+) records?$/, async function (count) {
  const g = await grid(this);
  await assertValue(this, async () => {
    const text = clean(await g.header.innerText());
    const match = text.match(/(\d+)\s+records? found/i);
    return match ? match[1] : `no "records found" text (toolbar: ${text.slice(0, 80)})`;
  }, String(count), { label: 'the number of records the grid found', hint: GRID_HINT });
});

/**
 * Assert how many rows the grid shows on the current page.
 *
 * Example #1: Then the grid should have 20 rows
 * Example #2: Then the grid should have 1 row
 * Example #3: And the grid should have 50 rows
 * Example #4: Then the grid should have 0 rows
 * Example #5: Then the grid should have 19 rows
 *
 */
Then(/^the grid should have (\d+) rows?$/, async function (count) {
  const g = await grid(this);
  await assertValue(this, async () => String(await g.rows.count()), String(count), { label: 'the number of rows on this page of the grid', hint: GRID_HINT });
});

/**
 * Assert a row with a text is (or is not) in the grid, on the current page.
 *
 * Example #1: Then I should see the "Joust Duffle Bag" grid row
 * Example #2: Then I should not see the "MCP Round Bag" grid row
 * Example #3: And I should see the "customer@example.com" grid row
 * Example #4: Then we should see the "000000003" grid row
 * Example #5: Then should not see the "Test Rule" grid row
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" grid row$/, async function (pronounCase, notCase, text) {
  const g = await grid(this);
  await assertPresence(gridRows(g, text), notCase, {
    label: `a grid row with "${text}"`,
    hint: GRID_HINT + ' Search or filter the grid for the row: it shows 20 rows a page.',
    timeout: notCase ? 3000 : budget(this),
    found: () => gridSeen(g),
  });
});

/**
 * Assert the value of a column in the row that contains a text.
 *
 * Example #1: Then the "Status" column of the "Joust Duffle Bag" grid row should be "Enabled"
 * Example #2: Then the "Price" column of the "24-MB01" grid row should be "$34.00"
 * Example #3: And the "Status" column of the "000000003" grid row should be "Pending"
 * Example #4: Then the "Group" column of the "customer@example.com" grid row should be "General"
 * Example #5: Then the "Status" column of the "Configuration" grid row should not be "INVALIDATED"
 *
 */
Then(/^the "([^"]*)" column of the "([^"]*)" grid row should( not)* be "([^"]*)"$/, async function (column, text, notCase, value) {
  const g = await grid(this);
  const index = await gridColumnIndex(g, column);
  const row = gridRows(g, text).first();
  if (!(await row.count())) {
    throw friendly({ message: `The grid has no row with "${text}". It shows ${await gridSeen(g)}.`, hint: GRID_HINT });
  }
  await assertValue(this, () => row.locator(':scope > td').nth(index).innerText(), value, {
    label: `the "${column}" column of the "${text}" row`,
    notCase,
    hint: 'The value is compared with the whole text of the cell.',
  });
});

/**
 * Sort the grid by a column: one click sorts ascending, a click on the sorted
 * column reverses it. The step clicks until the column has the direction asked
 * for.
 *
 * Example #1: When I sort the grid by "Name" ascending
 * Example #2: When I sort the grid by "Name" descending
 * Example #3: And I sort the grid by "ID" ascending
 * Example #4: When we sort the grid by "Price" descending
 * Example #5: When sort the grid by "SKU" ascending
 *
 */
When(/^(I |we )*sort the grid by "([^"]*)" (ascending|descending)$/, async function (pronounCase, column, direction) {
  const g = await grid(this);
  const index = await gridColumnIndex(g, column);
  const head = g.table.locator('thead tr').first().locator('th').nth(index);
  const wanted = direction === 'ascending' ? '_ascend' : '_descend';
  for (let click = 0; click < 3; click += 1) {
    if (new RegExp(`(^|\\s)${wanted}(\\s|$)`).test((await head.getAttribute('class')) || '')) return;
    if (g.kind === 'ui') await actAndSaveGridState(this, () => head.click());
    else await actAndSettle(this, () => head.click());
  }
  throw friendly({
    message: `The "${column}" column did not sort ${direction}.`,
    hint: 'Only a column with the sort arrows (`th._sortable`) can be sorted.',
  });
});

/**
 * Assert the values of a column on the current page are in order.
 *
 * Example #1: Then the grid should be sorted by "Name" ascending
 * Example #2: Then the grid should be sorted by "Name" descending
 * Example #3: And the grid should be sorted by "SKU" ascending
 * Example #4: Then the grid should be sorted by "ID" descending
 * Example #5: Then the grid should be sorted by "Price" ascending
 *
 */
Then(/^the grid should be sorted by "([^"]*)" (ascending|descending)$/, async function (column, direction) {
  const g = await grid(this);
  const index = await gridColumnIndex(g, column);
  const values = (await g.rows.evaluateAll((rows, i) => rows.map((row) => (row.children[i] ? row.children[i].innerText : '')), index)).map(clean);
  const key = (value) => {
    const number = Number(value.replace(/[$,\s]/g, ''));
    return value !== '' && !Number.isNaN(number) ? number : value.toLowerCase();
  };
  for (let i = 1; i < values.length; i += 1) {
    const a = key(values[i - 1]);
    const b = key(values[i]);
    const ordered = typeof a === 'number' && typeof b === 'number' ? (direction === 'ascending' ? a <= b : a >= b) : (direction === 'ascending' ? String(a).localeCompare(String(b)) <= 0 : String(a).localeCompare(String(b)) >= 0);
    if (!ordered) {
      throw friendly({
        message: `The "${column}" column is not sorted ${direction}: "${values[i - 1]}" comes before "${values[i]}" (rows ${i} and ${i + 1}).`,
        hint: 'Sort the grid first: `When I sort the grid by "…" ascending`.',
      });
    }
  }
  if (values.length < 2) {
    throw friendly({ message: `The grid shows ${values.length} row(s): an order cannot be read from it.`, hint: 'Remove the filters so the grid shows several rows.' });
  }
});

/**
 * Go to a page of the grid: the next one, the previous one or a page by its
 * number.
 *
 * Example #1: When I go to the next page of the grid
 * Example #2: When I go to the previous page of the grid
 * Example #3: When I go to page 5 of the grid
 * Example #4: And we go to page 2 of the grid
 * Example #5: When we go to the next page of the grid
 *
 */
When(/^(I |we )*go to (?:the (next|previous) page|page (\d+)) of the grid$/, async function (pronounCase, direction, number) {
  const g = await grid(this);
  const pager = g.header.locator('.admin__data-grid-pager').first();
  if (direction) {
    const button = pager.locator(direction === 'next' ? '.action-next' : '.action-previous');
    if (await button.isDisabled()) {
      throw friendly({ message: `The grid has no ${direction} page.`, hint: 'The pager button is disabled on the first or the last page.' });
    }
    await actAndSettle(this, () => button.click());
    return;
  }
  const input = pager.locator('input').first();
  await input.fill(String(number));
  if (g.kind === 'ui') await actAndSaveGridState(this, () => input.press('Enter'));
  else await actAndSettle(this, () => input.press('Enter'));
});

/**
 * Assert the page number the grid is on.
 *
 * Example #1: Then the grid should be on page 2
 * Example #2: Then the grid should be on page 1
 * Example #3: And the grid should be on page 5
 * Example #4: Then the grid should be on page 4
 * Example #5: Then the grid should be on page 3
 *
 */
Then(/^the grid should be on page (\d+)$/, async function (number) {
  const g = await grid(this);
  await assertValue(this, () => g.header.locator('.admin__data-grid-pager input').first().inputValue(), String(number), { label: 'the page of the grid', hint: GRID_HINT });
});

/**
 * Set how many rows the grid shows on a page (20, 30, 50, 100 or 200). The
 * grid remembers it for the admin user: set it back at the end of a scenario.
 *
 * Example #1: When I show 50 grid rows per page
 * Example #2: When I show 20 grid rows per page
 * Example #3: And I show 100 grid rows per page
 * Example #4: When we show 30 grid rows per page
 * Example #5: When show 200 grid rows per page
 *
 */
When(/^(I |we )*show (\d+) grid rows per page$/, async function (pronounCase, size) {
  const g = await grid(this);
  if (g.kind !== 'ui') {
    throw friendly({ message: 'This step sets the page size of a list with the "per page" menu; this grid is of the older kind.', hint: 'Filter the older grid by a column instead, so the row is on its first page.' });
  }
  const menu = g.header.locator('.selectmenu').first();
  await menu.locator('.selectmenu-toggle').click();
  const item = menu.locator('button.selectmenu-item-action').filter({ hasText: exactly(String(size)) }).first();
  if (!(await item.count())) {
    throw friendly({ message: `The grid has no "${size}" rows per page choice.`, hint: 'The choices are 20, 30, 50, 100 and 200.' });
  }
  // The grid keeps the page size for the admin user: wait until it is saved.
  await actAndSaveGridState(this, () => item.click());
});

/**
 * Tick the checkbox of the row (or rows) that contain a text, for a grid
 * action.
 *
 * Example #1: When I select the "Joust Duffle Bag" grid row
 * Example #2: When I select the "TEST-SKU-1" grid row
 * Example #3: And I select the "customer@example.com" grid row
 * Example #4: When we select the "000000003" grid row
 * Example #5: When select the "Test review" grid row
 *
 */
When(/^(I |we )*select the "([^"]*)" grid row$/, async function (pronounCase, text) {
  const count = await selectGridRows(this, text);
  if (!count) {
    const g = await grid(this);
    throw friendly({ message: `The grid has no row with "${text}" to select. It shows ${await gridSeen(g)}.`, hint: GRID_HINT });
  }
});

/**
 * Run an action of the grid's "Actions" control on the selected rows
 * ("Delete", "Change status > Disable", "Cancel", "Hold"). An action that asks
 * for a confirmation opens a dialog: follow it with `I confirm the action`.
 *
 * Example #1: When I run the "Delete" grid action
 * Example #2: When I run the "Change status > Disable" grid action
 * Example #3: And I run the "Change status > Enable" grid action
 * Example #4: When we run the "Hold" grid action
 * Example #5: When I run the "Unsubscribe" grid action
 *
 */
When(/^(I |we )*run the "([^"]*)" grid action$/, async function (pronounCase, action) {
  await runGridAction(this, action);
});

/**
 * Open the grid row that contains a text: its "Edit" or "View" link, the
 * "Edit" entry of its "Select" menu, or the row itself in an older grid.
 *
 * Example #1: When I open the "Joust Duffle Bag" grid row
 * Example #2: When I open the "000000003" grid row
 * Example #3: And I open the "customer@example.com" grid row
 * Example #4: When we open the "Home Page" grid row
 * Example #5: When I open the "Test Rule" grid row
 *
 */
When(/^(I |we )*open the "([^"]*)" grid row$/, async function (pronounCase, text) {
  await openGridRow(this, text);
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

/**
 * Fill a field of an admin form, found by its label: a text field, a text
 * area, or a select (the value is the option text; several options of a
 * multi-select are separated by commas). The value is read back, so a field
 * the form did not take fails here and not at Save.
 *
 * Example #1: When I set the "Product Name" form field to "Test Bag"
 * Example #2: When I set the "SKU" form field to "TEST-SKU-1"
 * Example #3: And I set the "Visibility" form field to "Catalog"
 * Example #4: When we set the "Customer Groups" form field to "NOT LOGGED IN, General"
 * Example #5: When I set the "Price" form field to "12.50"
 *
 */
When(/^(I |we )*set the "([^"]*)" form field to "([^"]*)"$/, async function (pronounCase, label, value) {
  await setFormField(this, label, value);
});

/**
 * Turn a switch of an admin form on or off ("Enable Product", "Enable Page",
 * "Active").
 *
 * Example #1: When I turn the "Enable Product" form switch off
 * Example #2: When I turn the "Enable Product" form switch on
 * Example #3: And I turn the "Enable Page" form switch off
 * Example #4: When we turn the "Active" form switch on
 * Example #5: When I turn the "Include in Menu" form switch off
 *
 */
When(/^(I |we )*turn the "([^"]*)" form switch (on|off)$/, async function (pronounCase, label, state) {
  await setFormField(this, label, state === 'on' ? 'yes' : 'no');
});

/**
 * Assert the value of a field of an admin form: the text of a text field, the
 * selected option of a select, "on" or "off" for a switch.
 *
 * Example #1: Then the "SKU" form field should be "TEST-SKU-1"
 * Example #2: Then the "Visibility" form field should be "Catalog, Search"
 * Example #3: And the "Enable Product" form field should be "on"
 * Example #4: Then the "Price" form field should not be "0.00"
 * Example #5: Then the "First Name" form field should be "Casey"
 *
 */
Then(/^the "([^"]*)" form field should( not)* be "([^"]*)"$/, async function (label, notCase, value) {
  const field = await formField(this, label);
  const control = formControl(field);
  await assertValue(this, async () => control.evaluate((el) => {
    if (el.tagName === 'SELECT') return [...el.selectedOptions].map((option) => option.textContent.replace(/\s+/g, ' ').trim()).join(', ');
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'on' : 'off';
    return el.value;
  }), value, { label: `the "${label}" form field`, notCase, hint: 'A switch reads "on" or "off"; a select reads the text of its selected option.' });
});

/**
 * Choose an entry in a searchable tree field of an admin form (the
 * "Categories" field of a product): open it, type the name, tick the entry,
 * press Done.
 *
 * Example #1: When I choose "Bags" in the "Categories" form field
 * Example #2: When I choose "Gear" in the "Categories" form field
 * Example #3: And I choose "Watches" in the "Categories" form field
 * Example #4: When we choose "Tops" in the "Categories" form field
 * Example #5: When choose "Sale" in the "Categories" form field
 *
 */
When(/^(I |we )*choose "([^"]*)" in the "([^"]*)" form field$/, async function (pronounCase, option, label) {
  const field = await formField(this, label);
  const select = field.locator('.admin__action-multiselect-wrap').first();
  if (!(await select.count())) {
    throw friendly({ message: `The "${label}" field is not a searchable select.`, hint: 'Use `I set the "…" form field to "…"` for a plain field.' });
  }
  await actOrExplain('choose', `${option} in ${label}`, async () => {
    if (!/(^|\s)_active(\s|$)/.test((await select.getAttribute('class')) || '')) {
      await select.locator('[data-role="advanced-select"]').click();
    }
    const search = select.locator('input[data-role="advanced-select-text"]');
    if (await search.count()) await search.fill(option);
    // The typed text replaces the tree with a result list (name + path); the
    // collapsed tree nodes stay in the DOM, hidden: only a visible label counts.
    const target = select.locator('.action-menu label.admin__action-multiselect-label:visible')
      .filter({ has: this.page.locator(`span:not(.admin__action-multiselect-item-path):text-is(${quoted(option)})`) }).first();
    await target.waitFor({ state: 'visible', timeout: budget(this) });
    await target.click();
    const done = select.locator('button[data-action="close-advanced-select"]');
    if (await done.count() && await done.first().isVisible()) await done.first().click();
  }, 'Type the name as the tree shows it; the result list shows the name and its path.');
  await assertPresence(select.locator('.admin__action-multiselect-crumb, .admin__action-multiselect-text').filter({ hasText: literal(option) }), null, {
    label: `"${option}" as a chosen entry of "${label}"`,
    hint: 'The chosen entries show as chips in the field.',
    timeout: budget(this),
  });
});

/**
 * Open (or close) a collapsible section of an admin form by its title
 * ("Content", "Images And Videos", "Search Engine Optimization", "Actions").
 *
 * Example #1: When I open the "Images And Videos" form section
 * Example #2: When I open the "Search Engine Optimization" form section
 * Example #3: And I open the "Actions" form section
 * Example #4: When we open the "Content" form section
 * Example #5: When I close the "Content" form section
 *
 */
When(/^(I |we )*(open|close) the "([^"]*)" form section$/, async function (pronounCase, verb, title) {
  await toggleFormSection(this, title, verb === 'open');
});

/**
 * Open a tab of an admin page by its name: the tabs of an order ("Invoices",
 * "Shipments", "Credit Memos") or of a customer ("Account Information",
 * "Addresses", "Orders").
 *
 * Example #1: When I open the "Invoices" admin tab
 * Example #2: When I open the "Addresses" admin tab
 * Example #3: And I open the "Account Information" admin tab
 * Example #4: When we open the "Shipments" admin tab
 * Example #5: When I open the "Credit Memos" admin tab
 *
 */
When(/^(I |we )*open the "([^"]*)" admin tab$/, async function (pronounCase, name) {
  await settle(this);
  // The link also holds hidden tooltips ("Changes have been made to this section…"): the name is its first span.
  const item = this.page.locator('.admin__page-nav-item:visible').filter({ has: this.page.locator('a.admin__page-nav-link > span:first-child', { hasText: exactly(name) }) }).first();
  if (!(await item.count())) {
    const tabs = await this.page.locator('.admin__page-nav-item:visible a.admin__page-nav-link > span:first-child').allInnerTexts().catch(() => []);
    throw friendly({ message: `The page has no "${name}" tab. Its tabs: ${tabs.map(clean).filter(Boolean).join(', ') || '(none)'}.`, hint: 'Use the tab name as the page shows it.' });
  }
  await actAndSettle(this, () => item.locator('a').first().click());
  await assertValue(this, async () => ((await item.getAttribute('class')) || '').match(/_active|ui-tabs-active/) ? 'active' : 'inactive', 'active', {
    label: `the "${name}" tab`,
    hint: 'The active tab carries `_active` or `ui-tabs-active`.',
  });
});

/**
 * Assert a field of an admin form shows (or does not show) a validation error
 * ("This is a required field.").
 *
 * Example #1: Then I should see the form error "This is a required field." for the "Product Name" field
 * Example #2: Then I should see the form error "This is a required field." for the "SKU" field
 * Example #3: And I should not see the form error "This is a required field." for the "Price" field
 * Example #4: Then we should see the form error "This is a required field." for the "Rule Name" field
 * Example #5: Then I should see the form error "This is a required field." for the "Page Title" field
 *
 */
Then(/^(I |we )*should( not)* see the form error "([^"]*)" for the "([^"]*)" field$/, async function (pronounCase, notCase, text, label) {
  const field = await formField(this, label);
  await assertPresence(field.locator('.admin__field-error, label.mage-error, div.mage-error').filter({ hasText: literal(text) }), notCase, {
    label: `the error "${text}" under the "${label}" field`,
    hint: 'The form validates when it is saved. A field that holds a value on screen but shows "required" was not read by the form: fill it with `I set the "…" form field to "…"`.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => {
      const errors = await this.page.locator('.admin__field-error:visible, label.mage-error:visible').allInnerTexts().catch(() => []);
      return errors.length ? `the errors ${errors.map((error) => `"${clean(error)}"`).join(', ')}` : 'no field error';
    },
  });
});

/**
 * Save the admin form with its main Save button ("Save", "Save Customer",
 * "Save Config", "Save Review") and wait for the result. Follow it with a
 * message or a form error assertion.
 *
 * Example #1: When I save the form
 * Example #2: And I save the form
 * Example #3: When we save the form
 * Example #4: When save the form
 * Example #5: And we save the form
 *
 */
When(/^(I |we )*save the form$/, async function (pronounCase) {
  await settle(this);
  const page = this.page;
  const button = page.locator('.page-main-actions:visible').first().locator('#save-button, #save, #save_button, button.save.primary, button.primary[data-ui-id*="save"]').first();
  if (!(await button.count())) {
    const all = await page.locator('.page-main-actions:visible').first().locator('button:visible').allInnerTexts().catch(() => []);
    throw friendly({ message: `The page has no Save button. Its buttons: ${all.map(clean).filter(Boolean).join(', ') || '(none)'}.`, hint: 'Open a form first (a new or an existing record).' });
  }
  await actAndSettle(this, () => button.click());
});
