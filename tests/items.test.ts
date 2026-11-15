/**
 * The AI items this plugin carries (ai/ in the package, the manifest's `ai` block): agents, skills,
 * commands and prompts, each placed by the installer in the workspace folder of its kind.
 *
 * What is checked here is what a person relies on once they are installed: each item has the shape its
 * folder lists and Claude Code loads, and names nothing that does not exist — every cmd-*.sh, every flag
 * and every step phrase is one the plugin, the workspace or the step pack really has.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

import { AGENTS, SKILLS, AI_COMMANDS, PROMPTS, COMMANDS } from '../src/index';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');
const pkg = JSON.parse(read('package.json'));
const manifest = pkg.workspacePlugin;

// The kinds the workspace knows, and the folder each one lands in (core/workspace-app/plugin-install.js).
const KINDS: Record<string, string> = { agents: 'ai-agents', skills: 'ai-skills', commands: 'ai-commands', prompts: 'ai-prompts' };

/** Every file of the package under a path: the file itself, or all the files of a folder (a skill is a folder). */
function filesUnder(rel: string): string[] {
  const abs = path.join(PKG, rel);
  if (!fs.statSync(abs).isDirectory()) return [rel];
  return fs.readdirSync(abs).flatMap((e) => filesUnder(`${rel}/${e}`));
}
const ITEM_FILES: string[] = Object.keys(KINDS).flatMap((kind) => (manifest.ai[kind] || []).flatMap(filesUnder));
const frontmatter = (src: string) => (src.startsWith('---\n') ? src.split('\n---\n')[0] : '');

