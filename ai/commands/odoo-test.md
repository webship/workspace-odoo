---
description: Test a Odoo Community site of the Webship Workspace with webship-js and the Odoo step pack — set the testing stack up when it is missing, match every step, run the suite (or one feature, or one tag) in the site's container, and report what failed and why.
argument-hint: '<site> [tests/features/<name>.feature | @tag]'
---

# /odoo-test

Test the Odoo Community site named in: `$ARGUMENTS`

The first word is the site (its folder name in a sites folder of the workspace). What follows, if
anything, narrows the run: a path that starts with `tests/features/` is one feature (or one
folder of features), a word that starts with `@` is a tag expression. With nothing after the site,
the whole suite runs. With no site at all, stop and ask for one: list the candidates with
`ls -d ~/workspace/*/*/.ddev/config.odoo.yaml`.

The workspace is container-based (DDEV by default) and everything below runs in the site's
container through the workspace's own command. Never run `npx cucumber-js`, `npx playwright`,
`odoo-bin`, `python`, `psql` or `npm` on the host for a site.

## 1. Find the site

```bash
ls ~/workspace/*/<site>/.ddev/config.odoo.yaml
```

`<folder>` is the sites folder the site is in (`dev`, `test`, `sandboxes`, `demos`). If the file is
not there, stop: this command is for a site built with `cmd-odoo-project.sh`, which writes it. If
`<folder>` has no `cmd-tools-testing.sh`, stop and say that the folder is not a sites folder of
this workspace.

## 2. Make sure the site answers and the testing stack is there

```bash
cd ~/workspace/<folder>
bash cmd-tools-odoo-cli.sh <site>
grep -c "@webship-js/odoo-steps" <site>/cucumber.js
```

The first prints the version, the address, the apps and the accounts; if the site does not answer,
`bash cmd-tools-odoo-cli.sh <site> --restart` starts it again and waits for it. If `cucumber.js`
is missing or does not name the step pack, set the stack up (it adds what is missing and keeps
what was changed):

```bash
bash cmd-tools-testing.sh <site>
```

## 3. Match every step, without a browser

```bash
bash cmd-tools-testing.sh <site> --dry-run                                        # the whole suite
bash cmd-tools-testing.sh <site> --dry-run --path tests/features/<name>.feature   # one feature
bash cmd-tools-testing.sh <site> --dry-run --tags "@critical"                     # one tag
```

Use the form that matches what was asked. An `Undefined` or `Ambiguous` step is a finding: name
the feature, the line and the phrase, show the closest phrase the pack defines
(`grep -hE "^(Given|When|Then)\(" <site>/node_modules/@webship-js/odoo-steps/tests/step-definitions/*.steps.js`),
and stop before the real run.

## 4. Run

```bash
bash cmd-tools-testing.sh <site> --run                                            # the whole suite
bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature       # one feature
bash cmd-tools-testing.sh <site> --run --tags "@critical"                         # one tag
```

Run it once. Do not add `--retry`, do not tag a scenario `@wip` and do not change a feature to
make the run pass.

## 5. Report

Say, in this order:

1. The site, its address (`https://<site>.ddev.site`) and what was run (suite, feature or tag).
2. The totals the run printed: scenarios and steps, passed and failed, and the time.
3. For each failed scenario: the feature and line, the step that failed, the message, and what
   it means for the site — a defect of the site, a scenario that asserts something the site never
   did, or the environment (the site was stopped, an account is missing:
   `bash cmd-tools-odoo-cli.sh <site> --add-users` adds the default ones).
4. Where the report is: `~/workspace/<folder>/<site>/tests/reports/`.

A failing suite is a result: report it as it is. The site is the Community edition: a scenario
that needs an app of another edition is reported as such, never worked around. Never create an account for a scenario,
never write a password into a feature file, and never write a platform name into a step phrase.
For writing or fixing scenarios, use the `odoo-scenarios` skill or hand over to the `odoo-tester`
agent; for changing the site, to `odoo-site-builder`.
