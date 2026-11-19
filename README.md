<p align="center"><img src="https://raw.githubusercontent.com/webship/magento-steps/2.0.x/assets/logo.svg" alt="Magento logo" width="96"></p>

# magento-steps

Cucumber step definitions for testing Magento Open Source stores with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/magento-steps` covers the admin panel (log in by account handle,
the menu and the pages, the grids, the forms, products, categories, orders from
the invoice to the credit memo, customers, cart price rules, pages and blocks,
the configuration, the cache and index state, what a restricted role may open)
and the storefront of the default theme (the menu, categories with layered
navigation, sorting and paging, search and its suggestions, the product page
with its options, the mini cart, the cart, the checkout through to the order
number, the customer account, the wish list, the comparison list, reviews, the
newsletter, field errors).

Every step was written from a round of testing the real pages in a browser, and
the whole suite runs against a real store: CI builds Magento Open Source 2.4.9
with its sample data in [DDEV](https://ddev.com) on every push and pull request;
see [`.github/workflows/test.yml`](.github/workflows/test.yml). No step phrase
carries the name of the platform.

The pack is for **Magento Open Source**, the community edition. It needs no
account, no access key and no paid or external service.

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, curl, and Node.js 20 or later with npm. PHP, the database and the search engine run in DDEV's containers; the store needs about 2 GB of memory and 5 GB of disk (see [The test store](#the-test-store)).

**1. The store.** The pack's own build script (the one CI runs) installs Magento Open Source with its sample data in a DDEV project and creates the accounts of [Test users](#test-users). It takes a few minutes, more the first time it downloads the packages.

```bash
git clone https://github.com/webship/magento-steps.git
SITE_DIR="$PWD/magento-site" magento-steps/scripts/build-site.sh
```

The store answers at `https://magentosteps.ddev.site` and its admin panel at `https://magentosteps.ddev.site/admin`.