test('the manifest carries one list per kind, each item under ai/<kind>/, and needs the folder each kind lands in', () => {
  assert.deepStrictEqual(Object.keys(manifest.ai).sort(), Object.keys(KINDS).sort(), 'agents, skills, commands, prompts');
  for (const [kind, folder] of Object.entries(KINDS)) {
    const list: string[] = manifest.ai[kind];
    assert.ok(list.length > 0, `the plugin ships at least one of ${kind}`);
    for (const f of list) {
      assert.strictEqual(path.dirname(f), `ai/${kind}`, `${f} is in ai/${kind}/: the cmd-*.sh scripts keep commands/ to themselves`);
      assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the package`);
      assert.match(path.basename(f), /^odoo-[a-z0-9-]+(\.md)?$/, `${f} carries the plugin's name, so it never takes the name of another plugin's item`);
    }
    assert.ok(manifest.needs.includes(folder), `it ships ${kind}, so it needs ${folder}`);
  }
  assert.ok(pkg.files.includes('ai'), 'ai/ is published with the package');
  const names = (kind: string, ext = '.md') => manifest.ai[kind].map((f: string) => path.basename(f, ext));
  assert.deepStrictEqual(names('agents'), AGENTS);
  assert.deepStrictEqual(names('skills', ''), SKILLS);
  assert.deepStrictEqual(names('commands'), AI_COMMANDS);
  assert.deepStrictEqual(names('prompts'), PROMPTS);
  // Commands and prompts share one destination in Claude Code (~/.claude/commands): a name used by both is lost.
  assert.strictEqual(new Set([...AI_COMMANDS, ...PROMPTS]).size, AI_COMMANDS.length + PROMPTS.length, 'no command and prompt share a name');
});

test('a skill is a folder with a SKILL.md named after it, and says when to use it', () => {
  for (const f of manifest.ai.skills) {
    assert.ok(fs.statSync(path.join(PKG, f)).isDirectory(), `${f} is a folder`);
    const head = frontmatter(read(`${f}/SKILL.md`));
    assert.match(head, new RegExp(`^name: ${path.basename(f)}$`, 'm'));
    assert.match(head, /^description: .{80,}$/m, `${f} says what it does and when to use it`);
    assert.match(head, /Use when/, `${f} names the requests it answers to`);
  }
});

test('a command is a slash command: a description, an argument hint, and $ARGUMENTS where what was typed goes', () => {
  for (const f of manifest.ai.commands) {
    const src = read(f);
    const head = frontmatter(src);
    assert.match(head, /^description: .{40,}$/m, `${f} is described in the command list`);
    assert.match(head, /^argument-hint: .+$/m, `${f} says what to type after it`);
    assert.doesNotMatch(head, /^name:/m, `${f} is named by its file`);
    assert.ok(src.includes('$ARGUMENTS'), `${f} reads what was typed after the command`);
  }
});

test('a prompt is a line that says what it is for, then the whole launch command the New screen form reads', () => {
  for (const f of manifest.ai.prompts) {
    const src = read(f);
    assert.doesNotMatch(src, /^---\n/, `${f} has no frontmatter: it is not installed as a command`);
    assert.match(src.split('\n')[0], /^[A-Z].{20,}\.$/, `${f} opens with one sentence`);
    // The two expressions the dashboard reads a prompt with (core/workspace-app/screens.js).
    const flags = src.match(/^\s*claude\s+([^\n]*?)\s*"""\s*$/m);
    const text = src.match(/claude[^\n]*"""\n([\s\S]*?)\n"""/);
    assert.ok(flags && flags[1].trim() === '--permission-mode bypassPermissions', `${f} carries the claude flags`);
    assert.ok(text && text[1].trim().length > 100, `${f} carries the prompt`);
    assert.match(text![1], /<[a-z|]+>/, `${f} has placeholders to fill in`);
    assert.match(text![1], /^# .*container-based \(DDEV by default\)/m, `${f} says where it runs`);
  }
});

// What an item may name. The plugin's own commands and their flags are read from the package; the
// workspace's are the ones a sites folder and an AI folder carry (github.com/webship/workspace).
const CORE_COMMANDS: Record<string, string[]> = {
  'cmd-tools-testing.sh': ['--run', '--configure', '--browser', '--path', '--headed', '--dry-run', '--retry', '--tags'],
  'cmd-tools-add-users.sh': [],
  'cmd-tools-cancel-users.sh': [],
  'cmd-tools-remove.sh': [],
  'cmd-tools-clone.sh': ['--to'],
  'cmd-tools-ai-items.sh': ['--install'],
  'cmd-odoo20-project.sh': [],   // the example builder the sites folders carry themselves: the agent says how the two differ
};
const flagsOf = (args: string) => [...read(args).matchAll(/'(--[a-z-]+)'/g)].map((m) => m[1]);
const PLUGIN_COMMANDS: Record<string, string[]> = {
  'cmd-odoo-project.sh': flagsOf('scripts/args/arg-odoo.sh'),
  'cmd-tools-odoo-cli.sh': flagsOf('scripts/args/arg-odoo-cli.sh'),
};

test('every command an item names exists, with the flags it is given', () => {
  assert.deepStrictEqual(Object.keys(PLUGIN_COMMANDS), COMMANDS);
  const known: Record<string, string[]> = { ...CORE_COMMANDS, ...PLUGIN_COMMANDS };
  let used = 0;
  for (const f of [...ITEM_FILES, 'README.md']) {
    for (const line of read(f).split('\n')) {
      for (const m of line.matchAll(/(cmd-[a-z0-9<>-]+\.sh)((?:(?!cmd-)[^`|#])*)/g)) {
        const name = m[1].replace(/^cmd-tools-backup-<folder>\.sh$/, 'cmd-tools-backup-dev.sh');
        if (name === 'cmd-tools-backup-dev.sh') continue;   // every sites folder has its own: cmd-tools-backup-<folder>.sh
        assert.ok(known[name], `${f}: ${name} is not a command of the plugin or of the workspace`);
        // The flags of the command itself: what is inside --run "…" belongs to odoo-bin.
        const args = m[2].replace(/--run "[^"]*"/g, '--run').replace(/--run=\S+/g, '--run').replace(/--run [“"].*$/, '--run');
        for (const flag of args.match(/(?<![\w-])--[a-z][a-z-]*/g) || []) {
          assert.ok(known[name].includes(flag), `${f}: ${name} has no ${flag}`);
          used += 1;
        }
      }
    }
  }
  assert.ok(used > 20, 'the items do show the commands with their flags');
});

/** The steps of a Gherkin text, without their keyword; a placeholder of an outline stands for any word. */
function stepsOf(gherkin: string): string[] {
  return gherkin.split('\n').map((l) => l.trim()).filter((l) => /^(Given|When|Then|And|But) /.test(l))
    .map((l) => l.replace(/^(Given|When|Then|And|But) /, '').replace(/<[a-z_]+>/g, 'x'));
}

