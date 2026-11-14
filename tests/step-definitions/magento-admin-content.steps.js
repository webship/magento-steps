'use strict';

// Admin panel content step definitions: products (the gallery, a product by
// SKU), the category tree, orders (open, status, comments, hold, invoice, ship,
// credit memo, cancel), customers, the configuration, the cache and index
// state, and the clean-up of what a scenario created.
//
// The generic admin steps (session, pages, menu, grids, forms) are in
// magento-admin.steps.js.
//
// The selectors come from the pages as a browser shows them; see
// exploration/03…05 in the repository.

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  literal,
  exactly,
  settle,
  actAndSettle,
  actOrExplain,
  assertPresence,
  assertValue,
  messages,
  messagesSeen,
  dialog,
  answerDialog,
  adminRoute,
  openAdmin,
  requireAdminSession,
  grid,
  gridRows,
  gridSeen,
  clearGrid,
  searchGrid,
  filterGrid,
  selectGridRows,
  runGridAction,
  openGridRow,
} = require('./magento-helpers');

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Open the edit form of a product by its SKU: the products grid is searched
 * for the SKU and the row is opened.
 *
 * Example #1: When I open the product "24-MB01" in the admin panel
 * Example #2: When I open the product "TEST-SKU-1" in the admin panel
 * Example #3: And I open the product "WS12" in the admin panel
 * Example #4: When we open the product "24-MB01" in the admin panel
 * Example #5: When open the product "24-WG080" in the admin panel
 *
 */
When(/^(I |we )*open the product "([^"]*)" in the admin panel$/, async function (pronounCase, sku) {
  await openAdmin(this, adminRoute('products'), 'products');
  await clearGrid(this);
  await searchGrid(this, sku);
  const g = await grid(this);
  const index = (await g.table.locator('thead tr').first().locator('th').allInnerTexts()).map(clean).indexOf('SKU');
  const count = await g.rows.count();
  for (let i = 0; i < count; i += 1) {
    if (clean(await g.rows.nth(i).locator(':scope > td').nth(index).innerText()) === sku) {
      await actAndSettle(this, () => g.rows.nth(i).locator('td.data-grid-actions-cell a').first().click({ noWaitAfter: true }));
      // The keyword must not stay behind for the next visit of the grid.
      return;
    }
  }
  throw friendly({
    message: `The products grid has no product with the SKU "${sku}". The search shows ${await gridSeen(g)}.`,
    hint: 'Check the SKU. A product a scenario creates must be saved before it can be opened.',
  });
});

/**
 * Upload an image file to the gallery of the product form ("Images And
 * Videos"). The file is looked up in `tests/fixtures/` of the project, then of
 * this pack.
 *
 * Example #1: When I add the image "pixel.png" to the product gallery
 * Example #2: And I add the image "pixel.png" to the product gallery
 * Example #3: When we add the image "pixel.png" to the product gallery
 * Example #4: When I add the image "photo.jpg" to the product gallery
 * Example #5: When add the image "pixel.png" to the product gallery
 *
 */
When(/^(I |we )*add the image "([^"]*)" to the product gallery$/, async function (pronounCase, file) {
  const candidates = [path.resolve(process.cwd(), 'tests', 'fixtures', file), path.resolve(__dirname, '..', 'fixtures', file), path.resolve(process.cwd(), file)];
  const source = candidates.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    throw friendly({ message: `The image "${file}" was not found.`, hint: `Put it in tests/fixtures/ of the project. Looked in: ${candidates.join(', ')}.` });
  }
  const gallery = this.page.locator('#media_gallery_content');
  if (!(await gallery.isVisible().catch(() => false))) {
    throw friendly({ message: 'The product gallery is not open.', hint: 'Open its section first: `When I open the "Images And Videos" form section`.' });
  }
  const before = await gallery.locator('.image.item:visible').count();
  await gallery.locator('input[type="file"]').first().setInputFiles(source);
  await assertValue(this, async () => String(await gallery.locator('.image.item:visible').count()), String(before + 1), {
    label: 'the number of images in the product gallery',
    hint: 'The upload goes to the admin gallery upload address; a refused file shows a dialog with the reason.',
  });
  await settle(this);
});

/**
 * Assert how many images the gallery of the product form holds.
 *
 * Example #1: Then the product gallery should have 1 image
 * Example #2: Then the product gallery should have 0 images
 * Example #3: And the product gallery should have 2 images
 * Example #4: Then the product gallery should have 3 images
 * Example #5: Then the product gallery should have 5 images
 *
 */
