# Step definitions

| File | Covers |
| --- | --- |
| `magento.steps.js` | Both sides: the messages (success, error, warning, notice), the confirmation dialogs, the settled wait. |
| `magento-admin.steps.js` | The admin panel: log in by account handle, log out, the session, named pages and the page title, the menu, the access denied page, page buttons, grids (keyword search, filters, sorting, paging, page size, row selection, actions, cell values), forms (fields by label, switches, the category chooser, sections, tabs, field errors, save). |
| `magento-admin-content.steps.js` | Admin content: a product by SKU and its gallery, the category tree, orders (open, status, comments, hold, invoice, ship, credit memo, cancel), a customer by email, the configuration, the cache and index state, the clean-up of records. |
| `magento-storefront.steps.js` | The storefront: the customer session, the top menu, breadcrumbs, the product list (amount, sorting, direction, list and grid, paging, layered navigation), search and suggestions, the product page (options, quantity, add to cart, price), the mini cart, the cart (quantity, remove, totals, coupon, shipping estimate), the checkout through to the order number, the account pages, the order history, the address book, the wish list, the comparison list, reviews, the newsletter, field errors. |
| `magento-helpers.js` | Shared plumbing: the wait budget, the settled signal, presence and value assertions, URLs, the users registry, messages, dialogs, named admin pages, both kinds of admin grid, admin form fields and sections. It registers no step. |

## Rules for a new step

- Open the screen in a real browser first and write the step from what is
  there: the roles and labels, the stable attributes, what the page does while
  it loads or saves. Several things here are not what they look like in the
  source (see "What the pages really do" in the main README).
- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- No platform name in a step phrase. The regular expression starts with the
  pronoun group `(I |we )*`, and an assertion takes `should( not)*`, so one
  definition reads both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Never a fixed sleep. Wait for the settled signal (`settle`, `actAndSettle`)
  and assert through `assertPresence` or `assertValue`, which poll; fail with
  `friendly({ message, hint })` so the failure names what was expected, what was
  found and where to look.
- A step that names a record opens its list itself, searched for the record, so
  it does not depend on the page the scenario was on.
- A step never creates or deletes an account of the users registry: accounts
  are configuration, named in `cucumber.js` and created by
  `scripts/build-site.sh`. What a scenario creates, it removes (`there is no
  product "…"`).
- Add a scenario to `90-assertions-must-fail.feature` for a new assertion, so
  `npm run test:must-fail` proves it can fail.
