'use strict';

// Storefront step definitions (the default theme): the customer session, the
// top menu and the breadcrumbs, the product list of a category or a search
// (amount, sorting, direction, list and grid, paging, layered navigation), the
// search box and its suggestions, the product page (options, quantity, add to
// cart), the mini cart, the cart (quantity, remove, coupon, shipping estimate,
// totals), the checkout through to the order number, the customer account
// (orders, address book), the wish list, the comparison list, reviews, the
// newsletter and the field errors.
//
// The storefront renders late: a page is "complete" long before its components
// work. Every step waits for the settled signal (see settle() in
// magento-helpers.js), never for a fixed time.
//
// The selectors come from the pages as a browser shows them; see
// exploration/10 and 11 in the repository.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  literal,
  exactly,
  escapeRegExp,
  siteRoot,
  siteUrl,
  settle,
  open,
  actAndSettle,
  actOrExplain,
  assertPresence,
  assertValue,
  resolveUser,
  messages,
  messagesSeen,
  answerDialog,
} = require('./magento-helpers');

const LIST_HINT = 'The product list is on a category page or on a search result page (`.products.wrapper`).';
const CART_HINT = 'Open the cart first: `When I go to the cart`.';
const CHECKOUT_HINT = 'Open the checkout first (`When I go to the checkout`); it needs a product in the cart.';

// ---------------------------------------------------------------------------
// Customer session
// ---------------------------------------------------------------------------

/**
 * Whether a customer is signed in: the header holds the customer menu.
 *
 * @param {object} world
 * @returns {Promise<boolean>}
 */
async function customerSignedIn(world) {
  return (await world.page.locator('.page-header .customer-welcome').count()) > 0;
}

/**
 * Submit the sign-in form of the storefront. The page holds two forms with the
 * same ids (the hidden sign-in popup comes first) and the "Password" label of
 * the page form points at the popup's field: the form is scoped to
 * `.login-container` and its fields are found by name.
 *
 * @param {object} world
 * @param {string} email
 * @param {string} password
 */
async function submitCustomerLogin(world, email, password) {
  const page = world.page;
  await open(world, siteUrl(world, 'customer/account/login/'));
  if (await customerSignedIn(world)) {
    await open(world, siteUrl(world, 'customer/account/logout/'));
    await open(world, siteUrl(world, 'customer/account/login/'));
  }
  const form = page.locator('.login-container');
  await actOrExplain('fill in the sign-in form', email, async () => {
    await form.locator('input[name="login[username]"]').fill(email, { timeout: budget(world) });
    await form.locator('input[name="login[password]"]').fill(password);
  }, 'The sign-in form is `.login-container` on /customer/account/login/.');
  await actAndSettle(world, () => form.locator('button.login').click({ noWaitAfter: true }));
  // The sign-in ends in one of two ways: the customer menu of the header, or a message.
  await page.locator('.page-header .customer-welcome, .page.messages .message').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
}

/**
 * Log in to the store as a customer of the users registry in cucumber.js
 * (`worldParameters.users`, an entry with an `email`), by its handle. A session
 * of another customer is ended first.
 *
 * Example #1: Given I am logged in as the customer "customer"
 * Example #2: Given I am logged in as the customer "shopper"
 * Example #3: When I log in as the customer "customer"
 * Example #4: Given we are logged in as the customer "customer"
 * Example #5: When we log in as the customer "shopper"
 *
 */
Given(/^(?:(?:I am |we are )+logged in|(?:I |we )*log in) as the customer "([^"]*)"$/, async function (handle) {
  const account = resolveUser(this, handle, 'customer');
  await submitCustomerLogin(this, account.login, account.password);
  if (!(await customerSignedIn(this))) {
    throw friendly({
      message: `Could not log in to the store as the customer "${handle}" (${account.login}). The page shows ${await messagesSeen(this)}.`,
      hint: 'The customers are named in worldParameters.users of cucumber.js and created by the site build script. The customer CAPTCHA must be off on a test site.',
    });
  }
});

/**
 * Submit the sign-in form of the store with an email and a password, for the
 * scenarios that check a refused sign-in. Nothing is asserted.
 *
 * Example #1: When I log in to the store with the email "customer@example.com" and the password "wrong"
 * Example #2: When I log in to the store with the email "nobody@example.com" and the password "Secret123456789!"
 * Example #3: And I log in to the store with the email "customer@example.com" and the password ""
 * Example #4: When we log in to the store with the email "shopper@example.com" and the password "wrong"
 * Example #5: When log in to the store with the email "customer@example.com" and the password "wrong-password"
 *
 */
When(/^(I |we )*log in to the store with the email "([^"]*)" and the password "([^"]*)"$/, async function (pronounCase, email, password) {
  await submitCustomerLogin(this, email, password);
});

/**
 * Log out of the store through the customer menu of the header. The store
 * shows "You are signed out" and goes to the home page by itself five seconds
 * later: the step waits for that redirect, so the next step is not interrupted
 * by it.
 *
 * Example #1: When I log out of the store
 * Example #2: And I log out of the store
 * Example #3: When we log out of the store
 * Example #4: When log out of the store
 * Example #5: And we log out of the store
 *
 */
When(/^(I |we )*log out of the store$/, async function (pronounCase) {
  const page = this.page;
  await settle(this);
  if (!(await customerSignedIn(this))) {
    throw friendly({ message: 'No customer is logged in to the store, so there is nothing to log out of.', hint: 'Log in first: `Given I am logged in as the customer "customer"`.' });
  }
  await actOrExplain('log out of', 'the store', async () => {
    await page.locator('.page-header button[data-action="customer-menu-toggle"]').first().click();
    await page.locator('.page-header .customer-menu .authorization-link a').first().click();
    await page.waitForURL(/customer\/account\/logoutSuccess/, { timeout: budget(this) });
    await page.waitForURL((url) => url.toString().replace(/\/+$/, '') === siteRoot(this), { timeout: budget(this) });
  }, 'The customer menu of the header (`.customer-welcome`) holds "Sign Out"; the store then redirects to the home page after five seconds.');
  await settle(this);
});

/**
 * Assert a customer is (or is not) logged in to the store, optionally by the
 * name the header greets ("Welcome, Casey Customer!").
 *
 * Example #1: Then I should be logged in to the store
 * Example #2: Then I should not be logged in to the store
 * Example #3: Then I should be logged in to the store as "Casey Customer"
 * Example #4: Then we should be logged in to the store as "Sam Shopper"
 * Example #5: And I should not be logged in to the store
 *
 */
Then(/^(I |we )*should( not)* be logged in to the store(?: as "([^"]*)")?$/, async function (pronounCase, notCase, name) {
  await settle(this);
  if (name) {
    await assertValue(this, () => this.page.locator('.page-header .greet.welcome').first().innerText(), `Welcome, ${name}!`, {
      label: 'the greeting of the header',
      notCase,
      hint: 'The greeting is filled from the customer data the page loads after it is shown.',
    });
    return;
  }
  const signedIn = await customerSignedIn(this);
  if (signedIn === Boolean(notCase)) {
    throw friendly({
      message: notCase ? 'Expected no customer to be logged in to the store, but the header holds the customer menu.' : 'Expected a customer to be logged in to the store, but the header holds no customer menu.',
      hint: 'A logged-in customer has the customer menu (`.customer-welcome`) in the header; a guest has "Sign In" and "Create an Account".',
    });
  }
});

// ---------------------------------------------------------------------------
// Menu, breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Open an entry of the top menu of the store. A sub-entry is written as a path
 * ("Gear > Bags"): the parent is hovered, the panel opens, the entry is
 * clicked.
 *
 * Example #1: When I open the "Gear > Bags" store menu item
 * Example #2: When I open the "Sale" store menu item
 * Example #3: And I open the "Women > Tops" store menu item
 * Example #4: When we open the "Gear > Watches" store menu item
 * Example #5: When I open the "What's New" store menu item
 *
 */
When(/^(I |we )*open the "([^"]*)" store menu item$/, async function (pronounCase, path) {
  await settle(this);
  const parts = path.split('>').map(clean);
  let scope = this.page.locator('nav.navigation > ul');
  await actOrExplain('open the store menu item', path, async () => {
    for (let i = 0; i < parts.length; i += 1) {
      const item = scope.locator(':scope > li').filter({ has: this.page.locator(':scope > a', { hasText: exactly(parts[i]) }) }).first();
      const link = item.locator(':scope > a');
      await link.waitFor({ state: 'visible', timeout: budget(this) });
      if (i === parts.length - 1) {
        await actAndSettle(this, () => link.click({ noWaitAfter: true }));
      } else {
        await link.hover();
        scope = item.locator(':scope > ul.submenu');
        await scope.waitFor({ state: 'visible', timeout: budget(this) });
      }
    }
  }, 'Write the path as the menu shows it: "Gear > Bags". On a narrow viewport the menu is behind the menu button.');
});

/**
 * Assert the breadcrumbs of the page, written as a path ("Home > Gear >
 * Bags").
 *
 * Example #1: Then the breadcrumbs should be "Home > Gear > Bags"
 * Example #2: Then the breadcrumbs should be "Home > Joust Duffle Bag"
 * Example #3: And the breadcrumbs should be "Home > Gear"
 * Example #4: Then the breadcrumbs should be "Home > Search results for: 'yoga'"
 * Example #5: Then the breadcrumbs should be "Home > About us"
 *
 */
Then(/^the breadcrumbs should be "([^"]*)"$/, async function (path) {
  const wanted = path.split('>').map(clean).join(' > ');
  await assertValue(this, async () => (await this.page.locator('.breadcrumbs .items > li').allInnerTexts()).map(clean).join(' > '), wanted, {
    label: 'the breadcrumbs',
    hint: 'The breadcrumbs are `.breadcrumbs .items > li`; on a product page they are filled by a script after the page is shown.',
  });
});

// ---------------------------------------------------------------------------
// Product list (category and search results)
// ---------------------------------------------------------------------------

