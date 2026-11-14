@must-fail
Feature: Assertions that must fail
  Every scenario here states something false about the site. A step pack whose
  assertions cannot fail proves nothing: `npm run test:must-fail` runs these
  scenarios and passes only when each of them fails at its last step.

  Scenario: A message that is not on the page
    Given I am logged in to the admin panel as "admin"
    Then I should see the success message "You saved the unicorn."

  Scenario: Nobody is logged in to the admin panel
    Given I am not logged in to the admin panel
    Then I should be logged in to the admin panel

  Scenario: The wrong admin user
    Given I am logged in to the admin panel as "sales"
    Then I should be logged in to the admin panel as "admin"

  Scenario: The wrong admin page title
    Given I am logged in to the admin panel as "admin"
    When I go to the "products" admin page
    Then the admin page title should be "Orders"

  Scenario: An administrator sees no access denied page
    Given I am logged in to the admin panel as "admin"
    When I go to the "products" admin page
    Then I should see the access denied page

  Scenario: A menu the role does not have
    Given I am logged in to the admin panel as "sales"
    Then I should see the "Catalog" admin menu

  Scenario: The wrong number of records
    Given I am logged in to the admin panel as "admin"
    And I am on the "products" admin page
    When I search the grid for "Joust Duffle Bag"
    Then the grid should show 7 records

  Scenario: A grid row that is not there
    Given I am logged in to the admin panel as "admin"
    And I am on the "products" admin page
    When I search the grid for "Joust Duffle Bag"
    Then I should see the "Radiant Tee" grid row

  Scenario: The wrong value in a grid column
    Given I am logged in to the admin panel as "admin"
    And I am on the "products" admin page
    When I search the grid for "Joust Duffle Bag"
    Then the "Price" column of the "Joust Duffle Bag" grid row should be "$1.00"

  Scenario: A grid that is not sorted that way
    Given I am logged in to the admin panel as "admin"
    And I am on the "products" admin page
    When I sort the grid by "ID" ascending
    Then the grid should be sorted by "ID" descending

  Scenario: The wrong value in a form field
    Given I am logged in to the admin panel as "admin"
    When I open the product "24-MB01" in the admin panel
    Then the "SKU" form field should be "NOT-THE-SKU"

  Scenario: A form error that is not shown
    Given I am logged in to the admin panel as "admin"
    When I open the product "24-MB01" in the admin panel
    Then I should see the form error "This is a required field." for the "SKU" field

  Scenario: A category that is not in the tree
    Given I am logged in to the admin panel as "admin"
    And I am on the "categories" admin page
    Then I should see the "No Such Category" category in the tree

  Scenario: Valid caches are not invalidated
    Given I am logged in to the admin panel as "admin"
    When I flush the cache
    Then some cache types should be invalidated

  Scenario: The wrong configuration value
    Given I am logged in to the admin panel as "admin"
    And I am on the "general" configuration section
    Then the "Store Name" configuration field of "Store Information" should be "Not The Name"

  Scenario: No customer is logged in to the store
    Given I am on the homepage
    Then I should be logged in to the store

  Scenario: The wrong customer name
    Given I am logged in as the customer "customer"
    Then I should be logged in to the store as "Sam Shopper"

  Scenario: The wrong breadcrumbs
    Given I am on "/gear/bags.html"
    Then the breadcrumbs should be "Home > Bags"

  Scenario: The wrong number of products
    Given I am on "/gear/bags.html"
    Then the product list should have 99 products

  Scenario: A product that is not in the list
    Given I am on "/gear/bags.html"
    Then I should see the product "Radiant Tee" in the product list

  Scenario: A list that is not ordered that way
    Given I am on "/gear/bags.html"
    When I sort the product list by "Price"
    Then the product list should be ordered by price descending

  Scenario: A filter that is not in use
    Given I am on "/gear/bags.html"
    Then the product list should be filtered by "Activity" with "Yoga"

  Scenario: A suggestion that is not offered
    Given I am on the homepage
    When I type "yog" in the store search
    Then I should see the search suggestion "zzzqqqxxx"

  Scenario: The wrong product price
    Given I am on "/joust-duffle-bag.html"
    Then the product price should be "$1.00"

  Scenario: An option that is not selected
    Given I am on "/radiant-tee.html"
    When I choose the "Size" option "M"
    Then the "Size" option should be "XL"

  Scenario: An empty mini cart does not show an item
    Given I am on "/joust-duffle-bag.html"
    Then the mini cart should show 1 item

  Scenario: A product that is not in the cart
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the cart
    Then the cart should contain "Radiant Tee"

  Scenario: The wrong cart total
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the cart
    Then the cart order total should be "$1.00"

  Scenario: The checkout is not on the payment step
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the checkout
    Then the checkout should be on the payment step

  Scenario: No order was confirmed
    Given I am on the homepage
    Then I should see the order confirmation

  Scenario: A field error that is not shown
    Given I am on "/contact/"
    Then I should see the field error "This is a required field." for "Name"

  Scenario: An address that is not in the address book
    Given I am logged in as the customer "customer"
    Then my address book should contain "1 Nowhere Lane"

  Scenario: A product that is not in the wish list
    Given I am logged in as the customer "customer"
    Then my wish list should contain "Radiant Tee"

  Scenario: A product that is not in the comparison list
    Given I am on the homepage
    Then the comparison list should contain "Radiant Tee"
