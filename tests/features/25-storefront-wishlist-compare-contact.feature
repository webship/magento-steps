@storefront @lists
Feature: The wish list, the comparison list and the contact form
  As a customer
  I want to keep products for later, compare them and write to the store
  So that I decide what to buy

  Scenario: A product is added to the wish list and removed
    Given I am logged in as the customer "customer"
    And I remove "Push It Messenger Bag" from my wish list
    And I am on "/push-it-messenger-bag.html"
    When I add the product to my wish list
    Then I should see the success message "Push It Messenger Bag has been added to your Wish List."
    And my wish list should contain "Push It Messenger Bag"
    When I remove "Push It Messenger Bag" from my wish list
    Then I should see the success message "Push It Messenger Bag has been removed from your Wish List."
    And my wish list should not contain "Push It Messenger Bag"

  Scenario: A guest is asked to sign in before using the wish list
    Given I am on "/push-it-messenger-bag.html"
    When I add the product to my wish list
    Then I should see the error message "You must login or register to add items to your wishlist."
    And I should see "Customer Login"

  Scenario: Products are compared and the list is emptied
    Given I am on "/push-it-messenger-bag.html"
    When I add the product to the comparison list
    Then I should see the success message "You added product Push It Messenger Bag to the comparison list."
    Given I am on "/joust-duffle-bag.html"
    When I add the product to the comparison list
    Then the comparison list should contain "Push It Messenger Bag"
    And the comparison list should contain "Joust Duffle Bag"
    But the comparison list should not contain "Radiant Tee"
    When I empty the comparison list
    Then the comparison list should not contain "Joust Duffle Bag"
    And I should see "You have no items to compare."

  Scenario: The contact form validates
    Given I am on "/contact/"
    When I press the "Submit" store button
    Then I should see the field error "This is a required field." for "Name"
    And I should see the field error "This is a required field." for "Email"
    And I should not see a success message
    When I fill in the "Email" store field with "gail.guest@example.com"
    And I press the "Submit" store button
    Then I should see the field error "This is a required field." for "Name"
    But I should not see the field error "This is a required field." for "Email"

  Scenario: The contact form is sent
    Given I am on "/contact/"
    When I fill in the "Name" store field with "Gail Guest"
    And I fill in the "Email" store field with "gail.guest@example.com"
    And I fill in the "What’s on your mind?" store field with "A question from the test suite."
    And I press the "Submit" store button
    Then I should see the success message "Thanks for contacting us with your comments and questions."