test('every step phrase an item shows is one the step pack or webship-js defines, and names no platform', () => {
  const definitions = read('tests/fixtures/step-definitions.txt').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => new RegExp(l));
  assert.ok(definitions.length > 300, 'the definitions of the pack and of webship-js');
  let checked = 0;
  for (const f of [...ITEM_FILES, 'README.md', 'testing/site.feature']) {
    const src = read(f);
    const gherkin = f.endsWith('.feature') ? [src] : [...src.matchAll(/```gherkin\n([\s\S]*?)```/g)].map((m) => m[1]);
    for (const step of gherkin.flatMap(stepsOf)) {
      assert.ok(definitions.some((d) => d.test(step)), `${f}: no step definition matches "${step}"`);
      // The phrase is what is checked: a value in quotes (a title, an address, what the page prints) is the site's own.
      assert.doesNotMatch(step.replace(/"[^"]*"/g, '""'), /odoo/i, `${f}: "${step}" names the platform`);
      assert.doesNotMatch(step, /dD\.123123ddd/, `${f}: "${step}" carries a password`);
      checked += 1;
    }
  }
  assert.ok(checked > 80, `the items show real phrases (${checked} checked)`);
});

test('the examples of the skill are whole features that create no account', () => {
  const examples = ITEM_FILES.filter((f) => f.endsWith('.feature'));
  assert.ok(examples.length >= 3);
  for (const f of examples) {
    const src = read(f);
    assert.match(src, /^Feature: .+$/m);
    assert.match(src, /^\s+Scenario: .+$/m);
    assert.doesNotMatch(src, /user create|register|password "/i, `${f} creates no account and carries no password`);
    assert.ok(read('ai/skills/odoo-scenarios/SKILL.md').includes(`examples/${path.basename(f)}`), `the skill names ${f}`);
  }
});

test('the items say container-based, name the plugin they come with, and carry no personal value', () => {
  for (const f of ITEM_FILES) {
    const src = read(f);
    assert.doesNotMatch(src, /DDEV-only/i, `${f}: the workspace is container-based, DDEV by default`);
    assert.doesNotMatch(src, /\/home\/(?!YOUR_USER)[a-z]/, `${f} carries no personal path`);
    for (const m of src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g) || []) assert.match(m, /@example\.(com|org)$/, `${f}: ${m} is not an example address`);
    assert.doesNotMatch(src, /dD\.123123ddd|CHANGE_ME/, `${f} carries no password`);
  }
  for (const f of [...manifest.ai.agents, ...manifest.ai.commands, ...manifest.ai.prompts, ...manifest.ai.skills.map((s: string) => `${s}/SKILL.md`)]) {
    assert.match(read(f).replace(/\s+/g, ' '), /container-based (workspace )?\(DDEV by default\)|container-based, DDEV by default/, `${f} says what the workspace runs on`);
    assert.match(read(f), /cmd-tools-testing\.sh|cmd-odoo-project\.sh/, `${f} names the commands the plugin works with`);
  }
  const readme = read('README.md');
  for (const name of [...AGENTS, ...SKILLS, ...AI_COMMANDS, ...PROMPTS]) assert.ok(readme.includes(name), `the README lists ${name}`);
});

// The items are for any AI CLI: the body is plain Markdown ("run this command", "read this file"), and Claude Code is
// only the default shape (the frontmatter, the file layout, the launch line of a prompt).
test('the body of an item names no tool or feature of one AI CLI', () => {
  for (const f of ITEM_FILES.filter((i) => i.endsWith('.md'))) {
    const src = read(f);
    let body = src.startsWith('---\n') ? src.split('\n---\n').slice(1).join('\n---\n') : src;
    if (manifest.ai.prompts.includes(f)) {
      assert.match(body, /another AI CLI/, `${f} says the text between the quotes can be given to another AI CLI as it is`);
      body = body.split('\n').filter((l) => !/^\s*claude --permission-mode bypassPermissions """\s*$/.test(l) && !/another AI CLI/.test(l)).join('\n');
    }
    assert.doesNotMatch(body, /\b(Bash|Read|Write|Edit|Grep|Glob|Task|Skill|Agent) tool\b|\bsubagents?\b|bypassPermissions|\bClaude\b|\.claude\b/, `${f}: the body is for any AI CLI`);
  }
  for (const f of manifest.ai.commands) assert.match(read(f), /The first word is/, `${f} says in words what the arguments are`);
});

// The fixture is the pack at the version the builder pins, so a phrase checked here is one a project really gets.
test('the fixture is the pack at the version the builder pins', () => {
  const head = read('tests/fixtures/step-definitions.txt').split('\n')[0];
  const pin = read('scripts/functions/fun-odoo.sh').match(/_STEPS_VERSION='\^([0-9.]+)'/)![1];
  assert.ok(head.includes(`@webship-js/odoo-steps ${pin} `), `the fixture is read from @webship-js/odoo-steps ${pin}: ${head}`);
});
