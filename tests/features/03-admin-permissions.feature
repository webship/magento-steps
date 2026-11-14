@admin @permissions
Feature: What a restricted admin user can open
  As a store owner
  I want an admin user with the Sales role to see sales only
  So that the catalog and the settings stay with the administrators

  Scenario: The restricted user has the Sales menu only
    Given I am logged in to the admin panel as "sales"
    Then I should see the "Sales" admin menu
    And I should see the "Sales > Orders" admin menu
    And I should see the "Sales > Invoices" admin menu
    But I should not see the "Catalog" admin menu
    And I should not see the "Customers" admin menu
    And I should not see the "Stores" admin menu
    And I should not see the "System" admin menu

  @critical
  Scenario: The restricted user opens the orders
    Given I am logged in to the admin panel as "sales"
    When I go to the "orders" admin page
    Then the admin page title should be "Orders"
    And I should not see the access denied page

  Scenario Outline: The restricted user is refused outside sales
    Given I am logged in to the admin panel as "sales"
    When I go to the "<page>" admin page
    Then I should see the access denied page
    And I should see "Sorry, you need permissions to view this content."

    Examples:
      | page             |
      | dashboard        |
      | products         |
      | customers        |
      | cart price rules |
      | pages            |
      | cache management |
      | users            |

  Scenario: The restricted user is refused a configuration section
    Given I am logged in to the admin panel as "sales"
    When I go to the "general" configuration section
    Then I should see the access denied page

  Scenario: An administrator is not refused
    Given I am logged in to the admin panel as "admin"
    When I go to the "products" admin page
    Then I should not see the access denied page
    When I go to the "users" admin page
    Then I should not see the access denied page
    And the admin page title should be "Users"
