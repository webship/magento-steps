'use strict';

// Steps shared by the admin panel and the storefront: the messages, the
// confirmation dialogs and the "settled" wait.
//
// The admin panel has its own step files: magento-admin.steps.js (session,
// pages, menu, grids, forms) and magento-admin-content.steps.js (catalog,
// orders, customers, configuration, cache and index, clean-up). The storefront
// is in magento-storefront.steps.js.
//
// Steps that webship-js already covers with its generic click, fill and see
// vocabulary are not duplicated here; see README.md of this folder.
//
// Every assertion waits on its locator (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout
// stack.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  clean,
  literal,
  settle,
  assertPresence,
  messages,
  messagesSeen,
  dialog,
  answerDialog,
} = require('./magento-helpers');

const MESSAGE_HINT = 'A message shows after an action reloads the page or finishes its request. Check the type (success, error, warning, notice) and the exact text; the message area is `#messages` in the admin panel and `.page.messages` on the storefront.';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Assert a message of a given type with a given text is (or is not) on the
 * page. Works in the admin panel and on the storefront. The text may be a part
 * of the message.
 *
 * Example #1: Then I should see the success message "You saved the product."
 * Example #2: Then I should see the error message "is not valid."
 * Example #3: And I should not see the error message "This is a required field."
 * Example #4: Then we should see the success message "You added Joust Duffle Bag to your shopping cart."
 * Example #5: Then should see the notice message "Your search returned no results."
 *
 */
Then(/^(I |we )*should( not)* see the (success|error|warning|notice) message "([^"]*)"$/, async function (pronounCase, notCase, type, wanted) {
  await assertPresence(messages(this, type, wanted), notCase, {
    label: `the ${type} message "${wanted}"`,
    hint: MESSAGE_HINT,
    timeout: notCase ? 3000 : budget(this),
    found: () => messagesSeen(this),
  });
});

/**
 * Assert a message of a given type is (or is not) on the page, whatever its
 * text.
 *
 * Example #1: Then I should see a success message
 * Example #2: Then I should not see an error message
 * Example #3: And I should see an error message
 * Example #4: Then we should not see a warning message
 * Example #5: Then should see a notice message
 *
 */
Then(/^(I |we )*should( not)* see (?:a|an) (success|error|warning|notice) message$/, async function (pronounCase, notCase, type) {
  await assertPresence(messages(this, type), notCase, {
    label: `a ${type} message`,
    hint: MESSAGE_HINT,
    timeout: notCase ? 3000 : budget(this),
    found: () => messagesSeen(this),
  });
});

// ---------------------------------------------------------------------------
// Confirmation dialogs
// ---------------------------------------------------------------------------

/**
 * Assert the open confirmation dialog shows a text ("Are you sure you want to
 * delete this category?").
 *
 * Example #1: Then I should see the confirmation "Are you sure you want to delete this category?"
 * Example #2: Then I should see the confirmation "You haven't selected any items!"
 * Example #3: And I should see the confirmation "Are you sure you want to delete this address?"
 * Example #4: Then we should see the confirmation "Delete items"
 * Example #5: Then should see the confirmation "Are you sure you want to delete the selected customers?"
 *
 */
Then(/^(I |we )*should see the confirmation "([^"]*)"$/, async function (pronounCase, text) {
  await assertPresence(dialog(this).filter({ hasText: literal(text) }), null, {
    label: `a confirmation dialog with "${text}"`,
    hint: 'The dialog opens after an action that asks for a confirmation. Check its text.',
    timeout: budget(this),
    found: async () => {
      const box = dialog(this);
      return (await box.count()) ? `the dialog "${clean(await box.innerText())}"` : 'no dialog';
    },
  });
});

/**
 * Press OK in the open confirmation dialog and wait for the action to finish.
 *
 * Example #1: When I confirm the action
 * Example #2: And I confirm the action
 * Example #3: When we confirm the action
 * Example #4: When confirm the action
 * Example #5: And we confirm the action
 *
 */
When(/^(I |we )*confirm the action$/, async function (pronounCase) {
  await answerDialog(this, true);
});

/**
 * Press Cancel in the open confirmation dialog: the action does not run.
 *
 * Example #1: When I dismiss the confirmation
 * Example #2: And I dismiss the confirmation
 * Example #3: When we dismiss the confirmation
 * Example #4: When dismiss the confirmation
 * Example #5: And we dismiss the confirmation
 *
 */
When(/^(I |we )*dismiss the confirmation$/, async function (pronounCase) {
  await answerDialog(this, false);
  if (await dialog(this).count()) {
    throw friendly({ message: 'The confirmation dialog is still open after pressing Cancel.', hint: 'Another dialog may have opened on top of it.' });
  }
});

// ---------------------------------------------------------------------------
// The settled wait
// ---------------------------------------------------------------------------

/**
 * Wait until the page is settled: its scripts are loaded, its components are
 * initialised, no request is in flight and no loading mask shows. The steps of
 * this pack do it themselves; this step is for after a generic webship-js
 * click or press.
 *
 * Example #1: When I wait for the page to settle
 * Example #2: And I wait for the page to settle
 * Example #3: When we wait for the page to settle
 * Example #4: When wait for the page to settle
 * Example #5: And we wait for the page to settle
 *
 */
When(/^(I |we )*wait for the page to settle$/, async function (pronounCase) {
  // A click made by the step before may still be about to start its request.
  await this.page.waitForEvent('framenavigated', { timeout: 800 }).catch(() => null);
  await settle(this);
});
