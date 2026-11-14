@admin @customers
Feature: Customers in the admin panel
  As a store administrator
  I want to view and change the customers
  So that their accounts stay correct

  Background:
    Given I am logged in to the admin panel as "admin"

  @critical
  Scenario: A customer is viewed
    When I open the customer "customer@example.com" in the admin panel
    Then the admin page title should be "Casey Customer"
    And I should see "Customer Group:"
    And I should see "General"
    And I should see "100 Main Street"

  Scenario: The account information of a customer is changed and set back
    When I open the customer "customer@example.com" in the admin panel
    And I open the "Account Information" admin tab
    Then the "First Name" form field should be "Casey"
    And the "Email" form field should be "customer@example.com"
    And the "Group" form field should be "General"
    When I set the "Middle Name/Initial" form field to "Q"
    And I click the "Save and Continue Edit" page action
    Then I should see the success message "You saved the customer."
    When I open the "Account Information" admin tab
    Then the "Middle Name/Initial" form field should be "Q"
    When I set the "Middle Name/Initial" form field to ""
    And I save the form
    Then I should see the success message "You saved the customer."
    And the admin page title should be "Customers"

  Scenario: The addresses of a customer are listed
    When I open the customer "customer@example.com" in the admin panel
    And I open the "Addresses" admin tab
    Then I should see "Default Billing Address"
    And I should see "Default Shipping Address"
    And I should see the "100 Main Street" grid row
    And the "City" column of the "100 Main Street" grid row should be "Austin"
    And the "State" column of the "100 Main Street" grid row should be "Texas"

  Scenario: A customer needs an email
    When I open the customer "shopper@example.com" in the admin panel
    And I open the "Account Information" admin tab
    And I set the "Email" form field to ""
    And I save the form
    Then I should see the form error "This is a required field." for the "Email" field

  Scenario: The customer groups are listed
    Given I am on the "customer groups" admin page
    Then I should see the "General" grid row
    And I should see the "Wholesale" grid row
    And I should see the "NOT LOGGED IN" grid row
    And the "Tax Class" column of the "Wholesale" grid row should be "Retail Customer"