Then(/^the product gallery should have (\d+) images?$/, async function (count) {
  const gallery = this.page.locator('#media_gallery_content');
  if (!(await gallery.isVisible().catch(() => false))) {
    throw friendly({ message: 'The product gallery is not open.', hint: 'Open its section first: `When I open the "Images And Videos" form section`.' });
  }
  await assertValue(this, async () => String(await gallery.locator('.image.item:visible').count()), String(count), {
    label: 'the number of images in the product gallery',
    hint: 'The images are the `.image.item` tiles of `#media_gallery_content`.',
  });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * The node of the category tree with a name. The tree prints a node as
 * "Gear (ID: 3) (46)": the name is what comes before " (ID:".
 *
 * @param {object} world
 * @param {string} name
 * @returns {import('playwright').Locator}
 */
function categoryNode(world, name) {
  const pattern = new RegExp('^\\s*' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+\\(ID: \\d+\\)');
  return world.page.locator('#tree-div a.jstree-anchor').filter({ hasText: pattern });
}

/**
 * Make sure the category tree is on the page and every level is open.
 *
 * @param {object} world
 */
async function openCategoryTree(world) {
  const page = world.page;
  if (!(await page.locator('#tree-div').count())) {
    await openAdmin(world, adminRoute('categories'), 'categories');
  }
  await settle(world);
  await page.locator('#tree-div a.jstree-anchor').first().waitFor({ state: 'visible', timeout: budget(world) });
  const expand = page.locator('#expandAll');
  if (await expand.count()) {
    await expand.click();
    await assertValue(world, async () => String(await page.locator('#tree-div li.jstree-closed').count()), '0', {
      label: 'the number of closed nodes of the category tree',
      hint: '"Expand All" opens every level of the tree.',
    });
  }
}

/**
 * Select a category in the tree of the Categories page by its name; its form
 * opens on the right.
 *
 * Example #1: When I select the "Gear" category in the tree
 * Example #2: When I select the "Bags" category in the tree
 * Example #3: And I select the "Default Category" category in the tree
 * Example #4: When we select the "Women" category in the tree
 * Example #5: When select the "Sale" category in the tree
 *
 */
When(/^(I |we )*select the "([^"]*)" category in the tree$/, async function (pronounCase, name) {
  await openCategoryTree(this);
  const node = categoryNode(this, name).first();
  if (!(await node.count())) {
    const all = await this.page.locator('#tree-div a.jstree-anchor').allInnerTexts();
    throw friendly({ message: `The category tree has no "${name}". It holds: ${all.map((text) => clean(text).replace(/\s+\(ID:.*$/, '')).join(', ')}.`, hint: 'Use the category name without its "(ID: n)" suffix.' });
  }
  await actAndSettle(this, () => node.click({ noWaitAfter: true }));
  await assertValue(this, () => this.page.locator('h1.page-title').first().innerText(), new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(ID: \\d+\\)$'), {
    label: 'the title of the category form',
    hint: 'The form of the selected category shows its name and id as the page title.',
  });
});

/**
 * Assert a category is (or is not) in the tree of the Categories page.
 *
 * Example #1: Then I should see the "Gear" category in the tree
 * Example #2: Then I should not see the "Test Category" category in the tree
 * Example #3: And I should see the "Bags" category in the tree
 * Example #4: Then we should see the "Women" category in the tree
 * Example #5: Then should not see the "Old Stuff" category in the tree
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" category in the tree$/, async function (pronounCase, notCase, name) {
  await openCategoryTree(this);
  await assertPresence(categoryNode(this, name), notCase, {
    label: `the category "${name}" in the tree`,
    hint: 'The tree is `#tree-div`; a new category shows under its parent once it is saved.',
    timeout: notCase ? 3000 : budget(this),
  });
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * The order number a step refers to: a literal number, or the one the last
 * `I place the order` step of the scenario read from the success page.
 *
 * @param {object} world
 * @param {string|undefined} number
 * @returns {string}
 */
function orderNumber(world, number) {
  if (number) return number;
  if (!world.lastOrderNumber) {
    throw friendly({ message: 'No order was placed in this scenario, so there is no "last placed order".', hint: 'Place one first (`When I place the order`), or name the order: `the order "000000003"`.' });
  }
  return world.lastOrderNumber;
}