/**
 * The first toolbar of the product list (the page has one above and one below
 * the list).
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function listToolbar(world) {
  await settle(world);
  const toolbar = world.page.locator('.toolbar-products:visible').first();
  if (!(await toolbar.count())) {
    throw friendly({ message: 'There is no product list on this page.', hint: LIST_HINT });
  }
  return toolbar;
}

/**
 * Assert how many products the list found, over all its pages (the "Items 1-12
 * of 15" or "6 Items" of the toolbar).
 *
 * Example #1: Then the product list should have 15 products
 * Example #2: Then the product list should have 6 products
 * Example #3: And the product list should have 1 product
 * Example #4: Then the product list should have 30 products
 * Example #5: Then the product list should have 9 products
 *
 */
Then(/^the product list should have (\d+) products?$/, async function (count) {
  const toolbar = await listToolbar(this);
  await assertValue(this, async () => {
    const text = clean(await toolbar.locator('.toolbar-amount').innerText());
    const match = text.match(/of (\d+)$/) || text.match(/^(\d+) Items?$/i);
    return match ? match[1] : `the amount "${text}"`;
  }, String(count), { label: 'the number of products of the list', hint: LIST_HINT });
});

/**
 * Assert a product is (or is not) on the current page of the product list, by
 * its name.
 *
 * Example #1: Then I should see the product "Joust Duffle Bag" in the product list
 * Example #2: Then I should not see the product "Test Bag" in the product list
 * Example #3: And I should see the product "Push It Messenger Bag" in the product list
 * Example #4: Then we should see the product "Cronus Yoga Pant" in the product list
 * Example #5: Then should not see the product "Hidden Product" in the product list
 *
 */
Then(/^(I |we )*should( not)* see the product "([^"]*)" in the product list$/, async function (pronounCase, notCase, name) {
  await settle(this);
  await assertPresence(this.page.locator('.products.wrapper .product-item-link').filter({ hasText: exactly(name) }), notCase, {
    label: `the product "${name}" in the product list`,
    hint: LIST_HINT + ' The list shows one page at a time.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => {
      const names = await this.page.locator('.products.wrapper .product-item-link').allInnerTexts().catch(() => []);
      return names.length ? `the products ${names.slice(0, 8).map((text) => `"${clean(text)}"`).join(', ')}${names.length > 8 ? ', …' : ''}` : 'no product';
    },
  });
});

/**
 * Open a product from the product list by its name.
 *
 * Example #1: When I open the product "Joust Duffle Bag" from the product list
 * Example #2: When I open the product "Radiant Tee" from the product list
 * Example #3: And I open the product "Aim Analog Watch" from the product list
 * Example #4: When we open the product "Push It Messenger Bag" from the product list
 * Example #5: When open the product "Cronus Yoga Pant" from the product list
 *
 */
When(/^(I |we )*open the product "([^"]*)" from the product list$/, async function (pronounCase, name) {
  await settle(this);
  const link = this.page.locator('.products.wrapper .product-item-link').filter({ hasText: exactly(name) }).first();
  await actOrExplain('open the product', name, async () => {
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await actAndSettle(this, () => link.click({ noWaitAfter: true }));
  }, LIST_HINT + ' The product must be on the current page of the list.');
});

/**
 * Sort the product list by one of the choices of its "Sort By" select
 * ("Position", "Product Name", "Price"). The page reloads with the new order.
 *
 * Example #1: When I sort the product list by "Price"
 * Example #2: When I sort the product list by "Product Name"
 * Example #3: And I sort the product list by "Position"
 * Example #4: When we sort the product list by "Price"
 * Example #5: When sort the product list by "Product Name"
 *
 */
When(/^(I |we )*sort the product list by "([^"]*)"$/, async function (pronounCase, choice) {
  const toolbar = await listToolbar(this);
  const select = toolbar.locator('select[data-role="sorter"]');
  const current = clean(await select.evaluate((el) => el.selectedOptions[0].textContent));
  if (current.toLowerCase() === clean(choice).toLowerCase()) return;
  await actOrExplain('sort the product list by', choice, async () => {
    const before = this.page.url();
    await select.selectOption({ label: choice }, { timeout: budget(this) });
    await this.page.waitForURL((url) => url.toString() !== before, { timeout: budget(this) });
  }, 'The choices of "Sort By" are the sortable attributes of the catalog: Position, Product Name, Price.');
  await settle(this);
});

/**
 * Set the direction of the product list order.
 *
 * Example #1: When I set the product list direction to descending
 * Example #2: When I set the product list direction to ascending
 * Example #3: And I set the product list direction to descending
 * Example #4: When we set the product list direction to ascending
 * Example #5: When set the product list direction to descending
 *
 */
When(/^(I |we )*set the product list direction to (ascending|descending)$/, async function (pronounCase, direction) {
  const toolbar = await listToolbar(this);
  const switcher = toolbar.locator('a[data-role="direction-switcher"]');
  const isDescending = /sort-desc/.test((await switcher.getAttribute('class')) || '');
  if (isDescending === (direction === 'descending')) return;
  const before = this.page.url();
  await switcher.click();
  await this.page.waitForURL((url) => url.toString() !== before, { timeout: budget(this) });
  await settle(this);
});

/**
 * Assert the products on the current page of the list are ordered by price or
 * by name.
 *
 * Example #1: Then the product list should be ordered by price ascending
 * Example #2: Then the product list should be ordered by price descending
 * Example #3: And the product list should be ordered by name ascending
 * Example #4: Then the product list should be ordered by name descending
 * Example #5: Then the product list should be ordered by price ascending
 *
 */
Then(/^the product list should be ordered by (price|name) (ascending|descending)$/, async function (what, direction) {
  await settle(this);
  const values = await this.page.locator('.products.wrapper .product-item').evaluateAll((items, key) => items.map((item) => {
    if (key === 'name') return (item.querySelector('.product-item-link') || {}).textContent || '';
    const price = item.querySelector('.price-box [data-price-type="finalPrice"] .price, .price-box [data-price-type="minPrice"] .price, .price-box .price');
    return price ? price.textContent : '';
  }), what);
  const keys = values.map((value) => (what === 'price' ? Number(clean(value).replace(/[^0-9.]/g, '')) : clean(value).toLowerCase()));
  if (keys.length < 2) {
    throw friendly({ message: `The product list shows ${keys.length} product(s): an order cannot be read from it.`, hint: LIST_HINT });
  }
  for (let i = 1; i < keys.length; i += 1) {
    const ordered = what === 'price' ? (direction === 'ascending' ? keys[i - 1] <= keys[i] : keys[i - 1] >= keys[i]) : (direction === 'ascending' ? keys[i - 1].localeCompare(keys[i]) <= 0 : keys[i - 1].localeCompare(keys[i]) >= 0);
    if (!ordered) {
      throw friendly({
        message: `The product list is not ordered by ${what} ${direction}: "${clean(values[i - 1])}" comes before "${clean(values[i])}" (products ${i} and ${i + 1}).`,
        hint: 'Sort the list first: `When I sort the product list by "Price"` and `When I set the product list direction to …`.',
      });
    }
  }
});

/**
 * Show the product list as a list or as a grid.
 *
 * Example #1: When I view the product list as a list
 * Example #2: When I view the product list as a grid
 * Example #3: And I view the product list as a list
 * Example #4: When we view the product list as a grid
 * Example #5: When view the product list as a list
 *
 */
When(/^(I |we )*view the product list as a (list|grid)$/, async function (pronounCase, mode) {
  const toolbar = await listToolbar(this);
  const button = toolbar.locator(`.modes-mode.mode-${mode}`);
  if (/(^|\s)active(\s|$)/.test((await button.getAttribute('class')) || '')) return;
  const before = this.page.url();
  await button.click();
  await this.page.waitForURL((url) => url.toString() !== before, { timeout: budget(this) });
  await settle(this);
});

/**
 * Assert the product list is shown as a list or as a grid.
 *
 * Example #1: Then the product list should be shown as a list
 * Example #2: Then the product list should be shown as a grid
 * Example #3: And the product list should be shown as a list
 * Example #4: And the product list should be shown as a grid
 * Example #5: Then the product list should be shown as a list
 *
 */
Then(/^the product list should be shown as a (list|grid)$/, async function (mode) {
  await assertValue(this, async () => (/(^|\s)products-list(\s|$)/.test((await this.page.locator('.products.wrapper').first().getAttribute('class')) || '') ? 'list' : 'grid'), mode, {
    label: 'the mode of the product list',
    hint: LIST_HINT + ' The wrapper carries `products-list` or `products-grid`.',
  });
});

/**
 * Go to a page of the product list: the next one, the previous one or a page
 * by its number.
 *
 * Example #1: When I go to the next page of the product list
 * Example #2: When I go to the previous page of the product list
 * Example #3: When I go to page 2 of the product list
 * Example #4: And we go to page 3 of the product list
 * Example #5: When we go to the next page of the product list
 *
 */
When(/^(I |we )*go to (?:the (next|previous) page|page (\d+)) of the product list$/, async function (pronounCase, direction, number) {
  await settle(this);
  const pager = this.page.locator('.pages:visible').first();
  const link = direction
    ? pager.locator(direction === 'next' ? 'a.next' : 'a.previous')
    : pager.locator('a.page').filter({ has: this.page.locator('span:last-child', { hasText: exactly(String(number)) }) });
  if (!(await link.count())) {
    throw friendly({ message: `The product list has no ${direction ? direction + ' page' : 'page ' + number}.`, hint: 'The pager shows only when the list has more products than fit on a page.' });
  }
  await actAndSettle(this, () => link.first().click({ noWaitAfter: true }));
});

/**
 * Assert the page number the product list is on.
 *
 * Example #1: Then the product list should be on page 2
 * Example #2: Then the product list should be on page 1
 * Example #3: And the product list should be on page 3
 * Example #4: Then the product list should be on page 4
 * Example #5: Then the product list should be on page 5
 *
 */
