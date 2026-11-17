@storefront @search
Feature: Searching the store
  As a visitor
  I want to search for a product
  So that I do not have to browse

  @critical
  Scenario: A search lists the matching products
    Given I am on the homepage
    When I search the store for "yoga"
    Then I should see "Search results for: 'yoga'"
    And the breadcrumbs should be "Home > Search results for: 'yoga'"
    And I should see the product "Cronus Yoga Pant" in the product list
    But I should not see the product "Joust Duffle Bag" in the product list

  # A link followed with the webship-js step: the settled wait makes sure the
  # scripts of the new page are loaded before the next step.
  Scenario: A link of the footer leads to the advanced search
    Given I am on the homepage
    When I follow "Advanced Search"
    And I wait for the page to settle
    Then the breadcrumbs should be "Home > Catalog Advanced Search"
    And I should see "Search Settings"

  Scenario: A search by SKU finds the product
    Given I am on the homepage
    When I search the store for "24-MB01"
    Then I should see "Search results for: '24-MB01'"
    And I should see the product "Joust Duffle Bag" in the product list

  Scenario: A search without a match says so
    Given I am on the homepage
    When I search the store for "zzzqqqxxx"
    Then I should see the notice message "Your search returned no results."

  Scenario: The search box suggests the terms people searched for
    Given I am on the homepage
    When I search the store for "yoga"
    And I go to the homepage
    And I type "yog" in the store search
    Then I should see the search suggestion "yoga"
    But I should not see the search suggestion "zzzqqqxxx"

  Scenario: The results are filtered and sorted like a category
    Given I am on the homepage
    When I search the store for "yoga"
    And I sort the product list by "Price"
    And I set the product list direction to ascending
    Then the product list should be ordered by price ascending
