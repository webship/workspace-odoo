Feature: Each account works in the apps of its role
  As the owner of the site
  I want every account to open the apps of its role, with their views and menus
  So that a change of groups or of an app is caught by the suite

  # The accounts are the default ones; a scenario logs in by a handle of the users registry.

  Scenario: A salesperson works in the pipeline
    Given I am a logged in user with the "salesperson" user
    When I open the "CRM" app
    Then I should be in the "CRM" app
    And I should see the kanban view
    And I should see the "New" column
    And I should see the "Won" column
    When I switch to the list view
    Then I should see the list view

  Scenario: A salesperson opens the quotations
    Given I am a logged in user with the "salesperson" user
    When I open the "Sales" app
    Then I should be in the "Sales" app
    And I should see "Quotations" in the breadcrumb
    And I should see the "Orders" menu

  Scenario: An employee has the web client and no app of a role
    Given I am a logged in user with the "employee" user
    Then I should be in the web client
    But I should not see the "Sales" app
    And I should not see the "Settings" app

  Scenario: The user menu ends the session
    Given I am a logged in user with the "accountant" user
    When I open the user menu
    Then I should see "Log out" in the user menu
    When I log out
    Then I should not be logged in
