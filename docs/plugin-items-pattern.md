# A plugin carries its own items

Every `@webship.co/workspace-<name>` plugin manages what belongs to it: its `cmd-*.sh` commands and
its AI items (agents, skills, commands, prompts). The package holds them, the manifest names them,
and `plugins.sh --install <name>` lists each one in the workspace folder of its kind, when that
folder is an active workspace folder. `--uninstall` takes them away again. The reference is
[`@webship.co/workspace-wordpress`](https://github.com/webship/workspace-wordpress), and this plugin
follows it; below, `<p>` is the plugin's name.

## The layout

```text
commands/cmd-<p>-project.sh            cmd-*.sh scripts only: builders and tools, placed in workspace folders
commands/cmd-tools-<p>-cli.sh
ai/agents/<p>-<role>.md                one file per agent
ai/skills/<p>-<topic>/SKILL.md         one folder per skill; every file in it is placed (examples/, references/)
ai/commands/<p>-<verb>.md              one file per slash command
ai/prompts/<p>-<task>.md               one file per prompt
tests/items.test.ts                    the shape of every item, and that it names nothing that does not exist
tests/fixtures/step-definitions.txt    the step definitions the items' phrases are checked against (a plugin with a step pack)
```

`commands/` is taken by the `cmd-*.sh` scripts, so the AI items live under `ai/`, one folder per
kind, named like the manifest's `ai` keys. The installer places an item by the last part of its
path, whatever folder the package keeps it in, so a plugin that kept its agents in `agents/` moves
them with `git mv agents ai/agents` and changes two lines of its manifest.

## The manifest

```json
"files": ["dist/src", "ai", "commands", "docs", "features", "scripts", "testing", "README.md"],
"workspacePlugin": {
  "name": "<p>",
  "needs": [["dev", "test", "sandboxes", "demos"], "ai-agents", "ai-skills", "ai-commands", "ai-prompts"],
  "commands": { "types": ["sites"], "workspaces": ["dev", "test", "sandboxes", "demos"],
                "files": ["commands/cmd-<p>-project.sh", "commands/cmd-tools-<p>-cli.sh"] },
  "ai": {
    "agents":   ["ai/agents/<p>-site-builder.md", "ai/agents/<p>-tester.md"],
    "skills":   ["ai/skills/<p>-scenarios"],
    "commands": ["ai/commands/<p>-test.md"],
    "prompts":  ["ai/prompts/<p>-build-and-test.md"]
  }
}
```

- `ai` is in `files`, or the items are not in the published package.
- A skill is named by its folder, with no `/SKILL.md` and no trailing slash.
- `needs` names the folder of every kind the plugin ships, after the folder its commands need. A
  plugin with no `cmd-*.sh` for a sites folder leaves the first entry out; a kind it does not ship
  is left out of `ai` and of `needs`.

| Kind | Lands in | Claude Code reads it from |
| --- | --- | --- |
| `commands.files` | every active folder `commands.workspaces` names, else every active folder of `commands.types` | the folder itself: `bash cmd-….sh` |
| `ai.agents` | `ai-agents/<name>.md` | `~/.claude/agents`, after Install |
| `ai.skills` | `ai-skills/<name>/` | `~/.claude/skills`, after Install |
| `ai.commands` | `ai-commands/<name>.md` | `~/.claude/commands`, after Install: `/<name>` |
| `ai.prompts` | `ai-prompts/<name>.md` | nothing: the New screen form lists it as a template for a new session |

## The shape of each kind

| Kind | Shape |
| --- | --- |
| Agent | Frontmatter `name` (the file's name), `description` (when to use it, with the phrases a person says), `model: fable`, `tools`; then what it does, the commands it runs, its rules |
| Skill | `SKILL.md` with frontmatter `name` (the folder's name) and `description` (what it does, then `Use when …`); files beside it for what is too long or is meant to be copied |
| Command | Frontmatter `description` and `argument-hint`, no `name` (the file names it); the body reads what was typed from `$ARGUMENTS` |
| Prompt | No frontmatter. One sentence that says what it is for, then a fenced block holding the whole launch command: `claude --permission-mode bypassPermissions """` … `"""`, with `<placeholders>` to fill in and a `#` line that says where it runs |

Names start with the plugin's name (`<p>-…`): an item that is already in the folder under the same
name is kept, so a name another plugin could also choose would never be placed. A command and a
prompt never share a name: both end in `~/.claude/commands`.

## What an item may say

Nothing generic and nothing invented. An item is about what this plugin does in the workspace, and
every command, flag, path and step phrase in it exists:

- commands and flags: the plugin's own (`scripts/args/*.sh`) and the workspace's (`cmd-tools-testing.sh`
  and its flags, `cmd-tools-remove.sh`, `cmd-tools-clone.sh --to`, `cmd-tools-ai-items.sh --install`);
- step phrases: the plugin's step pack and webship-js, as installed in a real project;
- the workspace is container-based (DDEV by default); no platform name in a step phrase; no
  account created by a scenario; no password, no personal path, addresses at `example.com`.

Run every command an item tells its reader to run, and every scenario it shows, on a real site
before it is pushed. Two of the three example features of the reference failed on their first real
run, each on a phrase that exists and matched in a dry run.

## The tests to copy

`tests/items.test.ts` checks, with no site and no network:

1. the manifest: one list per kind, each item under `ai/<kind>/`, in the package, named `<p>-…`,
   `ai` in `files`, the folder of each kind in `needs`, no command and prompt of the same name;
2. the shape of each kind (the table above; the two expressions the dashboard reads a prompt with);
3. every `cmd-*.sh` an item names is the plugin's or the workspace's, with flags that exist;
4. every step in a `gherkin` block or a `.feature` file matches a definition in
   `tests/fixtures/step-definitions.txt`, names no platform and carries no password;
5. the words: container-based, no personal value, the README lists every item.

Refresh the fixture from a project whose testing stack is set up, whenever the pack's release
line changes (`<pack>` is the plugin's step pack):

```bash
cd ~/workspace/<folder>/<site>
{ echo "# <pack> <version> and webship-js <version>" ;
  grep -hE "^(Given|When|Then)\(/" node_modules/<pack>/tests/step-definitions/*.steps.js node_modules/webship-js/tests/step-definitions/*.steps.js \
    | sed -nE 's/^(Given|When|Then)\(\/(.*)\/, (async )?function.*/\2/p' | sort -u ; } > step-definitions.txt
```

`tests/needs.test.ts` holds the exact `needs` list, and `tests/plugin.test.ts` that every file the
manifest names ships.

## Prove it on a fresh workspace

Never in a workspace somebody works in. `webship-workspace init <folder>` makes an empty one.

```bash
npm pack                                                                 # in the plugin: the tarball of the branch
cd <the fresh workspace>
bash core/scripts/plugins.sh --require <path>/webship.co-workspace-<p>-<version>.tgz   # says what it needs
bash core/scripts/plugins.sh --activate <p>                              # stops: lists what is not here, changes nothing
bash core/scripts/plugins.sh --activate <p> --with-needs                 # adds the folders, then activates
bash core/scripts/plugins.sh --install <p>                               # "placed …" once per file
ls dev ai-agents ai-skills ai-commands ai-prompts                        # each item in its folder
bash core/scripts/plugins.sh --list                                      # needs: … met by …
bash core/scripts/plugins.sh --uninstall <p>                             # "removed …" once per file
grep -c "<p>" core/config/plugins.installed.yml                          # 0: the record is gone
```

Then, installed again: build one site with the builder, run each command the items name, copy the
skill's examples into the suite and run them, look at the four AI folders on the dashboard, and
remove the site with `cmd-tools-remove.sh`.

## What was found on the way

- A phrase that matches in a dry run can still fail: a step may need another one before it
  (`I should see the page title` needs `Given I am on a page`), or assert something the site does
  not do as built. Only a real run tells.
- Content a failed scenario created stays on the site. Name it so it is found, and remove it
  through the CLI tool before the next run (an entry in the trash is not in a list of every status).
- A folder that is not active gets nothing: the install says `skipped <n> <kind>` for it, and
  places the items when the folder is added. With the folder in `needs`, `--activate` and
  `--install` stop before that and offer to add it.
- An item a person edited in its folder is kept by `--install` and by `--uninstall`: the record
  holds the hash of what was placed.
