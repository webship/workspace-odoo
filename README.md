# @webship.co/workspace-odoo

Odoo Community for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a
builder that makes a real Odoo site in containers, an odoo-bin tool for the sites it built, the
default accounts, the [Odoo step pack](https://github.com/webship/odoo-steps) wired into the
workspace's testing setup, and two AI agents that know all of it.

The workspace is container-based (DDEV by default): an Odoo project is a row like any other, so
the row menus the core draws (start, stop, launch, backup, clone, remove, tests) work on it
unchanged.

It is Odoo Community: never the Enterprise edition, no trial, no licence and no vendor account.
The module that sends what a user types to an outside service (`partner_autocomplete`) is
uninstalled when the database is created.

The plugin is made from the reference platform plugin,
[`@webship.co/workspace-wordpress`](https://github.com/webship/workspace-wordpress); what differs is
what Odoo needs, see [What is different from a PHP platform](#what-is-different-from-a-php-platform).

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require github:webship/workspace-odoo   # npm install into the dashboard
bash core/scripts/plugins.sh --activate odoo                            # plugins.odoo in settings.yml
bash core/scripts/plugins.sh --install odoo                             # commands, functions, args, agents
bash core/scripts/plugins.sh --configure odoo                           # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an agent you edited stays.

The commands land in the sites folders that are in the workspace (`dev`, `test`, `sandboxes`,
`demos`); the agents land in the AI Agents folder (`ai-agents/`) when the workspace has one, and are
installed into `~/.claude/agents` from there like any other agent.

The agents, the builder's flags in the Build form and the step pack in the testing setup need a
Webship Workspace after 1.0.6.

## This builder and `cmd-odoo20-project.sh`

The sites folders of the workspace (the `dev`, `test` and `sandboxes` folder plugins) carry an
example builder of their own, `cmd-odoo20-project.sh` (**Odoo 20 Community** in the Build list),
with its functions in the core (`build_odoo` in `core/scripts/functions/fun-odoo.sh`). It shows how
a platform that is not PHP is built: Odoo 20 with the base module, behind the web container's own
web server.

This plugin leaves that example exactly as it is, and the two can be in a folder together:

| | `cmd-odoo20-project.sh` (the folder's example) | `cmd-odoo-project.sh` (this plugin) |
| --- | --- | --- |
| In the Build list | Odoo 20 Community | Odoo 17 Community (apps, accounts, tests) |
| Release | 20.0, fixed | 17.0 by default (the release the step pack is proven on); `--version` names another tag of the image |
| What `--install` makes | The base module | The apps (Contacts, CRM, Sales, Invoicing, Website with blog, shop, events, jobs) with demo data, the workspace account as the administrator, the module that calls an outside service uninstalled |
| How it is served | The web container's web server proxies to Odoo | The router serves Odoo's port; Odoo runs with `--proxy-mode` and a `--db-filter` |
| Accounts | The administrator | The administrator, and with `--add-users` the default accounts |
| Tool, tests, agents | None | `cmd-tools-odoo-cli.sh`, the Odoo step pack in `cmd-tools-testing.sh`, `odoo-site-builder` and `odoo-tester` |
| Functions | `build_odoo`, `odoo_cli`, `odoo_write_compose`, `odoo_write_nginx` (the core's) | `odoo_build`, `odoo_bin`, `odoo_cli_tool` and the rest in `fun-odoo.sh` of the plugin: none of the core's names is defined again |

The commands have different names, so neither replaces the other. The plugin's tool, its accounts
and its testing setup work on the projects `cmd-odoo-project.sh` built (they carry
`.ddev/config.odoo.yaml`) and refuse the others, a project of the example builder included.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-odoo-project.sh` | The builder, in the Build list as **Odoo 17 Community (apps, accounts, tests)**, installed into every sites folder |
| `commands/cmd-tools-odoo-cli.sh` | odoo-bin for one project: what the site is, a command, apps, an update, a restart, the default accounts |
| `scripts/functions/fun-odoo.sh` | The bash functions behind both, sourced by bootstrap once installed; the names the core's tools look for (`set_odoo_users`, `add_odoo_users`, `cancel_odoo_users`, `testing_configure_odoo`) |
| `scripts/args/arg-odoo.sh`, `arg-odoo-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `scripts/odoo-accounts.py` | The administrator, the default accounts and what keeps the site local, run in the Odoo shell of the project |
| `testing/site.feature` | The first feature an Odoo project gets when testing is set up |
| `agents/odoo-site-builder.md` | The agent that builds and maintains Odoo sites with these commands |
| `agents/odoo-tester.md` | The agent that writes and runs scenarios with the Odoo step pack |
| `src/index.ts` | `register(api)`: what the assistant is told about Odoo here |
| `features/odoo.feature` | Scenarios for the dashboard's own browser suite |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## What is different from a PHP platform

Odoo is a Python application that ships as a container image, and DDEV has no project type for
it. The plugin keeps the shape of the reference and changes only this:

| | WordPress (the reference) | Odoo |
| --- | --- | --- |
| Project | `--project-type=wordpress`, nginx and PHP | `--project-type=generic --webserver-type=generic`; Odoo is a service of the project (`.ddev/docker-compose.odoo.yaml`, the official Community image) and the router serves its port |
| Recognised by | The DDEV project type | The file `.ddev/config.odoo.yaml` |
| Database | The container tool's default, settings written by the tool | PostgreSQL 16 from the container tool; the compose file carries the container's own `db` / `db` / `db`, and the one database is `db` |
| Getting the code | `wp core download` | The container image `odoo:<version>` |
| Install | `wp core install` | `odoo-bin -i <apps>` on the database, then the workspace account is set on the administrator |
| Accounts | WP-CLI | A script run in the Odoo shell (`scripts/odoo-accounts.py`) |
| Users menu of the row | Reads the project type | Does not apply (no project type): `cmd-tools-odoo-cli.sh --add-users`, or `cmd-tools-add-users.sh <name> odoo` |

## The commands

Run them from a sites folder. `--help` is safe on both.

### Build a site

```bash
cd ~/workspace/dev
bash cmd-odoo-project.sh mysite --install --add-users
```

| Flag | What it does |
| --- | --- |
| `--version <x>` | The release to run, as the image is tagged. `17.0` is the default and the one the apps, the accounts and the step pack are proven on; another tag is yours to try |
| `--install` | Create the database with the apps and the demo data, with the workspace account as the administrator |
| `--add-users` | With `--install`: add the default accounts |
| `--apps <a,b>` | The apps `--install` installs, by their technical names (the default: `contacts,crm,sale_management,account,website,website_blog,website_sale,website_event,website_hr_recruitment`) |
| `--without-demo` | With `--install`: leave the demo data out |
| `--launch` | Open the site when it is ready |

The site answers at `https://mysite.ddev.site`, the login at `/web/login`. Custom modules go in the
project's `addons/` folder. A project of the same name is deleted first. The first build pulls the
image, and the install of the default apps with demo data takes several minutes.

### Work on a site

```bash
bash cmd-tools-odoo-cli.sh mysite                                    # version, address, apps, accounts
bash cmd-tools-odoo-cli.sh mysite --install-apps project,hr          # install apps, then start Odoo again
bash cmd-tools-odoo-cli.sh mysite --update                           # odoo-bin -u all, then start Odoo again
bash cmd-tools-odoo-cli.sh mysite --run "-u sale --stop-after-init"  # any odoo-bin arguments
bash cmd-tools-odoo-cli.sh mysite --run=--version                    # one argument that starts with a dash: with an equals sign
bash cmd-tools-odoo-cli.sh mysite --restart                          # start Odoo again and wait for it
bash cmd-tools-odoo-cli.sh mysite --add-users                        # the default accounts
bash cmd-tools-odoo-cli.sh mysite --cancel-users                     # delete them, or archive what Odoo keeps
```

### The default accounts

| Account | What it may do | Handle in the tests |
| --- | --- | --- |
| `administrator` | Every installed app, and the settings | `admin` |
| `salesperson` | Sales and CRM, own documents only; no Invoicing | `salesperson` |
| `accountant` | Invoicing; no Sales, no CRM | `accountant` |
| `employee` | An internal user with no app-specific group | `employee` |
| `portal` | A portal user: the website and `/my`, never the web client | `portal` |

Each has the address `<account>@example.com` and the password of the workspace's other default
lists. They are for local sites and for tests; the site's own administrator is the workspace
account and is never written into a test. `bash cmd-tools-add-users.sh mysite odoo` and
`bash cmd-tools-cancel-users.sh mysite odoo` add and remove the same list. The demo data of Odoo
already has a `portal` user: it keeps its name and gets the groups and the password of the list.
On a cancel, an account that is part of the data of the site (that `portal` user), or that records
point at, is archived instead of deleted, and comes back with the next `--add-users`.

### Test a site

```bash
bash cmd-tools-testing.sh mysite                 # webship-js, the step pack, the users registry, a first feature
bash cmd-tools-testing.sh mysite --run           # run the suite in the container
bash cmd-tools-testing.sh mysite --run --path tests/features/site.feature
```

`cmd-tools-testing.sh` is the workspace's own. For an Odoo project it also adds
`@webship-js/odoo-steps` to `package.json`, lists its step definitions in `cucumber.js` after
webship-js's own, writes the users registry (the handles above, overridable with
`ODOO_<HANDLE>_USER` and `ODOO_<HANDLE>_PASSWORD`), places `tests/features/site.feature` when the
project has none, and makes sure the default accounts are on the site. Run it again and it adds
what is missing and keeps what you changed.

## The agents

| Agent | Use it to |
| --- | --- |
| `odoo-site-builder` | Build, update, restart, maintain or remove an Odoo Community site with the commands above, in containers only |
| `odoo-tester` | Set the testing stack up, look at the site in the Playwright MCP browser first, write scenarios from the pack's steps and run them; it never creates an account in a suite and never writes a platform name into a step phrase |

After `--install` they are in the AI Agents folder of the dashboard; **Install** there puts one into
`~/.claude/agents`, or from the command line:

```bash
cd ~/workspace/ai-agents
bash cmd-tools-ai-items.sh odoo-tester --install
```

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint
npm test        # the manifest, the commands, the agents, the functions against a scaffolded project
```
