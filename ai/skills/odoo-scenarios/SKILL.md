---
name: odoo-scenarios
description: Write and run webship-js scenarios for an Odoo Community site of the Webship Workspace with the Odoo step pack (`@webship-js/odoo-steps`) — the phrases of the pack by area (sessions, apps and menus, views and search, records, dialogs and the chatter, the website with its blog, shop, events and jobs), the handles of the users registry, and the workspace command that runs them in the site's container. Use when asked to "write a scenario for this Odoo site", "test the salesperson account", "which step is there for a kanban column", "add a feature for creating a contact", or when a `.feature` file of an Odoo project is being written or fixed.
argument-hint: '<site> [what to cover]'
---

# odoo-scenarios

Scenarios for an Odoo Community site of a Webship Workspace (`~/workspace`, container-based, DDEV
by default), written from the steps of [`@webship-js/odoo-steps`](https://github.com/webship/odoo-steps)
and of [webship-js](https://github.com/webship/webship-js) itself, and run in the site's container
by the workspace's own command. It comes with the Odoo plugin (`@webship.co/workspace-odoo`), like
the builder (`cmd-odoo-project.sh`), the odoo-bin tool (`cmd-tools-odoo-cli.sh`) and the agents
`odoo-site-builder` and `odoo-tester`. The site is the Community edition, never the Enterprise
edition.

## Where everything is

| What | Where |
| --- | --- |
| The site | `~/workspace/<folder>/<site>`, at `https://<site>.ddev.site`, the login at `/web/login` (`<folder>` is a sites folder: `dev`, `test`, `sandboxes`, `demos`) |
| The suite's configuration | `<site>/cucumber.js`: the step definitions it loads and the users registry (`worldParameters.users`) |
| The features | `<site>/tests/features/*.feature` (`site.feature` is the first one the setup wrote) |
| The pack's steps | `<site>/node_modules/@webship-js/odoo-steps/tests/step-definitions/*.steps.js` |
| webship-js's steps | `<site>/node_modules/webship-js/tests/step-definitions/*.js` |
| The reports | `<site>/tests/reports/` |

## The order of work

1. **Make sure the testing stack is there.** From the sites folder:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site>
   ```
   It adds webship-js, the step pack, the users registry and `tests/features/site.feature`, and
   makes sure the default accounts are on the site. It is safe to run again: it adds what is
   missing and keeps what was changed.
2. **Know which apps the site has.** A scenario about an app that is not installed fails at its
   first step:
   ```bash
   bash cmd-tools-odoo-cli.sh <site>                           # the version, the apps, the accounts
   bash cmd-tools-odoo-cli.sh <site> --install-apps project    # only when an app is asked for
   ```
3. **Read the installed steps before writing a phrase.** They are the source of truth: the pack
   moves, and a phrase from memory is a guess.
   ```bash
   cd ~/workspace/<folder>/<site>
   grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/odoo-steps/tests/step-definitions/*.steps.js
   ```
   Every step carries a comment block with five examples above it; open the file when a phrase
   is not obvious.
4. **Look at the screen first** (the Playwright MCP browser, a tab of your own) when the scenario
   is about a screen you have not seen: the label of a field, the name of a column and the items
   of a menu are the site's own words, and a form does not always label its first field.
5. **Write the feature** in `<site>/tests/features/`, from phrases that exist (the lists below).
6. **Match every step without a browser**, then run the feature, then the suite:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site> --dry-run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --tags "@critical"
   bash cmd-tools-testing.sh <site> --run
   ```
   A dry run says `Undefined` for a phrase no definition matches: fix the phrase, do not write a
   step for it.

## Accounts: a handle, never a password

A scenario logs in by a handle of the users registry. The default accounts are on the site
already (`bash cmd-tools-odoo-cli.sh <site> --add-users` adds them again if they were removed):

| Handle | Account | What it may do |
| --- | --- | --- |
| `admin` | `administrator` | Every installed app, and the settings |
| `salesperson` | `salesperson` | Sales and CRM, own documents only; no Invoicing |
| `accountant` | `accountant` | Invoicing; no Sales, no CRM |
| `employee` | `employee` | An internal user with no app of a role |
| `portal` | `portal` | A portal user: the website and `/my`, never the web client |

```gherkin
Given I am a logged in user with the "salesperson" user
Then I should be logged in as "salesperson"
And I should be in the web client
```

## The phrases, by area

Each line is a phrase the pack defines, and each one passed on a site built with
`bash cmd-odoo-project.sh <site> --install --add-users` (the default apps with demo data; the
names in quotes are that site's). Most `should` steps also take the negative.

### Sessions

```gherkin
Given I am not logged in
Given I am on the login page
Given I am a logged in user with the "salesperson" user
When I log in as "salesperson" with password "not-the-password"
When I log out
Then I should see the login form
Then I should see a login error
Then I should be logged in as "salesperson"
Then I should not be logged in
Then I should be in the web client
Then I should be in the portal
When I open the user menu
Then I should see "Log out" in the user menu
```

### Apps, menus and views

```gherkin
Then I should see the "CRM" app
Then I should not see the "Invoicing" app
When I open the "CRM" app
Then I should be in the "CRM" app
Then I should see the "Orders" menu
Then I should see "Quotations" in the breadcrumb
When I go back to "Contacts" in the breadcrumb
Then I should see the kanban view
When I switch to the list view
Then I should see the list view
Then I should see the "New" column
```

### Records, search, dialogs and the chatter

```gherkin
When I create a new record
When I set the "Email" field to "suite-contact@example.com"
Then the form should have unsaved changes
When I save the record
Then the form should not have unsaved changes
Then the "Email" field should be "suite-contact@example.com"
Then I should see the chatter
When I log the note "Written by the suite."
Then I should see "Written by the suite." in the chatter
When I search the records for "A contact from the suite"
Then I should see the "A contact from the suite" record
Then I should see 1 record
When I select the "A contact from the suite" record
Then I should see 1 selected record
When I choose "Delete" in the Actions menu
Then I should see a dialog
When I confirm the dialog
Then I should see no records
```

### The website

```gherkin
Then I should be on a website page
Then I should see the menu
Then I should see the footer
Then I should be on the blog page
Then I should be on the shop page
When I search the shop for "desk"
Then I should see shop search results for "desk"
When I open the first product in the shop
Then I should be on a product page
When I add the product to the cart
Then I should see "1" item in the cart
Then I should be on the events page
Then I should be on the jobs page
Then I should see job openings
Given I am on the contact page
Then I should see the contact form
Then I should be on the 404 page
Then I should be able to edit the website
```

`I am an anonymous user`, `I am on the homepage`, `I go to "/shop"`, `I should see "<text>"` and
`the response status code should be 200` are webship-js's own steps; its status codes, classes,
landmarks and accessibility audits are used as they are and never redefined for this platform.

## Traps found on a real site

- **A field is named by what the form shows, and the first field of a contact shows no label.**
  `When I set the "Name" field to "…"` failed in Contacts: the form labels `Email`, `Phone`,
  `Tags` and the others, and the name is a placeholder. The technical name passed:
  `When I set the "name" field to "A contact from the suite"`. The failure message lists the
  labels the form has.
- **`I should be able to edit the website` is a step for an internal user.** For a visitor,
  `I should not be able to edit the website` does not pass as "no": it fails with `Expected the
  website preview of the web client`. Log in first, or leave it out of a visitor's scenario.
- **Deleting a record is done from the list.** Search for it, switch to the list view, select
  it, choose `Delete` in the Actions menu and confirm the dialog, as the example does.
- **A product in the cart is a quotation in Sales.** `When I add the product to the cart` passed
  for a visitor and left a quotation behind that a visitor cannot remove. The examples stop at
  the product page; a cart scenario belongs in a site that is rebuilt for the run.
- **The pages are the default apps'.** `/blog`, `/shop`, `/event`, `/jobs` and the pipeline
  columns `New` and `Won` come with the apps and the demo data the builder installs. A site built
  with `--apps` or `--without-demo` has its own.
- **The demo data has its own `portal` user.** The handle `portal` logs in as that account, with
  the groups and the password of the default list.

## Rules

- **No account is created in a suite.** No user is added by a scenario or a hook. A role the
  registry does not have is asked for, not made.
- **Never the workspace account.** The site's own administrator is not in the registry; `admin`
  is the `administrator` default account.
- **No password in a feature file**, except where a wrong password is the subject.
- **No platform name in a step phrase**: `I open the "CRM" app`, `I should be in the web client`,
  never a phrase that names the product. The same holds for a custom step.
- **No selector and no address when a step says it**: `the "Sales" app`, not the path of its
  action.
- **What a scenario creates, it removes** in the same scenario, under a name nobody else uses.
- **Community only.** No scenario needs an app of another edition, a trial or a vendor account,
  and nothing is sent to an outside service.
- **A custom step is the last resort**: look in the pack and in webship-js first, write it in
  `<site>/tests/step-definitions/` with a comment block and examples, and say it may belong in
  the pack.
- **Everything runs in the container**, through `cmd-tools-testing.sh`. Never `npx cucumber-js`
  or `npx playwright` on the host.
- **A failing scenario is a result.** No `@wip`, no longer timeout, no looser assertion to turn a
  run green: say what the site did.

## Examples that run

`examples/` holds three features that pass on a site built with
`bash cmd-odoo-project.sh <site> --install --add-users`. Copy one into the suite and run it:

```bash
cp ~/workspace/ai-skills/odoo-scenarios/examples/apps-and-views.feature ~/workspace/<folder>/<site>/tests/features/
cd ~/workspace/<folder>
bash cmd-tools-testing.sh <site> --run --path tests/features/apps-and-views.feature
```

| Feature | What it shows |
| --- | --- |
| `examples/apps-and-views.feature` | A salesperson in the pipeline and in the quotations, an employee with no app of a role, the user menu |
| `examples/contact-lifecycle.feature` | An administrator creating a contact, logging a note, finding it and deleting it: a record a scenario creates and removes |
| `examples/website.feature` | A visitor on the front page, the blog, the shop, the events, the jobs and the contact page, an address with no page, and a portal user kept out of the web client |
