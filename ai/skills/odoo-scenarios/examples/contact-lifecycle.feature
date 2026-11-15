Feature: A contact is written and removed again
  As an administrator
  I want to create a contact, note something on it, find it and delete it
  So that the suite proves records, the chatter and the search work, and leaves the site as it found it

  Scenario: The administrator creates a contact, finds it in the list and deletes it
    Given I am a logged in user with the "admin" user
    When I open the "Contacts" app
    And I create a new record
    And I set the "name" field to "A contact written by a scenario"
    And I set the "Email" field to "scenario-contact@example.com"
    Then the form should have unsaved changes
    When I save the record
    Then the form should not have unsaved changes
    And the "Email" field should be "scenario-contact@example.com"
    And I should see the chatter
    When I log the note "Written and removed by the suite."
    Then I should see "Written and removed by the suite." in the chatter
    When I go back to "Contacts" in the breadcrumb
    And I search the records for "A contact written by a scenario"
    Then I should see the "A contact written by a scenario" record
    And I should see 1 record
    When I switch to the list view
    And I select the "A contact written by a scenario" record
    Then I should see 1 selected record
    When I choose "Delete" in the Actions menu
    Then I should see a dialog
    When I confirm the dialog
    Then I should see no records