Then(/^the product list should be on page (\d+)$/, async function (number) {
  await assertValue(this, async () => {
    const current = this.page.locator('.pages:visible').first().locator('li.current .page span:last-child');
    return (await current.count()) ? current.first().innerText() : '1';
  }, String(number), { label: 'the page of the product list', hint: LIST_HINT });
});

/**
 * Filter the product list with the layered navigation ("Shopping Options"):
 * the filter is expanded and the option is followed.
 *
 * Example #1: When I filter the product list by "Activity" with "Yoga"
 * Example #2: When I filter the product list by "Style" with "Backpack"
 * Example #3: And I filter the product list by "Material" with "Nylon"
 * Example #4: When we filter the product list by "Color" with "Blue"
 * Example #5: When filter the product list by "Activity" with "Gym"
 *
 */
When(/^(I |we )*filter the product list by "([^"]*)" with "([^"]*)"$/, async function (pronounCase, filter, option) {
  await settle(this);
  const block = this.page.locator('.block.filter');
  const title = block.locator('.filter-options-title').filter({ hasText: exactly(filter) }).first();
  if (!(await title.count())) {
    const all = await block.locator('.filter-options-title').evaluateAll((titles) => titles.map((el) => el.textContent.replace(/\s+/g, ' ').trim())).catch(() => []);
    throw friendly({ message: `The product list has no "${filter}" filter. Its filters: ${all.join(', ') || '(none)'}.`, hint: 'The filters are the "Shopping Options" of the page; a filter in use moves to "Now Shopping by".' });
  }
  await actOrExplain('filter the product list by', `${filter}: ${option}`, async () => {
    if ((await title.getAttribute('aria-expanded')) !== 'true') await title.click();
    const link = title.locator('xpath=following-sibling::*[1]').locator('a').filter({ hasText: new RegExp('^\\s*' + escapeRegExp(option) + '(\\s|$)') }).first();
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await actAndSettle(this, () => link.click({ noWaitAfter: true }));
  }, 'Use the option text as the filter shows it, without its count.');
});

/**
 * Assert the product list is (or is not) filtered by a filter with a value
 * (the "Now Shopping by" list).
 *
 * Example #1: Then the product list should be filtered by "Activity" with "Yoga"
 * Example #2: Then the product list should not be filtered by "Activity" with "Yoga"
 * Example #3: And the product list should be filtered by "Style" with "Backpack"
 * Example #4: Then the product list should be filtered by "Color" with "Blue"
 * Example #5: Then the product list should not be filtered by "Material" with "Nylon"
 *
 */
Then(/^the product list should( not)* be filtered by "([^"]*)" with "([^"]*)"$/, async function (notCase, filter, option) {
  await settle(this);
  const item = this.page.locator('.filter-current li.item')
    .filter({ has: this.page.locator('.filter-label', { hasText: exactly(filter) }) })
    .filter({ has: this.page.locator('.filter-value', { hasText: exactly(option) }) });
  const found = (await item.count()) > 0;
  if (found === Boolean(notCase)) {
    const current = await this.page.locator('.filter-current li.item').evaluateAll((items) => items.map((el) => (el.querySelector('.filter-label').textContent + ': ' + el.querySelector('.filter-value').textContent).replace(/\s+/g, ' ').trim())).catch(() => []);
    throw friendly({
      message: notCase ? `Expected the product list not to be filtered by ${filter}: ${option}, but it is.` : `Expected the product list to be filtered by ${filter}: ${option}. Filters in use: ${current.join(', ') || '(none)'}.`,
      hint: 'The filters in use are listed under "Now Shopping by" (`.filter-current`).',
    });
  }
});

/**
 * Remove every filter of the layered navigation ("Clear All").
 *
 * Example #1: When I clear the product list filters
 * Example #2: And I clear the product list filters
 * Example #3: When we clear the product list filters
 * Example #4: When clear the product list filters
 * Example #5: And we clear the product list filters
 *
 */
When(/^(I |we )*clear the product list filters$/, async function (pronounCase) {
  await settle(this);
  const clear = this.page.locator('.block.filter a.filter-clear').first();
  if (!(await clear.count())) {
    throw friendly({ message: 'The product list has no filter in use, so there is no "Clear All".', hint: 'Filter the list first: `When I filter the product list by "Activity" with "Yoga"`.' });
  }
  await actAndSettle(this, () => clear.click({ noWaitAfter: true }));
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search the store with the search box of the header and wait for the result
 * page.
 *
 * Example #1: When I search the store for "yoga"
 * Example #2: When I search the store for "bag"
 * Example #3: And I search the store for "Joust Duffle Bag"
 * Example #4: When we search the store for "24-MB01"
 * Example #5: When search the store for "zzzqqqxxx"
 *
 */
When(/^(I |we )*search the store for "([^"]*)"$/, async function (pronounCase, text) {
  await settle(this);
  const box = this.page.locator('#search');
  await actOrExplain('search the store for', text, async () => {
    await box.fill(text, { timeout: budget(this) });
    await box.press('Enter');
    await this.page.waitForURL(/catalogsearch\/result/, { timeout: budget(this) });
  }, 'The search box is `#search` in the header. A text shorter than the minimum query length is not searched.');
  await settle(this);
});

/**
 * Type a text in the search box of the header the way a person does, key by
 * key, without submitting: the store answers with suggestions.
 *
 * Example #1: When I type "yog" in the store search
 * Example #2: When I type "bag" in the store search
 * Example #3: And I type "tee" in the store search
 * Example #4: When we type "yoga" in the store search
 * Example #5: When type "wat" in the store search
 *
 */
When(/^(I |we )*type "([^"]*)" in the store search$/, async function (pronounCase, text) {
  await settle(this);
  const box = this.page.locator('#search');
  await box.click();
  await box.fill('');
  await box.pressSequentially(text, { delay: 60 });
  await settle(this);
});

/**
 * Assert the search box shows (or does not show) a suggestion. Suggestions are
 * the terms earlier searches used.
 *
 * Example #1: Then I should see the search suggestion "yoga"
 * Example #2: Then I should not see the search suggestion "zzz"
 * Example #3: And I should see the search suggestion "bag"
 * Example #4: Then we should see the search suggestion "tee"
 * Example #5: Then should not see the search suggestion "nothing"
 *
 */
Then(/^(I |we )*should( not)* see the search suggestion "([^"]*)"$/, async function (pronounCase, notCase, text) {
  await assertPresence(this.page.locator('#search_autocomplete [role="option"] .qs-option-name').filter({ hasText: exactly(text) }), notCase, {
    label: `the search suggestion "${text}"`,
    hint: 'Suggestions show while a person types (`When I type "…" in the store search`) and come from the search terms the store has recorded.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => {
      const all = await this.page.locator('#search_autocomplete [role="option"] .qs-option-name').allInnerTexts().catch(() => []);
      return all.length ? `the suggestions ${all.map((item) => `"${clean(item)}"`).join(', ')}` : 'no suggestion';
    },
  });
});

// ---------------------------------------------------------------------------
// Product page
// ---------------------------------------------------------------------------

/**
 * The option group (swatches) of the product page with a label.
 *
 * @param {object} world
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function optionGroup(world, label) {
  await settle(world);
  const group = world.page.locator('.product-options-wrapper .swatch-attribute').filter({ has: world.page.locator('.swatch-attribute-label', { hasText: exactly(label) }) }).first();
  if (!(await group.count())) {
    const all = await world.page.locator('.product-options-wrapper .swatch-attribute-label').allInnerTexts().catch(() => []);
    throw friendly({ message: `The product has no "${label}" option. Its options: ${all.map(clean).join(', ') || '(none; is this a configurable product?)'}.`, hint: 'The options of a configurable product show as swatches above the quantity.' });
  }
  return group;
}

/**
 * Choose a value of an option of a configurable product by clicking its
 * swatch ("Size" "M", "Color" "Blue").
 *
 * Example #1: When I choose the "Size" option "M"
 * Example #2: When I choose the "Color" option "Blue"
 * Example #3: And I choose the "Size" option "XL"
 * Example #4: When we choose the "Color" option "Orange"
 * Example #5: When choose the "Size" option "S"
 *
 */
