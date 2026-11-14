@storefront @cart
Feature: The product page and the cart
  As a visitor
  I want to put products in my cart
  So that I can buy them together

  @critical
  Scenario: A simple product is added to the cart
    Given I am on "/joust-duffle-bag.html"
    Then the product price should be "$34.00"
    And the mini cart should show 0 items
    When I add the product to the cart
    Then I should see the success message "You added Joust Duffle Bag to your shopping cart."
    And the mini cart should show 1 item
    When I open the mini cart
    Then the mini cart should contain "Joust Duffle Bag"
    But the mini cart should not contain "Radiant Tee"

  Scenario: A configurable product needs its options
    Given I am on "/radiant-tee.html"
    When I add the product to the cart
    Then I should see the field error "This is a required field."
    And I should not see a success message
    And the mini cart should show 0 items

  Scenario: A configurable product is added with its options and a quantity
    Given I am on "/radiant-tee.html"
    When I choose the "Size" option "M"
    And I choose the "Color" option "Blue"
    Then the "Size" option should be "M"
    And the "Color" option should be "Blue"
    And the "Color" option should not be "Orange"
    When I set the product quantity to 2
    And I add the product to the cart
    Then I should see the success message "You added Radiant Tee to your shopping cart."
    And the mini cart should show 2 items
    When I go to the cart
    Then the cart should contain "Radiant Tee"
    And the cart quantity of "Radiant Tee" should be 2
    And I should see "Blue" in the "#shopping-cart-table" element

  Scenario: The cart is updated, estimated and emptied
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the cart
    Then the cart should contain "Joust Duffle Bag"
    And the cart subtotal should be "$34.00"
    When I change the cart quantity of "Joust Duffle Bag" to 3
    Then the cart quantity of "Joust Duffle Bag" should be 3
    And the cart subtotal should be "$102.00"
    When I estimate shipping to "United States", "Texas", "78701"
    And I choose the "Flat Rate" shipping method
    Then the cart shipping should be "$15.00"
    And the cart order total should be "$117.00"
    When I choose the "Free Shipping" shipping method
    Then the cart shipping should be "$0.00"
    And the cart order total should be "$102.00"
    When I remove "Joust Duffle Bag" from the cart
    Then the cart should not contain "Joust Duffle Bag"
    And I should see "You have no items in your shopping cart."

  Scenario: A wrong coupon code is refused
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the cart
    And I apply the coupon "NOT-A-CODE"
    Then I should see the error message "is not valid."
    And the cart order total should be "$34.00"