/**
 * Open the view page of an order in the admin panel: the orders grid is
 * searched for the order number and its "View" link is followed. "The last
 * placed order" is the one the scenario placed on the storefront.
 *
 * Example #1: When I open the order "000000003" in the admin panel
 * Example #2: When I open the last placed order in the admin panel
 * Example #3: And I open the order "000000001" in the admin panel
 * Example #4: When we open the last placed order in the admin panel
 * Example #5: When open the order "000000002" in the admin panel
 *
 */
When(/^(I |we )*open (?:the order "([^"]*)"|the last placed order) in the admin panel$/, async function (pronounCase, number) {
  const wanted = orderNumber(this, number);
  await openAdmin(this, adminRoute('orders'), 'orders');
  await clearGrid(this);
  await searchGrid(this, wanted);
  const g = await grid(this);
  if (!(await gridRows(g, wanted).count())) {
    throw friendly({ message: `The orders grid has no order "${wanted}". The search shows ${await gridSeen(g)}.`, hint: 'The order number is the one of the checkout success page.' });
  }
  await openGridRow(this, wanted);
  await assertValue(this, () => this.page.locator('h1.page-title').first().innerText(), '#' + wanted, { label: 'the title of the order page', hint: 'The order view shows "#<number>" as its title.' });
});

/**
 * Assert the last placed order is (or is not) in the orders grid of the admin
 * panel: the round trip from the storefront checkout to the back office.
 *
 * Example #1: Then I should see the last placed order in the orders grid
 * Example #2: And I should see the last placed order in the orders grid
 * Example #3: Then we should see the last placed order in the orders grid
 * Example #4: Then I should not see the last placed order in the orders grid
 * Example #5: Then should see the last placed order in the orders grid
 *
 */
Then(/^(I |we )*should( not)* see the last placed order in the orders grid$/, async function (pronounCase, notCase) {
  const wanted = orderNumber(this);
  await openAdmin(this, adminRoute('orders'), 'orders');
  await clearGrid(this);
  await searchGrid(this, wanted);
  const g = await grid(this);
  await assertPresence(gridRows(g, wanted), notCase, {
    label: `the order "${wanted}" in the orders grid`,
    hint: 'The orders grid is filled when an order is placed (asynchronous grid indexing must be off on a test site).',
    timeout: notCase ? 3000 : budget(this),
    found: () => gridSeen(g),
  });
});

/**
 * Assert the status of the order on its view page ("Pending", "Processing",
 * "Complete", "Closed", "Canceled", "On Hold").
 *
 * Example #1: Then the order status should be "Pending"
 * Example #2: Then the order status should be "Processing"
 * Example #3: And the order status should be "Complete"
 * Example #4: Then the order status should not be "Canceled"
 * Example #5: Then the order status should be "On Hold"
 *
 */
Then(/^the order status should( not)* be "([^"]*)"$/, async function (notCase, status) {
  await settle(this);
  if (!(await this.page.locator('#order_status').count())) {
    throw friendly({ message: 'This is not the view page of an order.', hint: 'Open the order first: `When I open the last placed order in the admin panel`.' });
  }
  await assertValue(this, () => this.page.locator('#order_status').innerText(), status, { label: 'the order status', notCase, hint: 'The status is `#order_status` of the order view.' });
});

/**
 * Add a comment to the order ("Notes for this Order" on the Information tab)
 * and wait for it to show in the list.
 *
 * Example #1: When I add the order comment "Checked by the test suite"
 * Example #2: And I add the order comment "Customer called"
 * Example #3: When we add the order comment "Waiting for stock"
 * Example #4: When I add the order comment "Packed"
 * Example #5: When add the order comment "Second note"
 *
 */
When(/^(I |we )*add the order comment "([^"]*)"$/, async function (pronounCase, text) {
  await settle(this);
  const box = this.page.locator('#history_comment');
  await actOrExplain('add the order comment', text, async () => {
    await box.fill(text, { timeout: budget(this) });
    await this.page.locator('#order_history_block button.action-save').click();
    await this.page.locator('#order_history_block .note-list li').filter({ hasText: literal(text) }).first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The comment box is on the Information tab of the order view (`#history_comment`).');
  await settle(this);
});

/**
 * Assert a comment is (or is not) in the notes of the order.
 *
 * Example #1: Then I should see the order comment "Checked by the test suite"
 * Example #2: Then I should not see the order comment "Something else"
 * Example #3: And I should see the order comment "Customer called"
 * Example #4: Then we should see the order comment "Packed"
 * Example #5: Then should see the order comment "Waiting for stock"
 *
 */