When(/^(I |we )*choose the "([^"]*)" option "([^"]*)"$/, async function (pronounCase, label, value) {
  const group = await optionGroup(this, label);
  const swatch = group.locator(`.swatch-option[data-option-label="${value.replace(/"/g, '\\"')}"]`).first();
  if (!(await swatch.count())) {
    const all = await group.locator('.swatch-option').evaluateAll((options) => options.map((el) => el.getAttribute('data-option-label')));
    throw friendly({ message: `The "${label}" option has no "${value}". Its values: ${all.join(', ')}.`, hint: 'Use the value as the swatch names it.' });
  }
  if ((await swatch.getAttribute('aria-checked')) !== 'true') await swatch.click();
  await assertValue(this, () => swatch.getAttribute('aria-checked'), 'true', { label: `the state of the "${value}" swatch of "${label}"`, hint: 'A value that is out of stock for the other chosen options cannot be selected.' });
});

/**
 * Assert a value of an option is (or is not) the selected one.
 *
 * Example #1: Then the "Size" option should be "M"
 * Example #2: Then the "Color" option should be "Blue"
 * Example #3: And the "Size" option should not be "XL"
 * Example #4: Then the "Color" option should be "Orange"
 * Example #5: Then the "Size" option should be "S"
 *
 */
Then(/^the "([^"]*)" option should( not)* be "([^"]*)"$/, async function (label, notCase, value) {
  const group = await optionGroup(this, label);
  await assertValue(this, async () => clean(await group.locator('.swatch-attribute-selected-option').first().textContent().catch(() => '')), value, {
    label: `the selected value of the "${label}" option`,
    notCase,
    hint: 'The selected value shows next to the option label.',
  });
});

/**
 * Set the quantity of the product page.
 *
 * Example #1: When I set the product quantity to 2
 * Example #2: When I set the product quantity to 1
 * Example #3: And I set the product quantity to 3
 * Example #4: When we set the product quantity to 10
 * Example #5: When set the product quantity to 5
 *
 */
When(/^(I |we )*set the product quantity to (\d+)$/, async function (pronounCase, quantity) {
  await settle(this);
  await actOrExplain('set the product quantity to', String(quantity), () => this.page.locator('#qty').fill(String(quantity), { timeout: budget(this) }), 'The quantity field of a product page is `#qty`.');
});

/**
 * Press "Add to Cart" on a product page and wait until the store has answered:
 * the button goes "Adding…", "Added" and back, and the mini cart reloads. A
 * refused add (a required option not chosen) ends the step as well: follow it
 * with a message or a field error assertion.
 *
 * Example #1: When I add the product to the cart
 * Example #2: And I add the product to the cart
 * Example #3: When we add the product to the cart
 * Example #4: When add the product to the cart
 * Example #5: And we add the product to the cart
 *
 */
When(/^(I |we )*add the product to the cart$/, async function (pronounCase) {
  await settle(this);
  const page = this.page;
  const button = page.locator('#product-addtocart-button');
  await actOrExplain('add the product to', 'the cart', async () => {
    await button.waitFor({ state: 'visible', timeout: budget(this) });
    await button.click();
    const limit = Date.now() + budget(this);
    // The request starts a moment after the click: wait for the button to turn
    // busy (or for a field error), then for it to come back.
    let started = false;
    while (Date.now() < limit) {
      const state = await page.evaluate(() => {
        const el = document.querySelector('#product-addtocart-button');
        const counter = document.querySelector('.minicart-wrapper .counter');
        return {
          busy: !el || el.classList.contains('disabled') || (counter && counter.classList.contains('_block-content-loading')),
          error: [...document.querySelectorAll('.product-add-form div.mage-error, .page.messages .message-error, .page.messages .message-success')].some((node) => node.getClientRects().length),
        };
      }).catch(() => ({ busy: true, error: false }));
      if (state.busy) started = true;
      if (!state.busy && (started || state.error)) break;
      await page.waitForTimeout(100);
    }
  }, 'The button is `#product-addtocart-button`; it is disabled until the page scripts are ready.');
  await settle(this);
});

/**
 * Assert the price the product page shows.
 *
 * Example #1: Then the product price should be "$34.00"
 * Example #2: Then the product price should be "$22.00"
 * Example #3: And the product price should be "$12.50"
 * Example #4: Then the product price should be "$45.00"
 * Example #5: Then the product price should be "$59.00"
 *
 */
Then(/^the product price should be "([^"]*)"$/, async function (price) {
  await assertValue(this, () => this.page.locator('.product-info-main .price-box .price').first().innerText(), price, {
    label: 'the product price',
    hint: 'The price of a configurable product follows the chosen options.',
  });
});

/**
 * Open a tab of the product page by its name ("Details", "More Information",
 * "Reviews"; the review counter after the name is not part of it). The reviews
 * are fetched when their tab is opened for the first time: the step waits for
 * them.
 *
 * Example #1: When I open the "Reviews" product tab
 * Example #2: When I open the "Details" product tab
 * Example #3: And I open the "More Information" product tab
 * Example #4: When we open the "Reviews" product tab
 * Example #5: When open the "Details" product tab
 *
 */
When(/^(I |we )*open the "([^"]*)" product tab$/, async function (pronounCase, name) {
  await settle(this);
  const tabs = this.page.locator('.product.data.items > .data.item.title');
  const tab = tabs.filter({ hasText: new RegExp('^\\s*' + escapeRegExp(name) + '(\\s+\\d+)?\\s*$', 'i') }).first();
  if (!(await tab.count())) {
    const all = await tabs.allInnerTexts().catch(() => []);
    throw friendly({ message: `The product page has no "${name}" tab. Its tabs: ${all.map(clean).join(', ') || '(none)'}.`, hint: 'Use the tab name without the counter ("Reviews", not "Reviews 4").' });
  }
  if ((await tab.getAttribute('aria-expanded')) !== 'true') {
    await actAndSettle(this, () => tab.locator('a.data.switch').click({ noWaitAfter: true }));
  }
  await assertValue(this, () => tab.getAttribute('aria-expanded'), 'true', { label: `the state of the "${name}" tab`, hint: 'The open tab carries `aria-expanded="true"`.' });
  await settle(this);
});

// ---------------------------------------------------------------------------
// Mini cart
// ---------------------------------------------------------------------------

/**
 * Assert the number the mini cart of the header shows, or that it is empty.
 *
 * Example #1: Then the mini cart should show 1 item
 * Example #2: Then the mini cart should show 2 items
 * Example #3: And the mini cart should show 0 items
 * Example #4: Then the mini cart should show 3 items
 * Example #5: Then the mini cart should show 5 items
 *
 */
Then(/^the mini cart should show (\d+) items?$/, async function (count) {
  await assertValue(this, async () => {
    await settle(this);
    const text = clean(await this.page.locator('.minicart-wrapper .counter-number').first().textContent());
    return text === '' ? '0' : text;
  }, String(count), {
    label: 'the number of the mini cart',
    hint: 'The mini cart counts the quantities; it is filled from the cart data the page loads after it is shown.',
  });
});

/**
 * Open the mini cart of the header.
 *
 * Example #1: When I open the mini cart
 * Example #2: And I open the mini cart
 * Example #3: When we open the mini cart
 * Example #4: When open the mini cart
 * Example #5: And we open the mini cart
 *
 */
When(/^(I |we )*open the mini cart$/, async function (pronounCase) {
  await settle(this);
  const wrapper = this.page.locator('.minicart-wrapper');
  if (!/(^|\s)active(\s|$)/.test((await wrapper.getAttribute('class')) || '')) {
    await wrapper.locator('a.showcart').click();
  }
  await this.page.locator('#minicart-content-wrapper').waitFor({ state: 'visible', timeout: budget(this) });
  await settle(this);
});

/**
 * Assert the open mini cart holds (or does not hold) a product.
 *
 * Example #1: Then the mini cart should contain "Joust Duffle Bag"
 * Example #2: Then the mini cart should not contain "Radiant Tee"
 * Example #3: And the mini cart should contain "Aim Analog Watch"
 * Example #4: Then the mini cart should contain "Radiant Tee"
 * Example #5: Then the mini cart should not contain "Test Bag"
 *
 */
Then(/^the mini cart should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  if (!(await this.page.locator('#minicart-content-wrapper').isVisible().catch(() => false))) {
    throw friendly({ message: 'The mini cart is not open.', hint: 'Open it first: `When I open the mini cart`.' });
  }
  await assertPresence(this.page.locator('#minicart-content-wrapper .product-item-name').filter({ hasText: exactly(name) }), notCase, {
    label: `"${name}" in the mini cart`,
    hint: 'The mini cart lists the product names of the cart.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => `the mini cart "${clean(await this.page.locator('#minicart-content-wrapper').innerText().catch(() => '')).slice(0, 160)}"`,
  });
});

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

/**
 * The lines of the cart page that hold a product name.
 *
 * @param {object} world
 * @param {string} [name]
 * @returns {import('playwright').Locator}
 */
function cartLines(world, name) {
  const lines = world.page.locator('#shopping-cart-table tbody.cart.item');
  return name ? lines.filter({ has: world.page.locator('.product-item-name', { hasText: exactly(name) }) }) : lines;
}

/**
 * Fail when the page is not the cart.
 *
 * @param {object} world
 */
async function requireCart(world) {
  await settle(world);
  if (!(await world.page.locator('body.checkout-cart-index').count())) {
    throw friendly({ message: 'This is not the cart page.', hint: CART_HINT });
  }
}

/**
 * Open the cart page or the checkout.
 *
 * Example #1: When I go to the cart
 * Example #2: When I go to the checkout
 * Example #3: Given I am on the cart
 * Example #4: Given we are on the checkout
 * Example #5: And we go to the cart
 *
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the (cart|checkout)$/, async function (page) {
  await open(this, siteUrl(this, page === 'cart' ? 'checkout/cart/' : 'checkout/'));
  if (page === 'checkout' && !(await this.page.locator('body.checkout-index-index').count())) {
    throw friendly({ message: 'The store did not open the checkout: it showed the cart instead.', hint: 'The checkout needs a product in the cart.' });
  }
});

/**
 * Empty the cart of the session: every line is removed. For a logged-in
 * customer, whose cart is kept between visits, it is the clean start of a
 * scenario.
 *
 * Example #1: Given my cart is empty
 * Example #2: And my cart is empty
 * Example #3: Given our cart is empty
 * Example #4: And our cart is empty
 * Example #5: Given my cart is empty now
 *
 */
Given(/^(?:my|our) cart is empty(?: now)?$/, async function () {
  await open(this, siteUrl(this, 'checkout/cart/'));
  for (let i = 0; i < 50; i += 1) {
    const line = cartLines(this).first();
    if (!(await line.count())) return;
    await actAndSettle(this, () => line.locator('a.action-delete').click({ noWaitAfter: true }));
  }
  throw friendly({ message: 'The cart still holds products after 50 removals.', hint: 'Remove the lines by hand and check what refuses to go.' });
});

/**
 * Assert the cart page holds (or does not hold) a product.
 *
 * Example #1: Then the cart should contain "Joust Duffle Bag"
 * Example #2: Then the cart should not contain "Radiant Tee"
 * Example #3: And the cart should contain "Aim Analog Watch"
 * Example #4: Then the cart should contain "Radiant Tee"
 * Example #5: Then the cart should not contain "Test Bag"
 *
 */
Then(/^the cart should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  await requireCart(this);
  await assertPresence(cartLines(this, name), notCase, {
    label: `"${name}" in the cart`,
    hint: CART_HINT,
    timeout: notCase ? 3000 : budget(this),
    found: async () => {
      const names = await this.page.locator('#shopping-cart-table .product-item-name').allInnerTexts().catch(() => []);
      return names.length ? `the products ${names.map((text) => `"${clean(text)}"`).join(', ')}` : 'an empty cart';
    },
  });
});

