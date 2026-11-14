@admin @configuration
Feature: Configuration, cache and index state
  As a store administrator
  I want to change a setting and keep the caches and indexes valid
  So that the store shows what I configured

  Background:
    Given I am logged in to the admin panel as "admin"

  @critical
  Scenario: A setting is changed, the cache is flushed, the setting is set back
    Given I am on the "general" configuration section
    When I set the "Store Name" configuration field of "Store Information" to "Webship Test Store"
    And I save the form
    Then I should see the success message "You saved the configuration."
    And the "Store Name" configuration field of "Store Information" should be "Webship Test Store"
    # A saved setting invalidates cache types: the suite reads the state and flushes.
    And some cache types should be invalidated
    When I flush the cache
    Then no cache type should be invalidated
    Given I am on the "general" configuration section
    When I set the "Store Name" configuration field of "Store Information" to ""
    And I save the form
    Then I should see the success message "You saved the configuration."
    And the "Store Name" configuration field of "Store Information" should be ""
    When I flush the cache
    Then no cache type should be invalidated

  Scenario: The cache types are listed with their state
    Given I am on the "cache management" admin page
    Then I should see the "Configuration" grid row
    And I should see the "Page Cache" grid row
    And the "Tags" column of the "Page Cache" grid row should be "FPC"

  Scenario: Invalid indexes are rebuilt and every index is ready
    # Deleting a category (the categories feature does) leaves two indexes on "REINDEX REQUIRED": the admin panel
    # has no reindex button, the suite rebuilds them through the command of cucumber.js.
    When I rebuild the invalid indexes
    Then every index should be ready
    And the "Status" column of the "Catalog Search" grid row should be "READY"
    And the "Mode" column of the "Catalog Search" grid row should be "UPDATE ON SAVE"

  Scenario: A select of the configuration is read
    Given I am on the "contact" configuration section
    Then the "Enable Contact Us" configuration field of "Contact Us" should be "Yes"
    And the "Enable Contact Us" configuration field of "Contact Us" should not be "No"