Then(/^(I |we )*should( not)* see the order comment "([^"]*)"$/, async function (pronounCase, notCase, text) {
  await assertPresence(this.page.locator('#order_history_block .note-list li').filter({ hasText: literal(text) }), notCase, {
    label: `the order comment "${text}"`,
    hint: 'The notes are listed under "Notes for this Order" on the Information tab.',
    timeout: notCase ? 3000 : budget(this),
    found: async () => `the notes "${clean(await this.page.locator('#order_history_block .note-list').innerText().catch(() => ''))}"`,
  });
});

// The order operations: the button of the order view, the submit button of the
// page it opens (if any), whether it asks for a confirmation, and the message.
const ORDER_OPERATIONS = {
  'invoice': { button: '#order_invoice', submit: 'button.submit-button', message: 'The invoice has been created.' },
  'ship': { button: '#order_ship', submit: 'button.submit-button', message: 'The shipment has been created.' },
  'refund': { button: '#order_creditmemo', submit: 'button.submit-button', message: 'You created the credit memo.' },
  'hold': { button: '#order-view-hold-button', message: 'You put the order on hold.' },
  'unhold': { button: '#order-view-unhold-button', message: 'You released the order from holding status.' },
  'cancel': { button: '#order-view-cancel-button', confirm: true, message: 'You canceled the order.' },
};

/**
 * Run an operation of the order view and wait for its message.
 *
 * @param {object} world
 * @param {string} name
 */
async function orderOperation(world, name) {
  const page = world.page;
  const operation = ORDER_OPERATIONS[name];
  await settle(world);
  const button = page.locator(operation.button);
  if (!(await button.count())) {
    const all = await page.locator('.page-main-actions:visible').first().locator('button:visible').allInnerTexts().catch(() => []);
    throw friendly({
      message: `The order cannot be ${name === 'ship' ? 'shipped' : name === 'hold' ? 'put on hold' : name + (name.endsWith('e') ? 'd' : 'ed')} now. Its buttons: ${all.map(clean).filter(Boolean).join(', ') || '(none; is this an order view?)'}.`,
      hint: 'The buttons follow the state of the order: an invoice is needed before a credit memo, a shipped and invoiced order is complete.',
    });
  }
  await actAndSettle(world, () => button.click({ noWaitAfter: true }));
  if (operation.confirm) await answerDialog(world, true);
  if (operation.submit) {
    const submit = page.locator(operation.submit).first();
    await submit.waitFor({ state: 'visible', timeout: budget(world) });
    await settle(world);
    await actAndSettle(world, () => submit.click({ noWaitAfter: true }));
  }
  await assertPresence(messages(world, 'success', operation.message), null, {
    label: `the message "${operation.message}"`,
    hint: 'The operation did not finish: read the message the page shows.',
    timeout: budget(world),
    found: () => messagesSeen(world),
  });
}

/**
 * Create the invoice, the shipment or the offline credit memo of the open
 * order with the default values of its form, and wait for the success message
 * ("The invoice has been created.", "The shipment has been created.", "You
 * created the credit memo.").
 *
 * Example #1: When I invoice the order
 * Example #2: When I ship the order
 * Example #3: When I refund the order
 * Example #4: And we invoice the order
 * Example #5: When we ship the order
 *
 */
When(/^(I |we )*(invoice|ship|refund) the order$/, async function (pronounCase, name) {
  await orderOperation(this, name);
});

/**
 * Put the open order on hold, release it, or cancel it (the confirmation is
 * accepted), and wait for the success message.
 *
 * Example #1: When I put the order on hold
 * Example #2: When I release the order from hold
 * Example #3: When I cancel the order
 * Example #4: And we put the order on hold
 * Example #5: When we cancel the order
 *
 */