/**
 * Change the quantity of a line of the cart and press "Update Shopping Cart".
 *
 * Example #1: When I change the cart quantity of "Joust Duffle Bag" to 3
 * Example #2: When I change the cart quantity of "Radiant Tee" to 1
 * Example #3: And I change the cart quantity of "Aim Analog Watch" to 2
 * Example #4: When we change the cart quantity of "Joust Duffle Bag" to 5
 * Example #5: When change the cart quantity of "Radiant Tee" to 4
 *
 */
When(/^(I |we )*change the cart quantity of "([^"]*)" to (\d+)$/, async function (pronounCase, name, quantity) {
  await requireCart(this);
  const line = cartLines(this, name).first();
  await actOrExplain('change the cart quantity of', name, async () => {
    await line.locator('input[data-role="cart-item-qty"]').fill(String(quantity), { timeout: budget(this) });
    await actAndSettle(this, () => this.page.locator('.cart.main.actions button.action.update').click({ noWaitAfter: true }));
  }, CART_HINT + ' The product must be in the cart.');
});

/**
 * Assert the quantity of a line of the cart.
 *
 * Example #1: Then the cart quantity of "Joust Duffle Bag" should be 3
 * Example #2: Then the cart quantity of "Radiant Tee" should be 1
 * Example #3: And the cart quantity of "Aim Analog Watch" should be 2
 * Example #4: Then the cart quantity of "Joust Duffle Bag" should be 5
 * Example #5: Then the cart quantity of "Radiant Tee" should be 4
 *
 */
Then(/^the cart quantity of "([^"]*)" should be (\d+)$/, async function (name, quantity) {
  await requireCart(this);
  await assertValue(this, () => cartLines(this, name).first().locator('input[data-role="cart-item-qty"]').inputValue({ timeout: 2000 }), String(quantity), {
    label: `the cart quantity of "${name}"`,
    hint: CART_HINT + ' The product must be in the cart.',
  });
});

/**
 * Remove a line from the cart ("Remove item").
 *
 * Example #1: When I remove "Joust Duffle Bag" from the cart
 * Example #2: When I remove "Radiant Tee" from the cart
 * Example #3: And I remove "Aim Analog Watch" from the cart
 * Example #4: When we remove "Joust Duffle Bag" from the cart
 * Example #5: When remove "Radiant Tee" from the cart
 *
 */
When(/^(I |we )*remove "([^"]*)" from the cart$/, async function (pronounCase, name) {
  await requireCart(this);
  const line = cartLines(this, name).first();
  await actOrExplain('remove from the cart', name, async () => {
    await line.locator('a.action-delete').waitFor({ state: 'visible', timeout: budget(this) });
    await actAndSettle(this, () => line.locator('a.action-delete').click({ noWaitAfter: true }));
  }, CART_HINT + ' The product must be in the cart.');
});

/**
 * Assert a total of the cart page: "subtotal", "shipping", "discount", "tax"
 * or "order total".
 *
 * Example #1: Then the cart subtotal should be "$34.00"
 * Example #2: Then the cart order total should be "$39.00"
 * Example #3: And the cart shipping should be "$5.00"
 * Example #4: Then the cart discount should be "-$3.40"
 * Example #5: Then the cart order total should be "$30.60"
 *
 */
Then(/^the cart (subtotal|shipping|discount|tax|order total) should be "([^"]*)"$/, async function (total, amount) {
  await requireCart(this);
  await assertValue(this, async () => {
    const rows = await this.page.locator('#cart-totals tr').evaluateAll((trs) => trs.map((tr) => ({
      name: ((tr.querySelector('th') || {}).textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(),
      amount: ((tr.querySelector('td .price') || tr.querySelector('td') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    const row = rows.find((item) => item.name.startsWith(total));
    return row ? row.amount : `no "${total}" line (totals: ${rows.map((item) => item.name).join(', ') || 'none yet'})`;
  }, amount, { label: `the cart ${total}`, hint: 'The totals are computed by a request after the page is shown; shipping shows once a shipping estimate is chosen, discount once a coupon applies.' });
});

/**
 * Apply a discount code on the cart page ("Apply Discount Code"). Follow it
 * with a message assertion: a code that does not apply answers with an error.
 *
 * Example #1: When I apply the coupon "TEST10"
 * Example #2: When I apply the coupon "NOPE"
 * Example #3: And I apply the coupon "H20"
 * Example #4: When we apply the coupon "SAVE5"
 * Example #5: When apply the coupon "TEST10"
 *
 */
When(/^(I |we )*apply the coupon "([^"]*)"$/, async function (pronounCase, code) {
  await requireCart(this);
  const field = this.page.locator('#coupon_code');
  await actOrExplain('apply the coupon', code, async () => {
    if (!(await field.isVisible())) await this.page.locator('#block-discount-heading').click();
    await field.fill(code, { timeout: budget(this) });
    await actAndSettle(this, () => this.page.locator('#discount-coupon-form button.action.apply').click({ noWaitAfter: true }));
  }, CART_HINT + ' A coupon that is already applied must be cancelled first.');
});

/**
 * Cancel the coupon of the cart ("Cancel Coupon").
 *
 * Example #1: When I cancel the coupon
 * Example #2: And I cancel the coupon
 * Example #3: When we cancel the coupon
 * Example #4: When cancel the coupon
 * Example #5: And we cancel the coupon
 *
 */
When(/^(I |we )*cancel the coupon$/, async function (pronounCase) {
  await requireCart(this);
  const cancel = this.page.locator('#discount-coupon-form button.action.cancel');
  if (!(await cancel.count())) {
    throw friendly({ message: 'The cart has no coupon to cancel.', hint: 'Apply one first: `When I apply the coupon "…"`.' });
  }
  if (!(await cancel.isVisible())) await this.page.locator('#block-discount-heading').click();
  await actAndSettle(this, () => cancel.click({ noWaitAfter: true }));
});

/**
 * Fill the shipping estimate of the cart page ("Estimate Shipping and Tax")
 * with a country, a state or province and a postal code, and wait for the
 * shipping methods.
 *
 * Example #1: When I estimate shipping to "United States", "Texas", "78701"
 * Example #2: When I estimate shipping to "United States", "California", "94105"
 * Example #3: And I estimate shipping to "United States", "New York", "10001"
 * Example #4: When we estimate shipping to "United States", "Texas", "75001"
 * Example #5: When estimate shipping to "United States", "Florida", "33101"
 *
 */
When(/^(I |we )*estimate shipping to "([^"]*)", "([^"]*)", "([^"]*)"$/, async function (pronounCase, country, region, postcode) {
  await requireCart(this);
  const form = this.page.locator('#block-summary');
  await actOrExplain('estimate shipping to', `${country}, ${region}, ${postcode}`, async () => {
    if (!(await form.isVisible())) await this.page.locator('#block-shipping-heading').click();
    await form.locator('select[name="country_id"]').selectOption({ label: country }, { timeout: budget(this) });
    await settle(this);
    await form.locator('select[name="region_id"]').selectOption({ label: region }, { timeout: budget(this) });
    const zip = form.locator('input[name="postcode"]');
    await zip.fill(postcode);
    await zip.press('Tab');
    await settle(this);
    await this.page.locator('#co-shipping-method-form input[type="radio"]').first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'Use the country and the state as the selects name them.');
});

/**
 * Choose a shipping method: by its carrier title in the estimate of the cart
 * page or in the shipping step of the checkout ("Flat Rate", "Free Shipping",
 * "Best Way").
 *
 * Example #1: When I choose the "Flat Rate" shipping method
 * Example #2: When I choose the "Free Shipping" shipping method
 * Example #3: And I choose the "Best Way" shipping method
 * Example #4: When we choose the "Flat Rate" shipping method
 * Example #5: When choose the "Free Shipping" shipping method
 *
 */
When(/^(I |we )*choose the "([^"]*)" shipping method$/, async function (pronounCase, carrier) {
  await settle(this);
  const page = this.page;
  let radio;
  let titles;
  if (await page.locator('body.checkout-index-index').count()) {
    const rows = page.locator('#checkout-shipping-method-load tbody tr.row');
    await rows.first().waitFor({ state: 'visible', timeout: budget(this) });
    radio = rows.filter({ has: page.locator('td.col-carrier', { hasText: exactly(carrier) }) }).first().locator('input[type="radio"]');
    titles = await rows.locator('td.col-carrier').allInnerTexts();
  } else {
    const form = page.locator('#co-shipping-method-form');
    await form.locator('input[type="radio"]').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
    radio = form.locator('dt.item-title').filter({ hasText: exactly(carrier) }).first().locator('xpath=following-sibling::dd[1]').locator('input[type="radio"]').first();
    titles = await form.locator('dt.item-title').allInnerTexts();
  }
  if (!(await radio.count())) {
    throw friendly({ message: `There is no "${carrier}" shipping method. The methods: ${titles.map(clean).join(', ') || '(none; the address may be incomplete)'}.`, hint: 'Use the carrier title. On the cart page, estimate the shipping first; in the checkout, fill in the address first.' });
  }
  await radio.check();
  await settle(this);
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/**
 * Fail when the page is not the checkout.
 *
 * @param {object} world
 */
async function requireCheckout(world) {
  await settle(world);
  if (!(await world.page.locator('body.checkout-index-index').count())) {
    throw friendly({ message: 'This is not the checkout.', hint: CHECKOUT_HINT });
  }
}

/**
 * Fill the email of a guest in the shipping step of the checkout and wait
 * until the store has checked whether an account uses it.
 *
 * Example #1: When I fill in the checkout email with "guest@example.com"
 * Example #2: When I fill in the checkout email with "gail.guest@example.com"
 * Example #3: And I fill in the checkout email with "buyer@example.com"
 * Example #4: When we fill in the checkout email with "guest@example.com"
 * Example #5: When fill in the checkout email with "someone@example.com"
 *
 */
