@admin @content
Feature: Pages and blocks in the admin panel
  As a store administrator
  I want to write the content pages of the store
  So that customers read about it

  Background:
    Given I am logged in to the admin panel as "admin"

  Scenario: The pages of the store are listed
    Given I am on the "pages" admin page
    Then I should see the "Home Page" grid row
    And the "URL Key" column of the "Home Page" grid row should be "home"
    And the "Status" column of the "Home Page" grid row should be "Enabled"
    And I should see the "404 Not Found" grid row

  Scenario: A page needs a title
    Given I am on the "new page" admin page
    When I save the form
    Then I should see the form error "This is a required field." for the "Page Title" field

  @critical
  Scenario: A page is created, read in the store, changed and deleted
    Given there is no page "Webship Test Page"
    And I am on the "new page" admin page
    When I set the "Page Title" form field to "Webship Test Page"
    And I open the "Content" form section
    And I set the "Content Heading" form field to "A heading from the test suite"
    And I open the "Search Engine Optimization" form section
    And I set the "URL Key" form field to "webship-test-page"
    And I save the form
    Then I should see the success message "You saved the page."
    And the admin page title should be "Webship Test Page"
    When I go to "/webship-test-page"
    Then I should see "A heading from the test suite"
    And the breadcrumbs should be "Home > Webship Test Page"
    # Disable it: the store answers with the "not found" page.
    When I go to the "pages" admin page
    And I search the grid for "Webship Test Page"
    And I open the "Webship Test Page" grid row
    Then the admin page title should be "Webship Test Page"
    When I turn the "Enable Page" form switch off
    And I save the form
    Then I should see the success message "You saved the page."
    When I go to "/webship-test-page"
    Then I should not see "A heading from the test suite"
    Given there is no page "Webship Test Page"
    When I go to the "pages" admin page
    And I search the grid for "Webship Test Page"
    Then the grid should show 0 records
    And I clear the grid filters

  Scenario: A block of the sample content is opened
    Given I am on the "blocks" admin page
    When I search the grid for "footer_links_block"
    Then I should see the "Footer Links Block" grid row
    When I open the "Footer Links Block" grid row
    Then the admin page title should be "Footer Links Block"
    And the "Block Title" form field should be "Footer Links Block"
    And the "Identifier" form field should be "footer_links_block"
    And the "Enable Block" form field should be "on"
    When I go to the "blocks" admin page
    Then I should see the "Footer Links Block" grid row