When(/^(I |we )*(put the order on hold|release the order from hold|cancel the order)$/, async function (pronounCase, phrase) {
  await orderOperation(this, phrase === 'put the order on hold' ? 'hold' : phrase === 'cancel the order' ? 'cancel' : 'unhold');
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * Open the edit page of a customer by email: the customers grid is searched
 * and the row is opened.
 *
 * Example #1: When I open the customer "customer@example.com" in the admin panel
 * Example #2: When I open the customer "shopper@example.com" in the admin panel
 * Example #3: And I open the customer "customer@example.com" in the admin panel
 * Example #4: When we open the customer "roni_cost@example.com" in the admin panel
 * Example #5: When open the customer "customer@example.com" in the admin panel
 *
 */
When(/^(I |we )*open the customer "([^"]*)" in the admin panel$/, async function (pronounCase, email) {
  await openAdmin(this, adminRoute('customers'), 'customers');
  await clearGrid(this);
  await searchGrid(this, email);
  const g = await grid(this);
  if (!(await gridRows(g, email).count())) {
    throw friendly({ message: `The customers grid has no customer "${email}". The search shows ${await gridSeen(g)}.`, hint: 'The customers of the suite are created by the site build script.' });
  }
  await openGridRow(this, email);
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Open a section of Stores > Configuration by its code ("general", "web",
 * "catalog", "customer", "sales", "checkout", "contact").
 *
 * Example #1: When I go to the "general" configuration section
 * Example #2: When I go to the "contact" configuration section
 * Example #3: And I go to the "catalog" configuration section
 * Example #4: When we go to the "checkout" configuration section
 * Example #5: Given I am on the "general" configuration section
 *
 */
Given(/^(?:(?:I am |we are )+on|(?:I |we )*go to) the "([a-z_]+)" configuration section$/, async function (section) {
  await openAdmin(this, 'admin/system_config/edit/section/' + section, `the "${section}" configuration section`);
  if (!(await this.page.locator('#config-edit-form, .access-denied-page').count())) {
    throw friendly({ message: `"${section}" is not a configuration section.`, hint: 'Use the code of the section, the last part of its address: general, web, catalog, customer, sales, checkout, contact, …' });
  }
});

/**
 * The group of the open configuration section with a title.
 *
 * @param {object} world
 * @param {string} title
 * @returns {Promise<import('playwright').Locator>}
 */
async function configGroup(world, title) {
  const page = world.page;
  const group = page.locator('#config-edit-form .section-config').filter({ has: page.locator(':scope > .entry-edit-head > a', { hasText: exactly(title) }) }).first();
  if (!(await group.count())) {
    const all = await page.locator('#config-edit-form .section-config > .entry-edit-head > a').allInnerTexts().catch(() => []);
    throw friendly({ message: `This configuration section has no "${title}" group. Its groups: ${all.map(clean).join(', ') || '(none; is a configuration section open?)'}.`, hint: 'Open the section first: `When I go to the "general" configuration section`.' });
  }
  const head = group.locator(':scope > .entry-edit-head > a');
  if (!/(^|\s)open(\s|$)/.test((await head.getAttribute('class')) || '')) {
    await head.click();
    await group.locator('tr').first().waitFor({ state: 'visible', timeout: budget(world) });
  }
  return group;
}

/**
 * The control of a configuration field, by group title and field label.
 *
 * @param {object} world
 * @param {string} groupTitle
 * @param {string} label
 * @returns {Promise<import('playwright').Locator>}
 */
async function configControl(world, groupTitle, label) {
  const group = await configGroup(world, groupTitle);
  const row = group.locator('tr').filter({ has: world.page.locator(':scope > td.label', { hasText: exactly(label) }) }).first();
  if (!(await row.count())) {
    const all = await group.locator('tr > td.label').allInnerTexts().catch(() => []);
    throw friendly({ message: `The "${groupTitle}" group has no "${label}" field. Its fields: ${all.map(clean).filter(Boolean).join(', ')}.`, hint: 'Use the label as the configuration page shows it.' });
  }
  return row.locator('td.value').locator('input:not([type="hidden"]), select, textarea').first();
}

/**
 * Set a field of the open configuration section, in a group, by its label: a
 * text, or the option text of a select. The group is expanded when it is
 * closed. Follow it with `I save the form`.
 *
 * Example #1: When I set the "Store Name" configuration field of "Store Information" to "Test Store"
 * Example #2: When I set the "Store Phone Number" configuration field of "Store Information" to "555-0100"
 * Example #3: And I set the "Store Name" configuration field of "Store Information" to ""
 * Example #4: When we set the "Enable Contact Us" configuration field of "Contact Us" to "Yes"
 * Example #5: When I set the "Store Hours of Operation" configuration field of "Store Information" to "9 to 5"
 *
 */
When(/^(I |we )*set the "([^"]*)" configuration field of "([^"]*)" to "([^"]*)"$/, async function (pronounCase, label, groupTitle, value) {
  const control = await configControl(this, groupTitle, label);
  if (await control.isDisabled()) {
    throw friendly({ message: `The "${label}" configuration field is disabled.`, hint: 'It inherits its value ("Use system value" is ticked) or is locked in the environment configuration.' });
  }
  if ((await control.evaluate((el) => el.tagName)) === 'SELECT') await control.selectOption({ label: value });
  else await control.fill(value);
});