When(/^(I |we )*fill in the checkout email with "([^"]*)"$/, async function (pronounCase, email) {
  await requireCheckout(this);
  const field = this.page.locator('#customer-email');
  await actOrExplain('fill in the checkout email with', email, async () => {
    await field.fill(email, { timeout: budget(this) });
    await field.press('Tab');
  }, 'The email field shows for a guest only; a logged-in customer has none.');
  await settle(this);
});

// The fields of the shipping address form of the checkout, by label.
const CHECKOUT_FIELDS = {
  'first name': { name: 'firstname' },
  'last name': { name: 'lastname' },
  'company': { name: 'company' },
  'street address': { name: 'street[0]' },
  'street address: line 1': { name: 'street[0]' },
  'street address: line 2': { name: 'street[1]' },
  'country': { name: 'country_id', select: true },
  'state/province': { name: 'region_id', select: true },
  'city': { name: 'city' },
  'zip/postal code': { name: 'postcode' },
  'phone number': { name: 'telephone' },
};

/**
 * Fill the shipping address of the checkout from a table of label and value.
 * The labels are those of the form: First Name, Last Name, Company, Street
 * Address, Country, State/Province, City, Zip/Postal Code, Phone Number. The
 * shipping methods reload when the address changes: the step waits for them.
 *
 * Example #1: When I fill in the shipping address:
 * Example #2: And I fill in the shipping address:
 * Example #3: When we fill in the shipping address:
 * Example #4: When fill in the shipping address:
 * Example #5: And we fill in the shipping address:
 *
 */
When(/^(I |we )*fill in the shipping address:$/, async function (pronounCase, table) {
  await requireCheckout(this);
  const form = this.page.locator('#shipping-new-address-form');
  if (!(await form.isVisible().catch(() => false))) {
    throw friendly({ message: 'The shipping address form is not showing.', hint: 'A logged-in customer with an address book picks a saved address instead; a guest gets the form.' });
  }
  const rows = table.raw().map(([label, value]) => [clean(label), value]);
  // The state list depends on the country: the country goes first.
  rows.sort((a, b) => Number(b[0].toLowerCase() === 'country') - Number(a[0].toLowerCase() === 'country'));
  for (const [label, value] of rows) {
    const field = CHECKOUT_FIELDS[label.toLowerCase()];
    if (!field) {
      throw friendly({ message: `"${label}" is not a field of the shipping address.`, hint: `The fields: ${Object.keys(CHECKOUT_FIELDS).join(', ')}.` });
    }
    const control = form.locator(`[name="${field.name}"]`).first();
    await actOrExplain('fill in the shipping address field', label, async () => {
      if (field.select) {
        await control.selectOption({ label: value }, { timeout: budget(this) });
        await settle(this);
      } else {
        await control.fill(value, { timeout: budget(this) });
        await control.dispatchEvent('change');
      }
    }, 'Use the country and the state as the selects name them.');
  }
  await this.page.locator('#shipping-new-address-form [name="telephone"]').blur().catch(() => {});
  await settle(this);
});

/**
 * Press "Next" in the shipping step of the checkout and wait for the payment
 * step. When the form refuses (a required field is empty) the step ends on the
 * shipping step: follow it with a field error assertion.
 *
 * Example #1: When I continue to the payment step
 * Example #2: And I continue to the payment step
 * Example #3: When we continue to the payment step
 * Example #4: When continue to the payment step
 * Example #5: And we continue to the payment step
 *
 */
When(/^(I |we )*continue to the payment step$/, async function (pronounCase) {
  await requireCheckout(this);
  const page = this.page;
  await page.locator('#shipping-method-buttons-container button.continue').click();
  const limit = Date.now() + budget(this);
  while (Date.now() < limit) {
    if (/#payment$/.test(page.url())) break;
    if (await page.locator('#checkout .field-error:visible, #checkout div.mage-error:visible, #checkout .message.notice:visible, #checkout .message.error:visible').count()) break;
    await page.waitForTimeout(100);
  }
  await settle(this);
});

/**
 * Assert the step the checkout is on.
 *
 * Example #1: Then the checkout should be on the shipping step
 * Example #2: Then the checkout should be on the payment step
 * Example #3: And the checkout should be on the payment step
 * Example #4: And the checkout should be on the shipping step
 * Example #5: Then the checkout should be on the payment step
 *
 */
Then(/^the checkout should be on the (shipping|payment) step$/, async function (step) {
  await requireCheckout(this);
  await assertValue(this, async () => (/#payment$/.test(this.page.url()) ? 'payment' : 'shipping'), step, {
    label: 'the step of the checkout',
    hint: 'The checkout moves to the payment step when the address is complete and a shipping method is chosen.',
  });
});

/**
 * Choose a payment method of the payment step by its title ("Check / Money
 * order").
 *
 * Example #1: When I choose the "Check / Money order" payment method
 * Example #2: And I choose the "Check / Money order" payment method
 * Example #3: When we choose the "Check / Money order" payment method
 * Example #4: When I choose the "Cash On Delivery" payment method
 * Example #5: When I choose the "Bank Transfer Payment" payment method
 *
 */
When(/^(I |we )*choose the "([^"]*)" payment method$/, async function (pronounCase, title) {
  await requireCheckout(this);
  const method = this.page.locator('#checkout-payment-method-load .payment-method').filter({ has: this.page.locator('.payment-method-title label', { hasText: exactly(title) }) }).first();
  if (!(await method.count())) {
    const all = await this.page.locator('#checkout-payment-method-load .payment-method-title label').allInnerTexts().catch(() => []);
    throw friendly({ message: `There is no "${title}" payment method. The methods: ${all.map(clean).join(', ') || '(none; is the checkout on the payment step?)'}.`, hint: 'The payment methods are the ones enabled in the configuration of the store.' });
  }
  // With one method only the radio is hidden and the method is chosen already: the label is what a person clicks.
  if (!/(^|\s)_active(\s|$)/.test((await method.getAttribute('class')) || '')) {
    await method.locator('.payment-method-title label').click();
  }
  await assertValue(this, async () => (/(^|\s)_active(\s|$)/.test((await method.getAttribute('class')) || '') ? 'chosen' : 'not chosen'), 'chosen', {
    label: `the "${title}" payment method`,
    hint: 'The chosen method carries `_active` and shows its "Place Order" button.',
  });
  await settle(this);
});

/**
 * Press "Place Order" in the payment step and wait for the success page. The
 * order number of that page is remembered for the rest of the scenario as "the
 * last placed order".
 *
 * Example #1: When I place the order
 * Example #2: And I place the order
 * Example #3: When we place the order
 * Example #4: When place the order
 * Example #5: And we place the order
 *
 */
When(/^(I |we )*place the order$/, async function (pronounCase) {
  await requireCheckout(this);
  const page = this.page;
  const button = page.locator('.payment-method._active button.action.primary.checkout');
  await actOrExplain('place', 'the order', async () => {
    await button.waitFor({ state: 'visible', timeout: budget(this) });
    await button.click();
    await page.waitForURL(/checkout\/onepage\/success/, { timeout: budget(this) });
  }, 'The checkout must be on the payment step with a payment method chosen. An error of the store shows as a message above the payment methods.');
  await settle(this);
  const number = clean(await page.locator('.checkout-success .order-number, .checkout-success p > span').first().innerText().catch(() => ''));
  if (!/^\d+$/.test(number)) {
    throw friendly({ message: `The success page shows no order number (found "${number}").`, hint: 'The order number is in `.checkout-success`.' });
  }
  this.lastOrderNumber = number;
});

/**
 * Assert the page is the order confirmation ("Thank you for your purchase!")
 * with an order number.
 *
 * Example #1: Then I should see the order confirmation
 * Example #2: And I should see the order confirmation
 * Example #3: Then we should see the order confirmation
 * Example #4: Then should see the order confirmation
 * Example #5: And we should see the order confirmation
 *
 */
Then(/^(I |we )*should see the order confirmation$/, async function (pronounCase) {
  await settle(this);
  await assertPresence(this.page.locator('body.checkout-onepage-success .checkout-success'), null, {
    label: 'the order confirmation',
    hint: 'The confirmation is the page /checkout/onepage/success/ that follows "Place Order".',
    timeout: budget(this),
    found: async () => `the page "${clean(await this.page.title())}"`,
  });
  await assertValue(this, () => this.page.locator('.checkout-success .order-number, .checkout-success p > span').first().innerText(), /^\d+$/, {
    label: 'the order number of the confirmation',
    hint: 'A guest sees the number as text, a customer as a link to the order.',
  });
});

// ---------------------------------------------------------------------------
// Customer account
// ---------------------------------------------------------------------------

// The pages of the customer account, by the name of their entry.
const ACCOUNT_PAGES = {
  'account': 'customer/account/',
  'orders': 'sales/order/history/',
  'wish list': 'wishlist/',
  'address book': 'customer/address/',
  'account information': 'customer/account/edit/',
  'product reviews': 'review/customer/',
  'newsletter subscriptions': 'newsletter/manage/',
};

/**
 * Open a page of the customer account by its name: "account", "orders", "wish
 * list", "address book", "account information", "product reviews",
 * "newsletter subscriptions". A guest is sent to the sign-in page by the
 * store.
 *
 * Example #1: When I go to my "orders" account page
 * Example #2: When I go to my "address book" account page
 * Example #3: And I go to my "wish list" account page
 * Example #4: When we go to our "account" account page
 * Example #5: Given I am on my "newsletter subscriptions" account page
 *
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) (?:my|our) "([^"]*)" account page$/, async function (name) {
  const key = clean(name).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(ACCOUNT_PAGES, key)) {
    throw friendly({ message: `"${name}" is not a known account page.`, hint: `Use one of: ${Object.keys(ACCOUNT_PAGES).join(', ')}.` });
  }
  await open(this, siteUrl(this, ACCOUNT_PAGES[key]));
});

/**
 * Assert the order history of the customer lists (or does not list) the last
 * placed order, optionally with a status.
 *
 * Example #1: Then my order history should list the last placed order
 * Example #2: Then my order history should list the last placed order as "Pending"
 * Example #3: And my order history should not list the last placed order
 * Example #4: Then our order history should list the last placed order as "Complete"
 * Example #5: Then my order history should list the last placed order as "Canceled"
 *
 */
