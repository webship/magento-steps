@admin @grids
Feature: Admin grids
  As a store administrator
  I want to search, filter, sort and page the lists of the admin panel
  So that I find a record among thousands

  Background:
    Given I am logged in to the admin panel as "admin"

  @critical
  Scenario: A keyword search finds a product
    Given I am on the "products" admin page
    When I search the grid for "Joust Duffle Bag"
    Then the grid should show 1 record
    And I should see the "Joust Duffle Bag" grid row
    And the "SKU" column of the "Joust Duffle Bag" grid row should be "24-MB01"
    And the "Price" column of the "Joust Duffle Bag" grid row should be "$34.00"
    And the "Status" column of the "Joust Duffle Bag" grid row should be "Enabled"
    And the "Type" column of the "Joust Duffle Bag" grid row should not be "Configurable Product"
    When I clear the grid filters
    Then the grid should have 20 rows

  Scenario: The filters panel narrows the products
    Given I am on the "products" admin page
    When I filter the grid by "Name" with "Tank"
    And I filter the grid by "Type" with "Configurable Product"
    Then the grid should show 19 records
    And the grid should have 19 rows
    And I should see the "Tristan Endurance Tank" grid row
    But I should not see the "Joust Duffle Bag" grid row
    When I clear the grid filters
    Then the grid should have 20 rows

  Scenario: A grid opened by name forgets the filters of the last visit
    Given I am on the "products" admin page
    When I search the grid for "Joust Duffle Bag"
    Then the grid should show 1 record
    When I go to the "products" admin page
    Then the grid should have 20 rows

  Scenario: The products are sorted by a column
    Given I am on the "products" admin page
    When I filter the grid by "Name" with "Tank"
    And I filter the grid by "Type" with "Configurable Product"
    And I sort the grid by "Name" ascending
    Then the grid should be sorted by "Name" ascending
    When I sort the grid by "Name" descending
    Then the grid should be sorted by "Name" descending
    When I sort the grid by "ID" ascending
    Then the grid should be sorted by "ID" ascending
    And I clear the grid filters

  Scenario: The products are paged
    Given I am on the "products" admin page
    When I sort the grid by "ID" ascending
    Then the grid should be on page 1
    When I go to the next page of the grid
    Then the grid should be on page 2
    And the grid should have 20 rows
    When I go to page 5 of the grid
    Then the grid should be on page 5
    When I go to the previous page of the grid
    Then the grid should be on page 4
    When I go to page 1 of the grid
    Then the grid should be on page 1

  Scenario: The page size of a grid is changed and set back
    Given I am on the "products" admin page
    When I show 50 grid rows per page
    Then the grid should have 50 rows
    When I show 20 grid rows per page
    Then the grid should have 20 rows

  Scenario: A grid action without a selected row is refused
    Given I am on the "products" admin page
    When I run the "Delete" grid action
    Then I should see the confirmation "You haven't selected any items!"
    When I confirm the action
    Then the confirmation should be closed
    And the grid should have 20 rows

  Scenario: The customers grid shows the group of a customer
    Given I am on the "customers" admin page
    When I search the grid for "customer@example.com"
    Then the grid should show 1 record
    And the "Group" column of the "customer@example.com" grid row should be "General"
    And the "Name" column of the "customer@example.com" grid row should be "Casey Customer"
    And I clear the grid filters

  Scenario: An older grid is filtered by its column filters
    Given I am on the "cart price rules" admin page
    When I filter the grid by "Rule" with "20% OFF"
    Then the grid should have 1 row
    And I should see the "20% OFF Ever $200-plus purchase!*" grid row
    But I should not see the "Buy 3 tee shirts and get the 4th free" grid row
    When I clear the grid filters
    Then I should see the "Buy 3 tee shirts and get the 4th free" grid row