/**
 * Assert the value of a field of the open configuration section.
 *
 * Example #1: Then the "Store Name" configuration field of "Store Information" should be "Test Store"
 * Example #2: Then the "Store Name" configuration field of "Store Information" should be ""
 * Example #3: And the "Store Phone Number" configuration field of "Store Information" should be "555-0100"
 * Example #4: Then the "Enable Contact Us" configuration field of "Contact Us" should be "Yes"
 * Example #5: Then the "Store Name" configuration field of "Store Information" should not be "Test Store"
 *
 */
Then(/^the "([^"]*)" configuration field of "([^"]*)" should( not)* be "([^"]*)"$/, async function (label, groupTitle, notCase, value) {
  const control = await configControl(this, groupTitle, label);
  await assertValue(this, () => control.evaluate((el) => (el.tagName === 'SELECT' ? [...el.selectedOptions].map((option) => option.textContent.replace(/\s+/g, ' ').trim()).join(', ') : el.value)), value, {
    label: `the "${label}" configuration field`,
    notCase,
    hint: 'A select reads the text of its selected option.',
  });
});

// ---------------------------------------------------------------------------
// Cache and index
// ---------------------------------------------------------------------------

/**
 * Read the rows of a status grid as [name, status].
 *
 * @param {object} world
 * @param {string} page
 * @param {string} nameColumn
 * @returns {Promise<Array<{name: string, status: string}>>}
 */
async function statusRows(world, page, nameColumn) {
  await openAdmin(world, adminRoute(page), page);
  const g = await grid(world);
  const columns = (await g.table.locator('thead tr').first().locator('th').allInnerTexts()).map(clean);
  const nameIndex = columns.indexOf(nameColumn);
  const statusIndex = columns.indexOf('Status');
  return g.rows.evaluateAll((rows, [n, s]) => rows.map((row) => ({
    name: (row.children[n].innerText || '').replace(/\s+/g, ' ').trim(),
    status: (row.children[s].innerText || '').replace(/\s+/g, ' ').trim(),
  })), [nameIndex, statusIndex]);
}

/**
 * Assert, on Cache Management, that no cache type is invalidated, or that some
 * are (after a configuration change, before the cache is flushed).
 *
 * Example #1: Then no cache type should be invalidated
 * Example #2: Then some cache types should be invalidated
 * Example #3: And no cache type should be invalidated
 * Example #4: And some cache types should be invalidated
 * Example #5: Then no cache types should be invalidated
 *
 */
Then(/^(no|some) cache types? should be invalidated$/, async function (quantity) {
  const rows = await statusRows(this, 'cache management', 'Cache Type');
  const invalid = rows.filter((row) => /INVALIDATED/i.test(row.status)).map((row) => row.name);
  if (quantity === 'no' && invalid.length) {
    throw friendly({ message: `Expected no invalidated cache type, but these are: ${invalid.join(', ')}.`, hint: 'Flush the cache: `When I flush the cache`.' });
  }
  if (quantity === 'some' && !invalid.length) {
    throw friendly({ message: 'Expected some invalidated cache types, but every cache type is valid.', hint: 'A saved configuration change invalidates "Configuration" and "Page Cache".' });
  }
});

/**
 * Flush the cache on Cache Management ("Flush Magento Cache") and wait for the
 * success message. It is how a suite deals with invalidated cache types.
 *
 * Example #1: When I flush the cache
 * Example #2: And I flush the cache
 * Example #3: When we flush the cache
 * Example #4: When flush the cache
 * Example #5: And we flush the cache
 *
 */
When(/^(I |we )*flush the cache$/, async function (pronounCase) {
  await openAdmin(this, adminRoute('cache management'), 'cache management');
  await actAndSettle(this, () => this.page.locator('#flush_magento').click({ noWaitAfter: true }));
  await assertPresence(messages(this, 'success', 'cache storage has been flushed'), null, {
    label: 'the message that the cache was flushed',
    hint: 'The button is "Flush Magento Cache" (`#flush_magento`).',
    timeout: budget(this),
    found: () => messagesSeen(this),
  });
});

