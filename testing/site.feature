Feature: The site answers and its accounts work
  As the owner of the site
  I want the front page, the login page and each default account to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-add-users.sh); a scenario logs in by a handle of
  # the users registry in cucumber.js, so no password is written here. The apps named below are
  # the ones the builder installs by default.

  @critical
  Scenario: The front page is served
    Given I am an anonymous user
    And I am on the homepage
    Then the response status code should be 200
    And I should be on a website page

  @critical
  Scenario: The login page is served with its form
    Given I am on the login page
    Then the response status code should be 200
    And I should see the login form

  Scenario: The administrator logs in and has every app
    Given I am a logged in user with the "admin" user
    Then I should be logged in as "administrator"
    And I should be in the web client
    And I should see the "Sales" app
    And I should see the "Invoicing" app
    And I should see the "Settings" app

  Scenario: A salesperson has Sales and CRM, not Invoicing
    Given I am a logged in user with the "salesperson" user
    Then I should be logged in as "salesperson"
    And I should see the "Sales" app
    And I should see the "CRM" app
    But I should not see the "Invoicing" app
    And I should not see the "Settings" app

  Scenario: An accountant has Invoicing, not Sales
    Given I am a logged in user with the "accountant" user
    Then I should be logged in as "accountant"
    And I should see the "Invoicing" app
    But I should not see the "Sales" app
    And I should not see the "Settings" app

  Scenario: An employee has no app of a role
    Given I am a logged in user with the "employee" user
    Then I should be logged in as "employee"
    And I should be in the web client
    But I should not see the "Sales" app
    And I should not see the "Invoicing" app
    And I should not see the "Settings" app

  Scenario: A portal user never reaches the web client
    Given I am a logged in user with the "portal" user
    When I go to "/web"
    Then I should be in the portal
    And I should not be in the web client

  Scenario: An anonymous visitor has no session
    Given I am not logged in
    And I am on the homepage
    Then I should not be logged in
