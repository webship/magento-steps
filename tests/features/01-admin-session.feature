@admin @session
Feature: Admin panel session
  As a store administrator
  I want to log in to and out of the admin panel
  So that only the people with an account manage the store

  @critical
  Scenario: An administrator logs in and reaches the Dashboard
    Given I am logged in to the admin panel as "admin"
    Then I should be logged in to the admin panel as "admin"
    And the admin page title should be "Dashboard"
    And I should not see the access denied page

  Scenario: A wrong password is refused with a message
    When I log in to the admin panel with the username "admin" and the password "wrong-password"
    Then I should see the error message "The account sign-in was incorrect or your account is disabled temporarily."
    And I should not be logged in to the admin panel

  Scenario: Logging out ends the session
    Given I am logged in to the admin panel as "admin"
    When I log out of the admin panel
    Then I should see the success message "You have logged out."
    And I should not be logged in to the admin panel

  Scenario: A visitor who opens an admin page gets the sign-in form
    Given I am not logged in to the admin panel
    When I go to "/admin/catalog/product/"
    Then I should see "Welcome, please sign in"
    And I should not be logged in to the admin panel

  Scenario: Logging in as another user replaces the session
    Given I am logged in to the admin panel as "admin"
    When I log in to the admin panel as "sales"
    Then I should be logged in to the admin panel as "sales"
    And I should not be logged in to the admin panel as "admin"
