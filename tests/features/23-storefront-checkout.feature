@storefront @checkout
Feature: The checkout
  As a visitor or a customer
  I want to place an order with the offline methods
  So that the store ships my products

  Scenario: The shipping step asks for the address
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the checkout
    And I choose the "Flat Rate" shipping method
    And I continue to the payment step
    Then the checkout should be on the shipping step
    And I should see the field error "This is a required field." for "First Name"
    And I should see the field error "This is a required field." for "Last Name"
    And I should see the field error "This is a required field." for "City"
    And I should see the field error "This is a required field." for "Phone Number"

  @critical
  Scenario: A guest orders with free shipping and a money order
    Given I am on "/aim-analog-watch.html"
    When I add the product to the cart
    And I go to the checkout
    And I fill in the checkout email with "gary.guest@example.com"
    And I fill in the shipping address:
      | First Name      | Gary          |
      | Last Name       | Guest         |
      | Company         | Test Company  |
      | Street Address  | 22 Checkout Road |
      | Country         | United States |
      | State/Province  | California    |
      | City            | San Francisco |
      | Zip/Postal Code | 94105         |
      | Phone Number    | 4155550122    |
    And I choose the "Free Shipping" shipping method
    And I continue to the payment step
    Then the checkout should be on the payment step
    And I should see "22 Checkout Road"
    And I should see "Free Shipping - Free"
    When I choose the "Check / Money order" payment method
    And I place the order
    Then I should see the order confirmation
    And I should see "gary.guest@example.com"
    And the mini cart should show 0 items
    # A guest's order belongs to no account.
    Given I am logged in as the customer "customer"
    Then my order history should not list the last placed order

  Scenario: A customer orders with a saved address
    Given I am logged in as the customer "shopper"
    And my cart is empty
    And I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the checkout
    Then I should see "200 Market Street"
    When I choose the "Flat Rate" shipping method
    And I continue to the payment step
    And I choose the "Check / Money order" payment method
    And I place the order
    Then I should see the order confirmation
    And my order history should list the last placed order as "Pending"
    And my cart is empty

  Scenario: An empty cart has no checkout
    Given I am on the cart
    Then I should see "You have no items in your shopping cart."
    When I go to "/checkout/"
    Then I should see "Shopping Cart"