In the [Webship Workspace](https://github.com/webship/workspace), its Magento plugin builds the store instead: Magento Open Source 2.4 with the same sample data, from the public Mage-OS mirror (no access keys), in production mode, in a sites folder of the workspace (`test/` here; `dev/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require magento --with-needs
bash core/scripts/plugins.sh --activate magento --with-needs
bash core/scripts/plugins.sh --install magento
bash test/cmd-magento-project.sh mysite --install --add-users
```

That store answers at `https://mysite.ddev.site`, with the plugin's accounts: `administrator` and `sales` (a role limited to Sales) in the admin panel, the customers `customer@example.com` (Casey Customer) and `shopper@example.com` (Sam Shopper), each with the password `dD.123123ddd`; step 3 names them. The first feature passes there, and so do the features of [`tests/features/`](tests/features/).

**2. A test project.**

```bash
mkdir magento-tests && cd magento-tests
npm init -y
npm install --save-dev webship-js @webship-js/magento-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the address of the store, the admin path, and the accounts (the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/magento-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // The scenarios of 90-assertions-must-fail.feature state something false on purpose: a run leaves them out.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://magentosteps.ddev.site',
      adminPath: 'admin',
      // `When I rebuild the invalid indexes` runs this command in siteDir (the folder of the store).
      reindexCommand: 'ddev exec php bin/magento indexer:reindex',
      siteDir: '../magento-site',
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        admin: { username: 'admin', password: 'Admin123456789!' },
        sales: { username: 'sales', password: 'Sales123456789!' },
        customer: { email: 'customer@example.com', password: 'Customer123456789!', name: 'Casey Customer' },
        shopper: { email: 'shopper@example.com', password: 'Shopper123456789!', name: 'Sam Shopper' },
      },
    },
  },
};
```

On a store from the Webship Workspace (step 1), the accounts are the plugin's: `admin: { username: 'administrator', password: 'dD.123123ddd' }`, `sales: { username: 'sales', password: 'dD.123123ddd' }`, and the two customers with `password: 'dD.123123ddd'` (the same addresses and names); `siteDir` is the folder of the store (`test/mysite` in the workspace). Its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: An administrator logs in to the admin panel
    Given I am logged in to the admin panel as "admin"
    Then the admin page title should be "Dashboard"

  Scenario: A visitor searches the store
    Given I am on the homepage
    When I search the store for "yoga"
    Then I should see the product "Cronus Yoga Pant" in the product list
```

**5. Run it.**

```bash
npm test
```

(`LAUNCH_URL=https://mysite.ddev.site npm test` for a store at another address.)
A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
7 steps (7 passed)
0m17.010s (executing steps: 0m16.968s)
[webship-js] HTML report → …/magento-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/magento-steps/tests/features/`): together they use every step of the pack. The `tags` line of step 3 leaves out the scenarios of `90-assertions-must-fail.feature`, which state something false on purpose (this repository's `npm run test:must-fail` checks that each of them fails).

### What the suite tests

The features of this repository run every step of the pack against the sample-data store, in CI on every change (the admin lane, the storefront lane, and the assertions that must fail): logging in to and out of the admin panel as an administrator and as a restricted user, refused logins and what the restricted role may and may not open, the menu and the named pages, both kinds of grid (keyword search, filters, sorting, paging, page size, actions), products (validation; a simple product created, shown in the store, changed and removed; images; a configurable product read), the category tree (a subcategory added and removed), orders from the checkout through invoice, shipment, hold, credit memo and cancel, customers and their addresses and groups, cart price rules with a coupon used in the cart, pages and blocks, the configuration, the cache and the indexes, reviews and newsletter subscribers from the store to the admin panel; and in the store: the menu and categories, layered navigation, sorting, list and grid modes, paging, search with its suggestions, the product page with options and quantity, the mini cart and the cart (update, estimate, coupon, empty), the checkout as a guest and as a customer, the customer account (login, logout, registration, the account pages, the address book), the wish list, the comparison list and the contact form.

Every step of the pack runs in a feature, and every assertion with a `not` runs both ways but one: `I should not see the last placed order in the orders grid` cannot be true on a working store (the step clears the grid's filters and searches the order the scenario placed, which the store always lists).

Not tested: the paid edition and its features, payment gateways and carrier services, the Page Builder stage, multiple websites, stores, currencies and languages, other themes, the mobile menu, moving a category, bundle, grouped, virtual and downloadable products, creating an order in the admin panel, tax rules, and e-mail (it goes to DDEV's Mailpit and no step reads it). What a run leaves on the store: its four orders (the platform cannot delete an order; see [Accounts](#accounts)), the carts of its visitors and customers (the store keeps a cart until its own clean-up of old carts, a cron job that does not run on the test store), the search terms the visitors typed (they feed the search suggestions), and, after the first run, the other fields of the General configuration section, which the admin panel stores the first time the section is saved.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (`webship-js` 2.0.10 or later)
- A Magento Open Source 2.4 store to test, with the default storefront theme
  and the default admin theme, in English

## Install

```bash
npm install --save-dev @webship-js/magento-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/magento-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the store, give the admin path and name the accounts
   the suite logs in with (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-store.example',
     adminPath: 'admin',
     users: {
       admin: { username: 'admin', password: process.env.ADMIN_PASSWORD },
       customer: { email: 'customer@example.com', password: process.env.CUSTOMER_PASSWORD, name: 'Casey Customer' },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and adjust the products, categories and texts to your catalog.

4. Run the suite:

   ```bash
   npx cucumber-js
   ```

## What is included

| Path | Purpose |
| --- | --- |
| `tests/step-definitions/magento-admin.steps.js` | Admin panel: session, named pages, page title, menu, access denied, page buttons, grids, forms, tabs. |
| `tests/step-definitions/magento-admin-content.steps.js` | Admin content: products, the category tree, orders, customers, configuration, cache and index, clean-up. |
| `tests/step-definitions/magento-storefront.steps.js` | Storefront: customer session, menu, breadcrumbs, product list, search, product page, mini cart, cart, checkout, account, wish list, compare, reviews, newsletter, field errors. |
| `tests/step-definitions/magento.steps.js` | Both sides: messages, confirmation dialogs, the settled wait. |
| `tests/step-definitions/magento-helpers.js` | Shared plumbing. It registers no step. |
| `tests/features/*.feature` | Reference features for a store with the sample data. |
| `tests/features/90-assertions-must-fail.feature` | Scenarios that state something false: `npm run test:must-fail` passes only when every one of them fails with a helpful message. |
| `scripts/build-site.sh`, `scripts/site-accounts.php` | Build the test store with DDEV and create the test accounts. |
| `tests/check-examples.js` | Checks every `Example #n:` line and every feature step against the step patterns. |

## Steps

128 step definitions. The JSDoc block above each one holds five examples.

### Admin panel: session, pages, menu

```gherkin
Given I am logged in to the admin panel as "admin"
When I log in to the admin panel with the username "admin" and the password "wrong-password"
When I log out of the admin panel
Given I am not logged in to the admin panel
Then I should be logged in to the admin panel as "sales"
When I go to the "products" admin page
Then the admin page title should be "Products"
Then I should see the "Sales > Orders" admin menu
When I open the "Catalog > Products" admin menu item
Then I should see the access denied page
When I click the "Add New Page" page action
```

Named pages: dashboard, orders, invoices, shipments, credit memos, products, new
product, categories, customers, customer groups, cart price rules, new cart
price rule, catalog price rules, newsletter subscribers, reviews, pending
reviews, pages, new page, blocks, configuration, cache management, index
management, users, roles, product attributes, order statuses, my account; or a
route such as `sales/order`.

### Admin panel: grids

```gherkin
When I search the grid for "Joust Duffle Bag"
When I filter the grid by "Type" with "Configurable Product"
When I clear the grid filters
Then the grid should show 19 records
Then the grid should have 20 rows
Then I should see the "Joust Duffle Bag" grid row
Then the "Status" column of the "Joust Duffle Bag" grid row should be "Enabled"
When I sort the grid by "Name" ascending
Then the grid should be sorted by "Name" ascending
When I go to the next page of the grid
Then the grid should be on page 2
When I show 50 grid rows per page
When I select the "WS-TEST-BAG" grid row
When I run the "Change status > Disable" grid action
When I open the "Home Page" grid row
```

The steps work on both kinds of grid of the admin panel: the listing with a
keyword search and a Filters panel (products, orders, customers, pages) and the
older grid with a filter row (cart price rules, reviews, newsletter
subscribers, cache, index).

### Admin panel: forms

```gherkin
When I set the "Product Name" form field to "Test Bag"
When I set the "Visibility" form field to "Catalog, Search"
When I turn the "Enable Product" form switch off
Then the "SKU" form field should be "TEST-SKU-1"
When I choose "Bags" in the "Categories" form field
When I open the "Images And Videos" form section
When I open the "Account Information" admin tab
Then I should see the form error "This is a required field." for the "Product Name" field
When I save the form
```

### Admin panel: catalog, orders, customers, settings

```gherkin
When I open the product "24-MB01" in the admin panel
When I add the image "pixel.png" to the product gallery
Then the product gallery should have 1 image
When I select the "Gear" category in the tree
Then I should see the "Bags" category in the tree
When I open the last placed order in the admin panel
Then I should see the last placed order in the orders grid
Then the order status should be "Pending"
When I add the order comment "Checked by the test suite"
When I put the order on hold
When I invoice the order
When I ship the order
When I refund the order
When I cancel the order
When I open the customer "customer@example.com" in the admin panel
When I go to the "general" configuration section
When I set the "Store Name" configuration field of "Store Information" to "Test Store"
Then some cache types should be invalidated
When I flush the cache
Then no cache type should be invalidated
When I rebuild the invalid indexes
Then every index should be ready
Given there is no product "TEST-SKU-1"
Given there is no category "Test Category"
```

`there is no …` deletes what it finds, through the admin panel: a product, a
customer, a page, a block, a cart price rule, a review, a newsletter subscriber
or a category. It is how a scenario removes what it created.

### Storefront

```gherkin
Given I am logged in as the customer "customer"
When I log out of the store
Then I should be logged in to the store as "Casey Customer"
When I open the "Gear > Bags" store menu item
Then the breadcrumbs should be "Home > Gear > Bags"
Then the product list should have 14 products
When I filter the product list by "Activity" with "Yoga"
When I sort the product list by "Price"
When I set the product list direction to descending
Then the product list should be ordered by price descending
When I view the product list as a list
When I go to the next page of the product list
When I search the store for "yoga"
When I type "yog" in the store search
Then I should see the search suggestion "yoga"
When I choose the "Size" option "M"
When I set the product quantity to 2
When I add the product to the cart
When I open the "Reviews" product tab
Then the mini cart should show 2 items
When I go to the cart
When I change the cart quantity of "Joust Duffle Bag" to 3
Then the cart order total should be "$117.00"
When I apply the coupon "TEST10"
When I estimate shipping to "United States", "Texas", "78701"
When I choose the "Flat Rate" shipping method
When I go to the checkout
When I fill in the checkout email with "guest@example.com"
When I fill in the shipping address:
When I continue to the payment step
When I choose the "Check / Money order" payment method
When I place the order
Then I should see the order confirmation
Then my order history should list the last placed order as "Pending"
When I add the address:
Then my address book should contain "9 Test Road"
When I add the product to my wish list
When I add the product to the comparison list
When I review the product with 4 stars, the summary "Good bag" and the text "It holds everything."
When I subscribe "reader@example.com" to the newsletter
When I fill in the "Password" store field with "Secret123456789!"
When I press the "Create an Account" store button
Then I should see the field error "This is a required field." for "First Name"
```

Every store page also holds a hidden sign-in popup with an "Email" and a
"Password" of its own, and the header repeats the texts of several buttons: the
two `store field` and `store button` steps take the field and the button of
the form a person sees.

`I place the order` remembers the order number of the success page: "the last
placed order" is then found in the orders grid of the admin panel and in the
order history of the customer, in the same scenario.

### Both sides

```gherkin
Then I should see the success message "You saved the product."
Then I should not see an error message
Then I should see the confirmation "Are you sure you want to delete this category?"
When I confirm the action
When I dismiss the confirmation
When I wait for the page to settle
```

## Accounts

The accounts are configuration, not test data. They are named in
`worldParameters.users` of `cucumber.js` and created once on the site; a
feature never creates or deletes one of them.

| Handle | Kind | What it is |
| --- | --- | --- |
| `admin` | admin user (`username`) | An administrator with every resource. |
| `sales` | admin user (`username`) | An admin user with a role that allows Sales only. |
| `customer` | customer (`email`) | A customer with a default billing and shipping address. |
| `shopper` | customer (`email`) | A second customer with an address. |

A customer that a scenario registers is content: the scenario removes it
(`Given there is no customer "…"`). Orders cannot be deleted in the admin
panel: every run leaves four orders behind, the one taken through its life
closed, one cancelled, and the two of the checkout feature pending.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js`
lists them in `worldParameters.users` (the default values; `ADMIN_USER`,
`ADMIN_PASSWORD`, `SALES_USER`, `SALES_PASSWORD`, `CUSTOMER_EMAIL`,
`CUSTOMER_PASSWORD`, `SHOPPER_EMAIL` and `SHOPPER_PASSWORD` replace them).
[`scripts/build-site.sh`](scripts/build-site.sh) creates them on the local test
store, and CI does the same on the runner: the installer creates `admin`,
[`scripts/site-accounts.php`](scripts/site-accounts.php) the three others. They
are placeholder credentials of that throwaway store, not of any real one.

```json
{
  "admin": { "username": "admin", "password": "Admin123456789!" },
  "sales": { "username": "sales", "password": "Sales123456789!" },
  "customer": { "email": "customer@example.com", "password": "Customer123456789!", "name": "Casey Customer" },
  "shopper": { "email": "shopper@example.com", "password": "Shopper123456789!", "name": "Sam Shopper" }
}
```

## The test store

`scripts/build-site.sh` builds the store the suite runs against, without a
question asked, in one DDEV project (`magentosteps`,
`https://magentosteps.ddev.site`):

```bash
scripts/build-site.sh          # the site goes to ../magento-site, or to $SITE_DIR
npm test
```

- **Edition.** Magento Open Source 2.4.9 (`magento/project-community-edition`),
  PHP 8.4, MariaDB 11.4, OpenSearch 3 through the `ddev/ddev-opensearch` add-on
  (its dashboards service is left out), the sample data.
- **Where the packages come from.** The build uses the public Mage-OS mirror of
  the Magento Open Source packages, `https://mirror.mage-os.org/`. It serves
  the same releases as the vendor's repository without access keys, so the
  build needs no account anywhere. `MIRROR_URL` points it at another Composer
  repository.
- **Mode.** Production mode with the static content deployed: the pages answer
  fast and the same way every time, which a test suite needs. On this
  hardware compiling and deploying takes about 30 seconds.
- **Two-factor authentication is off.** The build installs without the modules
  `Magento_TwoFactorAuth` and `Magento_AdminAdobeImsTwoFactorAuth`, the
  supported way to log in to a local test site without a second factor. Never
  do this on a site that is on the internet.
- **Nothing calls out.** The admin notification feed, the usage-data question
  and the release notification are left out (`Magento_AdminNotification`,
  `Magento_AdminAnalytics`, `Magento_ReleaseNotification`), as are the CAPTCHAs.
  With the notification module off the admin panel has no system message bar:
  the suite reads the cache and index state on Cache Management and Index
  Management instead.
- **The bundled gateway extensions are off.** The edition ships payment gateway
  and data-export extensions (`PayPal_Braintree*`, `Magento_PaymentServices*`,
  `Magento_ServiceProxy`, `Magento_Services*`, `Magento_SaaSCommon`,
  `Magento_*DataExporter`). Not configured, they still made every storefront
  page load two scripts from the gateway's servers and the checkout an asset of
  the payment provider (seen in the browser round). The build leaves them out
  at install time (`setup:install --disable-modules`; disabling them later
  leaves their database triggers behind and orders fail): the storefront, the
  checkout and the admin pages the suite opens then request nothing outside
  the site. One admin page still does, Stores >
  Configuration > Sales > Payment Methods (a core module); the suite never
  opens it.
- **Deterministic sign-in.** The admin session lasts, the secret key in admin
  addresses is off (`admin/security/use_form_key`), one admin account may be
  used from two browsers (`admin/security/admin_account_sharing`), no account is
  locked after failed sign-ins.
- **Indexes.** The indexers run on "Update on Save": a product a scenario saves
  is in the store at once and no cron is needed. Cron is run once by the build
  and is not left running.
- **Methods.** Check / Money order, Flat Rate, Free Shipping and the table rate
  of the sample data: the offline methods the edition ships with. No payment
  gateway, no carrier API.
- **Mail** goes to DDEV's Mailpit.

Footprint, measured: about 1.9 GB of memory for the three containers (web 550
to 700 MB, database 260 to 310 MB, search 1 GB), 1.4 GB for the project folder,
3.5 GB of container images. The build takes about three minutes once the
packages are downloaded (four more for the first download) and under six
minutes on a GitHub runner; one run of the suite takes about 16 minutes locally
and 19 minutes on the runner.

## What the pages really do

Things the browser round showed, which the steps are built on:

- A page is "loaded" long before it works. `document.readyState` is `complete`
  about 60 ms in, while RequireJS still loads 20 to 130 modules and the init
  blocks are unprocessed; a "Sort By" change made then is swallowed. The steps
  wait for the settled signal instead: no requested RequireJS module pending,
  no `text/x-magento-init` block left, no request in flight, no loading mask,
  three readings in a row.
- The admin forms are KnockoutJS models that read an input on its `change`
  event. A value typed with Playwright's `fill()` shows in the field while the
  form still holds nothing, and Save answers "This is a required field.". The
  form steps fill, dispatch `change` and read the value back.
- Labels are not always the accessible name. Several admin selects carry
  `aria-label="notice-…"`; on the customer sign-in page the "Password" label
  points at the field of a hidden popup. The steps find a field by the label
  text of its wrapper.
- An admin grid keeps a hidden copy of its header first in the DOM, remembers
  its filters, sorting and page size for the admin user, and saves them two
  seconds after a change. A grid opened by name starts unfiltered; the steps
  that set what must not leak wait for the save.
- The checkout shows its fields under a loading mask for a second; the star
  labels of the review form lie on top of each other; the "Remove item" link of
  the wish list shows on hover only; the store redirects to the home page five
  seconds after a customer logs out.

## Checks

```bash
npm test                 # the whole suite (not the @must-fail scenarios)
npm run test:admin       # the admin panel lane
npm run test:storefront  # the storefront lane
npm run test:must-fail   # every false statement must fail with a helpful message
npm run test:examples    # the JSDoc examples and the feature steps against the patterns
npm run test:paths       # a feature or a scenario named on the command line runs alone
npm run test:dry         # undefined and ambiguous steps
```

`npx cucumber-js tests/features/21-storefront-search.feature` runs one feature
and `npx cucumber-js tests/features/21-storefront-search.feature:<line>` one
scenario (the line of its `Scenario:`); the paths of `cucumber.js` are left out
when the command line names any. `FEATURES=tests/features/a.feature,tests/features/b.feature npm test`
runs a subset too.

The suite leaves the site as it found it, apart from its orders and carts (see
[What the suite tests](#what-the-suite-tests)): run it twice in a row.

`BROWSER=firefox npm test` runs the suite in Firefox (`npx playwright install
firefox` once). Use it on a machine where other container projects start and
stop while the suite runs: Chromium aborts every request in flight with
`net::ERR_NETWORK_CHANGED` when a container network comes or goes, and Firefox
is started here with `network.notify.changed` off. `CUCUMBER_RETRY=1` runs a
failed scenario once more.

## What is not covered

- The paid edition and its features, B2B, marketplace extensions, payment gateways and
  carrier services: this pack is for the community edition and its offline
  methods.
- The Page Builder stage (drag and drop): a page is created with its title,
  heading and URL key; its body is not edited.
- The cookie restriction notice (off in a default installation), multiple
  websites, stores and currencies, other languages than English, other themes
  than the default ones, the mobile menu.
- The "Comments History" tab of an order: it stays empty in 2.4.9; the suite
  reads the notes on the Information tab.
- Moving a category in the tree, bundle, grouped, virtual and downloadable
  products, creating an order in the admin panel, tax rules.

## License

MIT

## Logo

The Magento logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Magento name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
