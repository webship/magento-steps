@admin @navigation
Feature: Admin panel menu and pages
  As a store administrator
  I want to reach every part of the admin panel from its menu
  So that I find the page I need

  Background:
    Given I am logged in to the admin panel as "admin"

  @critical
  Scenario: The menu holds the parts of the admin panel
    Then I should see the "Sales" admin menu
    And I should see the "Catalog" admin menu
    And I should see the "Customers" admin menu
    And I should see the "Catalog > Products" admin menu
    And I should see the "Sales > Orders" admin menu
    And I should not see the "Catalog > Orders" admin menu
    And I should not see the "Warehouse" admin menu

  Scenario: A menu item opens its page
    When I open the "Catalog > Products" admin menu item
    Then the admin page title should be "Products"
    When I open the "Sales > Orders" admin menu item
    Then the admin page title should be "Orders"
    When I open the "Dashboard" admin menu item
    Then the admin page title should be "Dashboard"

  Scenario Outline: A page is opened by its name
    When I go to the "<page>" admin page
    Then the admin page title should be "<title>"
    And I should not see the access denied page

    Examples:
      | page                   | title                  |
      | products               | Products               |
      | categories             | Default Category (ID: 2) |
      | orders                 | Orders                 |
      | customers              | Customers              |
      | customer groups        | Customer Groups        |
      | cart price rules       | Cart Price Rules       |
      | pages                  | Pages                  |
      | blocks                 | Blocks                 |
      | reviews                | Reviews                |
      | newsletter subscribers | Newsletter Subscribers |
      | configuration          | Configuration          |
      | cache management       | Cache Management       |
      | index management       | Index Management       |

  Scenario: The buttons of a page open its forms
    Given I am on the "pages" admin page
    When I click the "Add New Page" page action
    Then the admin page title should be "New Page"
    When I click the "Back" page action
    Then the admin page title should be "Pages"
