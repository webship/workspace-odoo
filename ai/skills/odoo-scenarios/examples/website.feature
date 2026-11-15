Feature: A visitor reads the website
  As the owner of the site
  I want the pages of the website apps to be served to a visitor
  So that an app or a theme that breaks the website is caught by the suite

  # For a site built with the default apps: the blog, the shop, the events and the jobs.

  Scenario: The front page has its menu and its footer
    Given I am an anonymous user
    And I am on the homepage
    Then I should be on a website page
    And I should see the menu
    And I should see the footer

  Scenario: Each website app has its page
    Given I am an anonymous user
    When I go to "/blog"
    Then I should be on the blog page
    When I go to "/event"
    Then I should be on the events page
    When I go to "/jobs"
    Then I should be on the jobs page
    And I should see job openings
    Given I am on the contact page
    Then I should see the contact form

  Scenario: The shop lists products and finds one
    Given I am an anonymous user
    When I go to "/shop"
    Then I should be on the shop page
    When I search the shop for "desk"
    Then I should see shop search results for "desk"
    When I open the first product in the shop
    Then I should be on a product page

  Scenario: An address with no page is not found, and a portal user stays out of the web client
    Given I am an anonymous user
    When I go to "/this-page-does-not-exist"
    Then I should be on the 404 page
    Given I am a logged in user with the "portal" user
    When I go to "/web"
    Then I should be in the portal
    And I should not be in the web client