/**
 * Assert, on Index Management, that every index is ready ("READY"), none asks
 * for a reindex.
 *
 * Example #1: Then every index should be ready
 * Example #2: And every index should be ready
 * Example #3: Then every search index should be ready
 * Example #4: And every search index should be ready
 * Example #5: Then every index should be ready now
 *
 */
Then(/^every (?:search )?index should be ready(?: now)?$/, async function () {
  const rows = await statusRows(this, 'index management', 'Indexer');
  const invalid = rows.filter((row) => !/^READY$/i.test(row.status)).map((row) => `${row.name} (${row.status})`);
  if (invalid.length || !rows.length) {
    throw friendly({
      message: rows.length ? `Expected every index to be ready, but these are not: ${invalid.join(', ')}.` : 'The Index Management grid is empty.',
      hint: 'The admin panel has no reindex button: use `When I rebuild the invalid indexes` (it runs the reindex command of cucumber.js). Deleting or moving a category invalidates "Category Products" and "Catalog Search".',
    });
  }
});

/**
 * Rebuild the invalid indexes. The admin panel can only read the state of the
 * indexes and change their mode: it has no "reindex" button, and deleting or
 * moving a category leaves "Category Products" and "Catalog Search" on
 * "REINDEX REQUIRED" even with the indexers on "Update on Save". A suite deals
 * with it through the command line: the step runs `reindexCommand` of
 * cucumber.js (`worldParameters`) in `siteDir` and then expects every index to
 * be ready on Index Management.
 *
 * Example #1: When I rebuild the invalid indexes
 * Example #2: And I rebuild the invalid indexes
 * Example #3: When we rebuild the invalid indexes
 * Example #4: Given I rebuild the invalid indexes
 * Example #5: And we rebuild the invalid indexes
 *
 */
When(/^(I |we )*rebuild the invalid indexes$/, async function (pronounCase) {
  const command = (this.parameters && this.parameters.reindexCommand) || '';
  const cwd = path.resolve(process.cwd(), (this.parameters && this.parameters.siteDir) || '.');
  if (!command) {
    throw friendly({ message: 'No reindex command is configured.', hint: "Set worldParameters.reindexCommand in cucumber.js (for a DDEV site: 'ddev exec php bin/magento indexer:reindex') and worldParameters.siteDir (the project folder)." });
  }
  if (!fs.existsSync(cwd)) {
    throw friendly({ message: `The site folder "${cwd}" does not exist.`, hint: 'Set SITE_DIR, or worldParameters.siteDir in cucumber.js, to the folder the reindex command runs in.' });
  }
  const result = await new Promise((resolve) => {
    // stdin is closed: `ddev exec` waits for ever on an open pipe.
    const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 40000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, output }); });
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: -1, output: String(error) }); });
  });
  if (result.code !== 0) {
    throw friendly({ message: `The reindex command "${command}" failed (exit ${result.code}) in ${cwd}: ${clean(result.output).slice(-300)}`, hint: 'Run the command by hand in the site folder.' });
  }
  const rows = await statusRows(this, 'index management', 'Indexer');
  const invalid = rows.filter((row) => !/^READY$/i.test(row.status)).map((row) => `${row.name} (${row.status})`);
  if (invalid.length) {
    throw friendly({ message: `After the reindex these indexes are still not ready: ${invalid.join(', ')}.`, hint: 'Read the output of the reindex command.' });
  }
});

// ---------------------------------------------------------------------------
// Clean-up
// ---------------------------------------------------------------------------

// How each kind of record is found and deleted in the admin panel.
const RECORDS = {
  'product': { page: 'products', find: 'search', remove: 'mass', action: 'Delete' },
  'customer': { page: 'customers', find: 'search', remove: 'mass', action: 'Delete' },
  'page': { page: 'pages', find: 'search', remove: 'row' },
  'block': { page: 'blocks', find: 'search', remove: 'row' },
  'cart price rule': { page: 'cart price rules', find: 'Rule', remove: 'form' },
  'review': { page: 'reviews', find: 'Title', remove: 'mass', action: 'Delete' },
  'newsletter subscriber': { page: 'newsletter subscribers', find: 'Email', remove: 'mass', action: 'Delete' },
};

/**
 * Delete every record of a kind that matches a text, through the admin
 * panel, when there is one.
 *
 * @param {object} world
 * @param {string} kind
 * @param {string} text
 * @returns {Promise<number>} how many passes deleted something
 */
