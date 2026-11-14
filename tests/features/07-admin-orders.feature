@admin @storefront @orders
Feature: Orders, from the checkout to the back office
  As a store administrator
  I want every order of the store in the admin panel
  So that I invoice, ship, refund or cancel it

  @critical
  Scenario: A guest order is found in the admin panel and taken through its life
    # The store: a guest buys a bag with the offline methods.
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    Then I should see the success message "You added Joust Duffle Bag to your shopping cart."
    When I go to the checkout
    And I fill in the checkout email with "gail.guest@example.com"
    And I fill in the shipping address:
      | First Name      | Gail          |
      | Last Name       | Guest         |
      | Street Address  | 1 Test Lane   |
      | Country         | United States |
      | State/Province  | Texas         |
      | City            | Austin        |
      | Zip/Postal Code | 78701         |
      | Phone Number    | 5125550111    |
    And I choose the "Flat Rate" shipping method
    And I continue to the payment step
    Then the checkout should be on the payment step
    When I choose the "Check / Money order" payment method
    And I place the order
    Then I should see the order confirmation
    And I should see "Thank you for your purchase!"
    And the mini cart should show 0 items
    # The back office: the order is there.
    Given I am logged in to the admin panel as "admin"
    Then I should see the last placed order in the orders grid
    When I open the last placed order in the admin panel
    Then the order status should be "Pending"
    And I should see "gail.guest@example.com"
    And I should see "Flat Rate - Fixed"
    And I should see "Check / Money order"
    # Comments and the status history.
    When I add the order comment "Checked by the test suite"
    Then I should see the order comment "Checked by the test suite"
    But I should not see the order comment "Never written"
    # Hold and release.
    When I put the order on hold
    Then the order status should be "On Hold"
    When I release the order from hold
    Then the order status should be "Pending"
    # Invoice, ship, refund.
    When I invoice the order
    Then the order status should be "Processing"
    When I open the "Invoices" admin tab
    Then the grid should have 1 row
    When I open the "Information" admin tab
    And I ship the order
    Then the order status should be "Complete"
    When I open the "Shipments" admin tab
    Then the grid should have 1 row
    When I open the "Information" admin tab
    And I refund the order
    Then the order status should be "Closed"
    When I open the "Credit Memos" admin tab
    Then the grid should have 1 row
    When I go to the "orders" admin page
    Then I should see the "Gail Guest" grid row

  Scenario: A customer order is cancelled in the admin panel and the customer sees it
    Given I am logged in as the customer "customer"
    And my cart is empty
    And I am on "/radiant-tee.html"
    When I choose the "Size" option "M"
    And I choose the "Color" option "Blue"
    And I add the product to the cart
    And I go to the checkout
    And I choose the "Free Shipping" shipping method
    And I continue to the payment step
    And I choose the "Check / Money order" payment method
    And I place the order
    Then I should see the order confirmation
    And my order history should list the last placed order as "Pending"
    Given I am logged in to the admin panel as "sales"
    When I open the last placed order in the admin panel
    Then the order status should be "Pending"
    And I should see "customer@example.com"
    When I cancel the order
    Then the order status should be "Canceled"
    And my order history should list the last placed order as "Canceled"

  Scenario: An order that does not exist is not found
    Given I am logged in to the admin panel as "admin"
    And I am on the "orders" admin page
    When I search the grid for "999999999"
    Then the grid should show 0 records
    And I should not see the "999999999" grid row
    And I clear the grid filters
