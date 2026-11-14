@admin @catalog @categories
Feature: Categories in the admin panel
  As a store administrator
  I want to arrange the categories in a tree
  So that customers find the products by kind

  Background:
    Given I am logged in to the admin panel as "admin"

  Scenario: The tree holds the categories of the catalog
    Given I am on the "categories" admin page
    Then I should see the "Gear" category in the tree
    And I should see the "Bags" category in the tree
    And I should see the "Women" category in the tree
    But I should not see the "Webship Test Category" category in the tree

  Scenario: Selecting a category opens its form
    When I select the "Gear" category in the tree
    Then the "Category Name" form field should be "Gear"
    And the "Enable Category" form field should be "on"

  @critical
  Scenario: A subcategory is added and deleted
    Given there is no category "Webship Test Category"
    When I select the "Gear" category in the tree
    And I click the "Add Subcategory" page action
    Then the admin page title should be "New Category"
    When I set the "Category Name" form field to "Webship Test Category"
    And I save the form
    Then I should see the success message "You saved the category."
    And I should see the "Webship Test Category" category in the tree
    # The store menu shows it under Gear once the cache is fresh.
    When I select the "Webship Test Category" category in the tree
    And I click the "Delete" page action
    Then I should see the confirmation "Are you sure you want to delete this category?"
    When I confirm the action
    Then I should see the success message "You deleted the category."
    And I should not see the "Webship Test Category" category in the tree

  Scenario: A category needs a name
    When I select the "Gear" category in the tree
    And I click the "Add Subcategory" page action
    And I save the form
    Then I should see the form error "This is a required field." for the "Category Name" field
