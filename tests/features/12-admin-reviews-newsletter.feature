@admin @storefront @reviews
Feature: Reviews and newsletter subscribers, from the store to the back office
  As a store administrator
  I want to moderate what customers send
  So that the store shows approved reviews only

  @critical
  Scenario: A customer review is approved in the admin panel and shows in the store
    Given I am logged in to the admin panel as "admin"
    And there is no review "Webship test review"
    And I am logged in as the customer "customer"
    And I am on "/push-it-messenger-bag.html"
    When I review the product with 4 stars, the summary "Webship test review" and the text "It holds everything I carry."
    Then I should see the success message "You submitted your review for moderation."
    # Pending: not in the store yet.
    When I go to "/push-it-messenger-bag.html"
    And I open the "Reviews" product tab
    Then I should not see "Webship test review"
    When I go to the "pending reviews" admin page
    And I filter the grid by "Title" with "Webship test review"
    Then I should see the "Webship test review" grid row
    And the "Nickname" column of the "Webship test review" grid row should be "Casey"
    When I open the "Webship test review" grid row
    Then the admin page title should be "Edit Review"
    When I set the "Status" form field to "Approved"
    And I save the form
    Then I should see the success message "You saved the review."
    When I go to the "reviews" admin page
    And I filter the grid by "Title" with "Webship test review"
    Then the "Status" column of the "Webship test review" grid row should be "Approved"
    When I flush the cache
    And I go to "/push-it-messenger-bag.html"
    And I open the "Reviews" product tab
    Then I should see "Webship test review"
    And I should see "It holds everything I carry."
    Given there is no review "Webship test review"
    When I flush the cache
    And I go to "/push-it-messenger-bag.html"
    And I open the "Reviews" product tab
    Then I should not see "Webship test review"

  Scenario: A review needs a rating
    Given I am on "/push-it-messenger-bag.html"
    When I review the product without a rating, the summary "No stars" and the text "Forgot the stars." as "Gail"
    Then I should see the field error "Please select one of each of the ratings above."
    And I should not see a success message

  Scenario: A newsletter subscription reaches the admin panel
    Given I am logged in to the admin panel as "admin"
    And there is no newsletter subscriber "reader@example.com"
    And I am on the homepage
    When I subscribe "reader@example.com" to the newsletter
    Then I should see the success message "Thank you for your subscription."
    When I go to the "newsletter subscribers" admin page
    And I filter the grid by "Email" with "reader@example.com"
    Then the "Status" column of the "reader@example.com" grid row should be "Subscribed"
    And the "Type" column of the "reader@example.com" grid row should be "Guest"
    Given there is no newsletter subscriber "reader@example.com"
    When I go to the "newsletter subscribers" admin page
    Then I should not see the "reader@example.com" grid row

  Scenario: The newsletter form refuses a wrong address
    Given I am on the homepage
    When I subscribe "not-an-email" to the newsletter
    Then I should see the field error "Please enter a valid email address (Ex: johndoe@domain.com)."
    And I should not see a success message
