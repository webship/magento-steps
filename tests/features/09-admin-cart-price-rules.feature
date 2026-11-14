@admin @storefront @promotions
Feature: A cart price rule with a coupon
  As a store administrator
  I want to give a discount for a coupon code
  So that customers with the code pay less

  Scenario: A rule needs a name
    Given I am logged in to the admin panel as "admin"
    And I am on the "new cart price rule" admin page
    When I save the form
    Then I should see the form error "This is a required field." for the "Rule Name" field

  @critical
  Scenario: A coupon is created, used in the cart, cancelled and removed
    Given I am logged in to the admin panel as "admin"
    And there is no cart price rule "Webship Test Rule"
    And I am on the "new cart price rule" admin page
    When I set the "Rule Name" form field to "Webship Test Rule"
    And I set the "Websites" form field to "Main Website"
    And I set the "Customer Groups" form field to "NOT LOGGED IN, General"
    And I set the "Coupon" form field to "Specific Coupon"
    And I set the "Coupon Code" form field to "WSTEST10"
    And I open the "Actions" form section
    And I set the "Apply" form field to "Percent of product price discount"
    And I set the "Discount Amount" form field to "10"
    And I save the form
    Then I should see the success message "You saved the rule."
    When I filter the grid by "Rule" with "Webship Test Rule"
    Then the "Coupon Code" column of the "Webship Test Rule" grid row should be "WSTEST10"
    And the "Status" column of the "Webship Test Rule" grid row should be "Active"
    # The store: the code takes ten percent off.
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the cart
    And I go to the cart
    Then the cart subtotal should be "$34.00"
    When I apply the coupon "WSTEST10"
    Then I should see the success message "You used coupon code "
    And the cart discount should be "-$3.40"
    And the cart order total should be "$30.60"
    When I cancel the coupon
    Then I should see the success message "You canceled the coupon code."
    And the cart order total should be "$34.00"
    When I apply the coupon "NOT-A-CODE"
    Then I should see the error message "is not valid."
    And the cart order total should be "$34.00"
    # The clean-up.
    Given there is no cart price rule "Webship Test Rule"
    When I go to the "cart price rules" admin page
    Then I should not see the "Webship Test Rule" grid row
