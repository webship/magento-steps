@storefront @customer
Feature: The customer account
  As a customer
  I want an account in the store
  So that I see my orders and keep my addresses

  @critical
  Scenario: A customer logs in and sees the account
    Given I am logged in as the customer "customer"
    Then I should be logged in to the store as "Casey Customer"
    And I should see "My Account"
    And I should see "customer@example.com"
    And I should see "100 Main Street"

  Scenario: A wrong password is refused
    When I log in to the store with the email "customer@example.com" and the password "wrong-password"
    Then I should see the error message "The account sign-in was incorrect or your account is disabled temporarily."
    And I should not be logged in to the store

  Scenario: Logging out ends the session
    Given I am logged in as the customer "customer"
    When I log out of the store
    Then I should not be logged in to the store
    And I should see "Sign In"

  Scenario: A visitor who opens the account is asked to sign in
    When I go to my "orders" account page
    Then I should see "Customer Login"
    And I should not be logged in to the store

  Scenario: The registration form validates
    Given I am on "/customer/account/create/"
    When I press the "Create an Account" store button
    Then I should see the field error "This is a required field." for "First Name"
    And I should see the field error "This is a required field." for "Email"
    And I should see the field error "This is a required field." for "Password"

  Scenario: A visitor registers and the account is removed again
    Given I am logged in to the admin panel as "admin"
    And there is no customer "mia.newcomer@example.com"
    And I am on "/customer/account/create/"
    When I fill in the "First Name" store field with "Mia"
    And I fill in the "Last Name" store field with "Newcomer"
    And I fill in the "Email" store field with "mia.newcomer@example.com"
    And I fill in the "Password" store field with "Newcomer123456789!"
    And I fill in the "Confirm Password" store field with "Newcomer123456789!"
    And I press the "Create an Account" store button
    Then I should see the success message "Thank you for registering with Main Website Store."
    And I should be logged in to the store as "Mia Newcomer"
    When I go to the "customers" admin page
    And I search the grid for "mia.newcomer@example.com"
    Then the "Name" column of the "mia.newcomer@example.com" grid row should be "Mia Newcomer"
    # A customer a scenario registers is content: the suite removes it.
    Given there is no customer "mia.newcomer@example.com"
    When I go to the "customers" admin page
    And I search the grid for "mia.newcomer@example.com"
    Then the grid should show 0 records
    And I clear the grid filters

  Scenario: The account pages are opened by name
    Given I am logged in as the customer "customer"
    When I go to my "orders" account page
    Then I should see "My Orders"
    When I go to my "address book" account page
    Then I should see "Default Billing Address"
    When I go to my "account information" account page
    Then I should see "Edit Account Information"
    When I go to my "newsletter subscriptions" account page
    Then I should see "General Subscription"

  Scenario: An address is added to the address book and deleted
    Given I am logged in as the customer "customer"
    And my address book has no address "9 Webship Road"
    When I add the address:
      | Phone Number    | 5125550199     |
      | Street Address  | 9 Webship Road |
      | Country         | United States  |
      | State/Province  | Texas          |
      | City            | Dallas         |
      | Zip/Postal Code | 75001          |
    Then I should see the success message "You saved the address."
    And my address book should contain "9 Webship Road"
    When I delete the address "9 Webship Road"
    Then I should see the success message "You deleted the address."
    And my address book should not contain "9 Webship Road"
    But my address book should contain "100 Main Street"

  Scenario: An address needs a street
    Given I am logged in as the customer "customer"
    When I add the address:
      | City | Dallas |
    Then I should see the field error "This is a required field." for "Street Address"
    And I should see the field error "This is a required field." for "Phone Number"
