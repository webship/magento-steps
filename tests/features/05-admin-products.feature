@admin @catalog
Feature: Products in the admin panel
  As a store administrator
  I want to create, change and remove products
  So that the catalog shows what the store sells

  Background:
    Given I am logged in to the admin panel as "admin"

  Scenario: A product needs a name, a SKU and a price
    Given I am on the "new product" admin page
    When I save the form
    Then I should see the form error "This is a required field." for the "Product Name" field
    And I should see the form error "This is a required field." for the "SKU" field
    And I should see the form error "This is a required field." for the "Price" field
    And I should not see the form error "This is a required field." for the "Quantity" field
    And the admin page title should be "New Product"

  @critical
  Scenario: A simple product is created, shown in the store, changed and removed
    Given there is no product "WS-TEST-BAG"
    And I am on the "new product" admin page
    When I set the "Product Name" form field to "Webship Test Bag"
    And I set the "SKU" form field to "WS-TEST-BAG"
    And I set the "Price" form field to "12.50"
    And I set the "Quantity" form field to "7"
    And I choose "Bags" in the "Categories" form field
    And I set the "Visibility" form field to "Catalog, Search"
    And I open the "Images And Videos" form section
    And I add the image "pixel.png" to the product gallery
    Then the product gallery should have 1 image
    When I save the form
    Then I should see the success message "You saved the product."
    And the admin page title should be "Webship Test Bag"
    And the "SKU" form field should be "WS-TEST-BAG"
    And the "Enable Product" form field should be "on"
    And the "Visibility" form field should be "Catalog, Search"
    # The storefront shows it at once: the indexes update when a product is saved.
    When I go to "/webship-test-bag.html"
    Then I should see "Webship Test Bag"
    And the product price should be "$12.50"
    And the breadcrumbs should be "Home > Webship Test Bag"
    # Change the price and take it off the storefront.
    When I open the product "WS-TEST-BAG" in the admin panel
    And I set the "Price" form field to "15.00"
    And I turn the "Enable Product" form switch off
    And I save the form
    Then I should see the success message "You saved the product."
    And the "Enable Product" form field should be "off"
    When I go to the "products" admin page
    And I search the grid for "WS-TEST-BAG"
    Then the "Status" column of the "WS-TEST-BAG" grid row should be "Disabled"
    And the "Price" column of the "WS-TEST-BAG" grid row should be "$15.00"
    # The grid action puts it back.
    When I select the "WS-TEST-BAG" grid row
    And I run the "Change status > Enable" grid action
    Then I should see the success message "A total of 1 record(s) have been updated."
    When I search the grid for "WS-TEST-BAG"
    Then the "Status" column of the "WS-TEST-BAG" grid row should be "Enabled"
    # Remove it with the grid action.
    When I select the "WS-TEST-BAG" grid row
    And I run the "Delete" grid action
    Then I should see the confirmation "Delete items"
    When I confirm the action
    Then I should see the success message "A total of 1 record(s) have been deleted."
    And there is no product "WS-TEST-BAG"

  Scenario: A dismissed delete keeps the product
    Given I am on the "products" admin page
    When I search the grid for "24-MB01"
    And I select the "24-MB01" grid row
    And I run the "Delete" grid action
    Then I should see the confirmation "Delete items"
    When I dismiss the confirmation
    Then the confirmation should be closed
    And I should see the "Joust Duffle Bag" grid row
    And I clear the grid filters

  Scenario: A configurable product of the sample catalog is read
    When I open the product "WS12" in the admin panel
    Then the admin page title should be "Radiant Tee"
    And the "Product Name" form field should be "Radiant Tee"
    And the "SKU" form field should be "WS12"
    And the "Enable Product" form field should be "on"
    And the "Visibility" form field should be "Catalog, Search"
    And I should see "Current Variations"
    And I should see "Radiant Tee-XS-Blue"