Then(/^(?:my|our) order history should( not)* list the last placed order(?: as "([^"]*)")?$/, async function (notCase, status) {
  if (!this.lastOrderNumber) {
    throw friendly({ message: 'No order was placed in this scenario.', hint: 'Place one first: `When I place the order`.' });
  }
  await open(this, siteUrl(this, 'sales/order/history/'));
  const row = this.page.locator('#my-orders-table tbody tr').filter({ has: this.page.locator('td.id', { hasText: exactly(this.lastOrderNumber) }) });
  await assertPresence(row, notCase, {
    label: `the order "${this.lastOrderNumber}" in the order history`,
    hint: 'The history is the "My Orders" page of the account of the customer who placed the order.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => `the orders "${clean(await this.page.locator('#my-orders-table tbody').innerText().catch(() => 'none'))}"`,
  });
  if (status && !notCase) {
    await assertValue(this, () => row.first().locator('td.status').innerText(), status, { label: `the status of the order "${this.lastOrderNumber}" in the order history`, hint: 'The status follows what the back office did with the order.' });
  }
});

// The fields of the address form of the address book, by label.
const ADDRESS_FIELDS = {
  'first name': { id: 'firstname' },
  'last name': { id: 'lastname' },
  'company': { id: 'company' },
  'phone number': { id: 'telephone' },
  'street address': { id: 'street_1' },
  'country': { id: 'country', select: true },
  'state/province': { id: 'region_id', select: true },
  'city': { id: 'city' },
  'zip/postal code': { id: 'zip' },
};

/**
 * Add an address to the address book of the logged-in customer from a table of
 * label and value (First Name, Last Name, Company, Phone Number, Street
 * Address, Country, State/Province, City, Zip/Postal Code; the names are
 * prefilled). The step ends on the address book: follow it with a message
 * assertion.
 *
 * Example #1: When I add the address:
 * Example #2: And I add the address:
 * Example #3: When we add the address:
 * Example #4: When add the address:
 * Example #5: And we add the address:
 *
 */
When(/^(I |we )*add the address:$/, async function (pronounCase, table) {
  await open(this, siteUrl(this, 'customer/address/new/'));
  const form = this.page.locator('#form-validate');
  if (!(await form.locator('#street_1').count())) {
    throw friendly({ message: 'The store did not open the new address form.', hint: 'Log in as a customer first: `Given I am logged in as the customer "customer"`.' });
  }
  const rows = table.raw().map(([label, value]) => [clean(label), value]);
  rows.sort((a, b) => Number(b[0].toLowerCase() === 'country') - Number(a[0].toLowerCase() === 'country'));
  for (const [label, value] of rows) {
    const field = ADDRESS_FIELDS[label.toLowerCase()];
    if (!field) {
      throw friendly({ message: `"${label}" is not a field of the address form.`, hint: `The fields: ${Object.keys(ADDRESS_FIELDS).join(', ')}.` });
    }
    const control = form.locator('#' + field.id);
    await actOrExplain('fill in the address field', label, async () => {
      if (field.select) await control.selectOption({ label: value }, { timeout: budget(this) });
      else await control.fill(value, { timeout: budget(this) });
    }, 'Use the country and the state as the selects name them.');
  }
  await actAndSettle(this, () => form.locator('button.action.save').click({ noWaitAfter: true }));
});

/**
 * Assert the address book of the customer holds (or does not hold) an address
 * with a text (a street, a city).
 *
 * Example #1: Then my address book should contain "9 Test Road"
 * Example #2: Then my address book should not contain "9 Test Road"
 * Example #3: And my address book should contain "100 Main Street"
 * Example #4: Then our address book should contain "Dallas"
 * Example #5: Then my address book should not contain "Nowhere"
 *
 */
Then(/^(?:my|our) address book should( not)* contain "([^"]*)"$/, async function (notCase, text) {
  if (!(await this.page.locator('body.customer-address-index').count())) await open(this, siteUrl(this, 'customer/address/'));
  await settle(this);
  await assertPresence(this.page.locator('.block-addresses-default address, #additional-addresses-table tbody tr').filter({ hasText: literal(text) }), notCase, {
    label: `an address with "${text}" in the address book`,
    hint: 'The address book lists the default addresses and, in a table, the additional ones.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Delete an additional address of the address book by a text of it (its
 * street) and accept the confirmation.
 *
 * Example #1: When I delete the address "9 Test Road"
 * Example #2: And I delete the address "9 Test Road"
 * Example #3: When we delete the address "12 Side Street"
 * Example #4: When delete the address "9 Test Road"
 * Example #5: And we delete the address "Dallas"
 *
 */
When(/^(I |we )*delete the address "([^"]*)"$/, async function (pronounCase, text) {
  if (!(await this.page.locator('body.customer-address-index').count())) await open(this, siteUrl(this, 'customer/address/'));
  await settle(this);
  const row = this.page.locator('#additional-addresses-table tbody tr').filter({ hasText: literal(text) }).first();
  if (!(await row.count())) {
    throw friendly({ message: `The address book has no additional address with "${text}".`, hint: 'Only an additional address can be deleted; a default address is changed instead.' });
  }
  await row.locator('a.delete').click();
  await answerDialog(this, true);
});

/**
 * Make sure the address book of the logged-in customer has no additional
 * address with a text: every match is deleted. The clean-up of an address a
 * scenario adds.
 *
 * Example #1: Given my address book has no address "9 Test Road"
 * Example #2: And my address book has no address "9 Test Road"
 * Example #3: Given our address book has no address "12 Side Street"
 * Example #4: And my address book has no address "Dallas"
 * Example #5: Given my address book has no address "Temporary"
 *
 */
Given(/^(?:my|our) address book has no address "([^"]*)"$/, async function (text) {
  for (let pass = 0; pass < 20; pass += 1) {
    await open(this, siteUrl(this, 'customer/address/'));
    const row = this.page.locator('#additional-addresses-table tbody tr').filter({ hasText: literal(text) }).first();
    if (!(await row.count())) return;
    await row.locator('a.delete').click();
    await answerDialog(this, true);
  }
});

// ---------------------------------------------------------------------------
// Wish list and comparison list
// ---------------------------------------------------------------------------

/**
 * Press "Add to Wish List" or "Add to Compare" on a product page and wait for
 * the store to answer. The wish list needs a logged-in customer and ends on the
 * wish list page; the comparison list stays on the product page.
 *
 * Example #1: When I add the product to my wish list
 * Example #2: When I add the product to the comparison list
 * Example #3: And I add the product to my wish list
 * Example #4: When we add the product to our wish list
 * Example #5: And we add the product to the comparison list
 *
 */
