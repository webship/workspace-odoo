Feature: The Odoo plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the Odoo builder, the
  AI Agents folder lists the Odoo agents, and the Plugins page lists the plugin with its steps.

  Scenario: The plugin is listed on the Plugins page
    Given I am on "/settings/plugins"
     Then I should see "Odoo"
      And I should see "@webship.co/workspace-odoo"

  Scenario: A sites folder offers the Odoo builder
    Given I am on "/dev"
     Then "option[value='cmd-odoo-project.sh']" should be attached

  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents"
     Then I should see "odoo-site-builder"
      And I should see "odoo-tester"