async function removeRecords(world, kind, text) {
  const record = RECORDS[kind];
  const page = world.page;
  let removed = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    await openAdmin(world, adminRoute(record.page), record.page);
    await clearGrid(world);
    if (record.find === 'search') await searchGrid(world, text);
    else await filterGrid(world, record.find, text);
    const g = await grid(world);
    const rows = gridRows(g, text);
    if (!(await rows.count())) break;
    if (record.remove === 'mass') {
      await selectGridRows(world, text);
      await runGridAction(world, record.action);
      await answerDialog(world, true);
    } else if (record.remove === 'row') {
      const row = rows.first();
      await row.locator('button.action-select').click();
      await row.locator('a[data-action="item-delete"]').click();
      await answerDialog(world, true);
    } else {
      await openGridRow(world, text);
      await actAndSettle(world, () => page.locator('.page-main-actions:visible').first().locator('#delete').click({ noWaitAfter: true }));
      await answerDialog(world, true);
    }
    await messages(world, 'success').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(async () => {
      throw friendly({ message: `Deleting the ${kind} "${text}" did not end with a success message. The page shows ${await messagesSeen(world)}.`, hint: 'A record in use cannot always be deleted: read the message.' });
    });
    removed += 1;
  }
  await openAdmin(world, adminRoute(record.page), record.page);
  await clearGrid(world);
  return removed;
}

/**
 * Make sure no record of a kind matches a text: a product (by SKU or name), a
 * customer (by email), a page or a block (by title), a cart price rule (by
 * name), a review (by its summary) or a newsletter subscriber (by email). What
 * is found is deleted through the admin panel. It is the clean-up of what a
 * scenario creates: use it before the scenario (a failed run may have left the
 * record behind) and at its end. Needs a logged-in admin user.
 *
 * Example #1: Given there is no product "TEST-SKU-1"
 * Example #2: Given there is no customer "new.customer@example.com"
 * Example #3: And there is no page "Test Page"
 * Example #4: Given there is no cart price rule "Test Rule"
 * Example #5: And there is no review "Test review summary"
 *
 */
Given(/^there is no (product|customer|page|block|cart price rule|review|newsletter subscriber) "([^"]*)"$/, async function (kind, text) {
  if (!clean(text)) {
    throw friendly({ message: `An empty text would match every ${kind}.`, hint: 'Name the record to delete.' });
  }
  await removeRecords(this, kind, text);
});

/**
 * Make sure no category has a name: when the tree holds it, it is selected and
 * deleted (with its sub-categories). The clean-up of a category a scenario
 * creates. Needs a logged-in admin user.
 *
 * Example #1: Given there is no category "Test Category"
 * Example #2: And there is no category "Test Category"
 * Example #3: Given there is no category "Round Trip"
 * Example #4: And there is no category "Old Stuff"
 * Example #5: Given there is no category "Temporary"
 *
 */
Given(/^there is no category "([^"]*)"$/, async function (name) {
  for (let pass = 0; pass < 5; pass += 1) {
    await openAdmin(this, adminRoute('categories'), 'categories');
    await openCategoryTree(this);
    const node = categoryNode(this, name).first();
    if (!(await node.count())) return;
    await actAndSettle(this, () => node.click({ noWaitAfter: true }));
    await actAndSettle(this, () => this.page.locator('.page-main-actions:visible').first().locator('#delete').click({ noWaitAfter: true }));
    await answerDialog(this, true);
    await assertPresence(messages(this, 'success', 'You deleted the category.'), null, {
      label: 'the message "You deleted the category."',
      hint: 'A root category in use by a store cannot be deleted.',
      timeout: budget(this),
      found: () => messagesSeen(this),
    });
  }
});

/**
 * Assert the open confirmation dialog is gone and the page is the admin page it
 * was opened from. Kept with the clean-up steps: a dismissed delete leaves the
 * record in place.
 *
 * Example #1: Then the confirmation should be closed
 * Example #2: And the confirmation should be closed
 * Example #3: Then the confirmation dialog should be closed
 * Example #4: And the confirmation dialog should be closed
 * Example #5: Then the confirmation should be closed now
 *
 */
Then(/^the confirmation(?: dialog)? should be closed(?: now)?$/, async function () {
  await requireAdminSession(this, 'the page');
  await assertPresence(dialog(this), 'not', {
    label: 'a confirmation dialog',
    hint: 'Press Cancel or OK in the dialog first.',
    timeout: budget(this),
  });
});