When(/^(I |we )*add the product to (?:(?:my|our) (wish) list|the comparison list)$/, async function (pronounCase, wish) {
  await settle(this);
  const link = this.page.locator(wish ? '.product-info-main a.action.towishlist' : '.product-info-main a.action.tocompare').first();
  await actOrExplain('add the product to', wish ? 'the wish list' : 'the comparison list', async () => {
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await actAndSettle(this, () => link.click({ noWaitAfter: true }));
    await messages(this).first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The links are next to "Add to Cart" on a product page. A guest who adds to the wish list is sent to the sign-in page.');
  await settle(this);
});

/**
 * Assert the wish list of the customer holds (or does not hold) a product.
 *
 * Example #1: Then my wish list should contain "Joust Duffle Bag"
 * Example #2: Then my wish list should not contain "Joust Duffle Bag"
 * Example #3: And my wish list should contain "Radiant Tee"
 * Example #4: Then our wish list should contain "Aim Analog Watch"
 * Example #5: Then my wish list should not contain "Test Bag"
 *
 */
Then(/^(?:my|our) wish list should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  if (!(await this.page.locator('body.wishlist-index-index').count())) await open(this, siteUrl(this, 'wishlist/'));
  await settle(this);
  await assertPresence(this.page.locator('.products-grid.wishlist .product-item-name').filter({ hasText: exactly(name) }), notCase, {
    label: `"${name}" in the wish list`,
    hint: 'The wish list is the "My Wish List" page of the account.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Remove a product from the wish list. Its "Remove item" link shows only while
 * the pointer is over the product: the step hovers it first, as a person
 * does. It does nothing when the product is not in the list, so it can open a
 * scenario as a clean-up.
 *
 * Example #1: When I remove "Joust Duffle Bag" from my wish list
 * Example #2: And I remove "Radiant Tee" from my wish list
 * Example #3: When we remove "Aim Analog Watch" from our wish list
 * Example #4: Given I remove "Joust Duffle Bag" from my wish list
 * Example #5: When remove "Radiant Tee" from my wish list
 *
 */
When(/^(I |we )*remove "([^"]*)" from (?:my|our) wish list$/, async function (pronounCase, name) {
  await open(this, siteUrl(this, 'wishlist/'));
  for (let pass = 0; pass < 10; pass += 1) {
    const item = this.page.locator('.products-grid.wishlist .product-item').filter({ has: this.page.locator('.product-item-name', { hasText: exactly(name) }) }).first();
    if (!(await item.count())) return;
    await item.hover();
    const remove = item.locator('a[data-role="remove"]');
    await remove.waitFor({ state: 'visible', timeout: budget(this) });
    await actAndSettle(this, () => remove.click({ noWaitAfter: true }));
  }
});

/**
 * Assert the comparison list holds (or does not hold) a product.
 *
 * Example #1: Then the comparison list should contain "Joust Duffle Bag"
 * Example #2: Then the comparison list should not contain "Joust Duffle Bag"
 * Example #3: And the comparison list should contain "Radiant Tee"
 * Example #4: Then the comparison list should contain "Aim Analog Watch"
 * Example #5: Then the comparison list should not contain "Test Bag"
 *
 */
Then(/^the comparison list should( not)* contain "([^"]*)"$/, async function (notCase, name) {
  if (!(await this.page.locator('body.catalog-product_compare-index').count())) await open(this, siteUrl(this, 'catalog/product_compare/'));
  await settle(this);
  await assertPresence(this.page.locator('#product-comparison .product-item-name').filter({ hasText: exactly(name) }), notCase, {
    label: `"${name}" in the comparison list`,
    hint: 'The comparison list is the "Compare Products" page.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Remove every product from the comparison list (each removal is confirmed).
 * It does nothing when the list is empty.
 *
 * Example #1: When I empty the comparison list
 * Example #2: And I empty the comparison list
 * Example #3: When we empty the comparison list
 * Example #4: Given I empty the comparison list
 * Example #5: When empty the comparison list
 *
 */
When(/^(I |we )*empty the comparison list$/, async function (pronounCase) {
  for (let pass = 0; pass < 20; pass += 1) {
    await open(this, siteUrl(this, 'catalog/product_compare/'));
    const remove = this.page.locator('#product-comparison a.action.delete').first();
    if (!(await remove.count())) return;
    await remove.click();
    await answerDialog(this, true);
  }
});

// ---------------------------------------------------------------------------
// Reviews, newsletter
// ---------------------------------------------------------------------------

/**
 * Submit a review of the product of the page: the Reviews tab is opened, the
 * stars are set, the summary and the text are filled, and the form is sent. A
 * guest gives a nickname; a customer's is prefilled. With "without a rating"
 * the stars are left empty, for the validation scenario. Follow it with a
 * message or a field error assertion.
 *
 * Example #1: When I review the product with 4 stars, the summary "Good bag" and the text "It holds everything."
 * Example #2: When I review the product with 5 stars, the summary "Great" and the text "Would buy again." as "Gail"
 * Example #3: And I review the product with 1 star, the summary "Poor" and the text "It broke."
 * Example #4: When we review the product without a rating, the summary "No stars" and the text "Forgot the stars."
 * Example #5: When I review the product with 3 stars, the summary "Fine" and the text "It is fine." as "Sam"
 *
 */
When(/^(I |we )*review the product (?:with (\d) stars?|without a rating), the summary "([^"]*)" and the text "([^"]*)"(?: as "([^"]*)")?$/, async function (pronounCase, stars, summary, text, nickname) {
  await settle(this);
  const page = this.page;
  const form = page.locator('#review-form');
  await actOrExplain('review', 'the product', async () => {
    if (!(await form.isVisible().catch(() => false))) {
      await page.locator('#tab-label-reviews-title').click({ timeout: budget(this) });
      await settle(this);
    }
    await form.waitFor({ state: 'visible', timeout: budget(this) });
    if (stars) {
      // The star labels lie on top of each other from the same left edge (label
      // n is n stars wide): the right end of label n is the only part of it that
      // no smaller label covers.
      const label = form.locator(`#Rating_${stars}_label`);
      await label.scrollIntoViewIfNeeded();
      const box = await label.boundingBox();
      await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2);
      if (!(await form.locator(`#Rating_${stars}`).isChecked())) throw new Error(`the ${stars}-star rating did not take the click`);
    }
    if (nickname) await form.locator('#nickname_field').fill(nickname);
    await form.locator('#summary_field').fill(summary);
    await form.locator('#review_field').fill(text);
    await actAndSettle(this, () => form.locator('button.submit').click({ noWaitAfter: true }));
  }, 'The review form is in the "Reviews" tab of a product page. A guest can review when the store allows it (Stores > Configuration > Catalog > Product Reviews).');
});

/**
 * Subscribe an email address to the newsletter with the form of the footer.
 * Follow it with a message or a field error assertion.
 *
 * Example #1: When I subscribe "reader@example.com" to the newsletter
 * Example #2: When I subscribe "not-an-email" to the newsletter
 * Example #3: And I subscribe "customer@example.com" to the newsletter
 * Example #4: When we subscribe "reader@example.com" to the newsletter
 * Example #5: When subscribe "another.reader@example.com" to the newsletter
 *
 */
When(/^(I |we )*subscribe "([^"]*)" to the newsletter$/, async function (pronounCase, email) {
  await settle(this);
  const form = this.page.locator('#newsletter-validate-detail');
  await actOrExplain('subscribe to the newsletter', email, async () => {
    await form.locator('#newsletter').fill(email, { timeout: budget(this) });
    await actAndSettle(this, () => form.locator('button.subscribe').click({ noWaitAfter: true }));
  }, 'The newsletter form is in the footer of every store page.');
});

// ---------------------------------------------------------------------------
// Store forms
// ---------------------------------------------------------------------------

/**
 * The visible field of a store form with a label.
 *
 * @param {object} world
 * @param {string} label
 * @returns {import('playwright').Locator}
 */
function storeField(world, label) {
  return world.page.locator('.field:visible').filter({ has: world.page.locator(':scope > label, :scope > legend, :scope > .label', { hasText: exactly(label) }) });
}

/**
 * Fill a field of a store form (registration, contact, account) found by the
 * label of its visible field. The generic `I fill in "Password" with "…"` of
 * webship-js looks a field up by its label alone, and every store page also
 * holds the hidden sign-in popup with an "Email" and a "Password" of its own:
 * this step takes the field a person sees. A select takes the option text, a
 * checkbox "yes" or "no".
 *
 * Example #1: When I fill in the "First Name" store field with "Mia"
 * Example #2: When I fill in the "Password" store field with "Secret123456789!"
 * Example #3: And I fill in the "Confirm Password" store field with "Secret123456789!"
 * Example #4: When we fill in the "Email" store field with "mia@example.com"
 * Example #5: When I fill in the "What’s on your mind?" store field with "A question."
 *
 */
When(/^(I |we )*fill in the "([^"]*)" store field with "([^"]*)"$/, async function (pronounCase, label, value) {
  await settle(this);
  const field = storeField(this, label).first();
  if (!(await field.count())) {
    const labels = await this.page.locator('main .field:visible > label, main .field:visible > .label').allInnerTexts().catch(() => []);
    throw friendly({ message: `The page has no visible "${label}" field. Its fields: ${[...new Set(labels.map(clean).filter(Boolean))].join(', ') || '(none)'}.`, hint: 'Use the label as the form shows it, without the asterisk.' });
  }
  const control = field.locator('input:not([type="hidden"]), select, textarea').first();
  const info = await control.evaluate((el) => ({ tag: el.tagName, type: (el.getAttribute('type') || '').toLowerCase() }));
  await actOrExplain('fill in the store field', label, async () => {
    if (info.tag === 'SELECT') await control.selectOption({ label: value }, { timeout: budget(this) });
    else if (info.type === 'checkbox') await control.setChecked(/^(yes|on|true|1)$/i.test(clean(value)));
    else await control.fill(value, { timeout: budget(this) });
  }, 'A select takes the text of an option.');
});

/**
 * Press a button of the main content of a store page by its text ("Create an
 * Account", "Submit", "Save", "Save Address") and wait for what follows. The
 * header and the footer hold links and buttons with the same texts ("Create an
 * Account", "Sign In"): this step takes the one of the form.
 *
 * Example #1: When I press the "Create an Account" store button
 * Example #2: When I press the "Submit" store button
 * Example #3: And I press the "Save" store button
 * Example #4: When we press the "Save Address" store button
 * Example #5: When I press the "Sign In" store button
 *
 */
When(/^(I |we )*press the "([^"]*)" store button$/, async function (pronounCase, name) {
  await settle(this);
  const button = this.page.locator('main button:visible').filter({ hasText: exactly(name) }).first();
  if (!(await button.count())) {
    const all = await this.page.locator('main button:visible').allInnerTexts().catch(() => []);
    throw friendly({ message: `The page has no "${name}" button in its main content. Its buttons: ${[...new Set(all.map(clean).filter(Boolean))].join(', ') || '(none)'}.`, hint: 'Use the text of the button as the form shows it.' });
  }
  await actAndSettle(this, () => button.click({ noWaitAfter: true }));
});

// ---------------------------------------------------------------------------
// Field errors
// ---------------------------------------------------------------------------

/**
 * Assert the store shows (or does not show) a validation error under a field:
 * of a store form (sign-in, registration, contact, review, newsletter, the
 * product options) or of the checkout. With `for "…"` the error must belong to
 * the field with that label.
 *
 * Example #1: Then I should see the field error "This is a required field."
 * Example #2: Then I should see the field error "This is a required field." for "First Name"
 * Example #3: And I should not see the field error "This is a required field." for "Email"
 * Example #4: Then we should see the field error "Please enter a valid email address (Ex: johndoe@domain.com)."
 * Example #5: Then I should see the field error "Please select one of each of the ratings above."
 *
 */
Then(/^(I |we )*should( not)* see the field error "([^"]*)"(?: for "([^"]*)")?$/, async function (pronounCase, notCase, text, label) {
  await settle(this);
  const page = this.page;
  let errors = page.locator('div.mage-error:visible, .field-error:visible');
  if (label) {
    errors = storeField(this, label).locator('div.mage-error, .field-error');
  }
  await assertPresence(errors.filter({ hasText: literal(text) }), notCase, {
    label: `the field error "${text}"` + (label ? ` for "${label}"` : ''),
    hint: 'A store form validates when it is submitted; the error shows under its field.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => {
      const all = await page.locator('div.mage-error:visible, .field-error:visible').allInnerTexts().catch(() => []);
      return all.length ? `the errors ${[...new Set(all.map(clean))].map((error) => `"${error}"`).join(', ')}` : 'no field error';
    },
  });
});
