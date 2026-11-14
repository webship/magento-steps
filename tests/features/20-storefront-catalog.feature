@storefront @catalog
Feature: The catalog of the store
  As a visitor
  I want to browse the categories
  So that I find a product to buy

  @critical
  Scenario: The menu leads to a category
    Given I am on the homepage
    When I open the "Gear > Bags" store menu item
    Then I should see "Bags"
    And the breadcrumbs should be "Home > Gear > Bags"
    And the product list should have 14 products
    And I should see the product "Joust Duffle Bag" in the product list
    But I should not see the product "Radiant Tee" in the product list

  Scenario: A top-level menu entry opens its category
    Given I am on the homepage
    When I open the "Gear" store menu item
    Then the breadcrumbs should be "Home > Gear"

  Scenario: The layered navigation filters the list
    Given I am on "/gear/bags.html"
    When I filter the product list by "Activity" with "Yoga"
    Then the product list should be filtered by "Activity" with "Yoga"
    And the product list should have 6 products
    And the product list should not be filtered by "Activity" with "Gym"
    When I clear the product list filters
    Then the product list should not be filtered by "Activity" with "Yoga"
    And the product list should have 14 products

  Scenario: The list is sorted by price in both directions
    Given I am on "/gear/bags.html"
    When I sort the product list by "Price"
    Then the product list should be ordered by price ascending
    When I set the product list direction to descending
    Then the product list should be ordered by price descending
    When I sort the product list by "Product Name"
    And I set the product list direction to ascending
    Then the product list should be ordered by name ascending

  Scenario: The list is shown as a grid or as a list
    Given I am on "/gear/bags.html"
    Then the product list should be shown as a grid
    When I view the product list as a list
    Then the product list should be shown as a list
    When I view the product list as a grid
    Then the product list should be shown as a grid

  Scenario: The list is paged
    Given I am on "/gear/bags.html"
    Then the product list should be on page 1
    When I go to the next page of the product list
    Then the product list should be on page 2
    When I go to the previous page of the product list
    Then the product list should be on page 1
    When I go to page 2 of the product list
    Then the product list should be on page 2

  Scenario: A product is opened from the list
    Given I am on "/gear/bags.html"
    When I open the product "Joust Duffle Bag" from the product list
    Then the breadcrumbs should be "Home > Gear > Bags > Joust Duffle Bag"
    And the product price should be "$34.00"
