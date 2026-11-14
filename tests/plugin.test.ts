import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { register, assistantContext, PLATFORM, COMMANDS, AGENTS } from '../src/index';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');
const manifest = JSON.parse(read('package.json')).workspacePlugin;

test('the manifest names the platform, and every file it names ships', () => {
  assert.strictEqual(manifest.name, PLATFORM);
  const named = [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args, ...manifest.scripts.machine,
    ...manifest.ai.agents, ...manifest.features];
  for (const f of named) assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the package`);
  assert.deepStrictEqual(manifest.commands.files.map((f: string) => path.basename(f)), COMMANDS);
  assert.deepStrictEqual(manifest.ai.agents.map((f: string) => path.basename(f, '.md')), AGENTS);
  assert.deepStrictEqual(manifest.commands.types, ['sites'], 'the commands go to sites folders only');
  const files: string[] = JSON.parse(read('package.json')).files;
  for (const f of named) assert.ok(files.includes(f.split('/')[0]), `${f} is published with the package`);
});

test('every command finds the workspace by itself, names its folder, and sources its args from where the installer puts them', () => {
  for (const f of manifest.commands.files) {
    const src = read(f);
    assert.match(src, /^#!\/usr\/bin\/env bash/, `${f} is a bash script`);
    assert.match(src, /WORKSPACE_SCRIPTS="\$\{WORKSPACE_SCRIPTS:-\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\.\/core\/scripts" && pwd\)\}"/, `${f} locates the tooling from its own path`);
    assert.match(src, /workspace\.__WORKSPACE__\.settings\.yml/, `${f} loads the settings of the folder it is installed into`);
    assert.match(src, /source \$\{WORKSPACE_SCRIPTS\}\/plugins\/odoo\/args\/arg-[a-z-]+\.sh \|\| exit 1 ;/, `${f} reads its arguments from the plugin's args`);
    const last = src.trim().split('\n').pop() as string;
    assert.match(read('scripts/functions/fun-odoo.sh'), new RegExp(`^function ${last.replace(/ ;$/, '')}\\(\\)`, 'm'), `${f} ends by calling a function the plugin defines`);
  }
  assert.match(read('commands/cmd-odoo-project.sh'), /^# workspace-name: Odoo 17 Community/m, 'the builder carries the name the Build list shows');
  assert.doesNotMatch(read('commands/cmd-tools-odoo-cli.sh'), /^# workspace-name:/m, 'a tool is not a builder');
});

test('every shell script parses', () => {
  for (const f of [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args]) {
    const r = spawnSync('bash', ['-n', path.join(PKG, f)], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('the functions carry the names the core\'s tools look for, and write only the container\'s own settings', () => {
  const src = read('scripts/functions/fun-odoo.sh');
  for (const fn of ['set_odoo_users', 'add_odoo_users', 'cancel_odoo_users', 'testing_configure_odoo', 'odoo_build', 'odoo_cli_tool']) {
    assert.match(src, new RegExp(`^function ${fn}\\(\\) \\{`, 'm'), `${fn} is defined`);
  }
  // The core carries an example Odoo builder; its functions keep their meaning with the plugin installed.
  for (const fn of ['build_odoo', 'odoo_cli', 'odoo_write_compose', 'odoo_write_nginx']) {
    assert.doesNotMatch(src, new RegExp(`^function ${fn}\\(\\)`, 'm'), `the core's own ${fn} is not redefined`);
  }
  assert.ok(!manifest.commands.files.some((f: string) => /odoo20/.test(f)), 'the folder\'s example builder is not replaced');
  assert.match(src, /--project-type=generic --webserver-type=generic/, 'no project type of its own: a generic project, with no web server');
  assert.match(src, /--database=postgres:16/, 'the database is the container tool\'s PostgreSQL');
  assert.match(src, /- HOST=db\n\s+- USER=db\n\s+- PASSWORD=db\n/, 'the database settings are the container\'s own');
  assert.match(src, /image: "odoo:\$\{version\}"/, 'the official Community image');
  assert.match(src, /command: odoo --proxy-mode --db-filter=/, 'behind the router, with one database');
  assert.match(src, /--nodejs-version=\$\(ddev_nodejs_version\)/, 'the build runs the Node.js of the workspace rule');
  assert.doesNotMatch(src, /ddev stop -y/, 'ddev stop takes no -y');
});

test('each agent is a definition the AI Agents folder can list: named after its file, described, on the fable model', () => {
  for (const f of manifest.ai.agents) {
    const src = read(f);
    const head = src.split('\n---\n')[0];
    assert.match(head, /^---\n/, `${f} opens with frontmatter`);
    assert.match(head, new RegExp(`^name: ${path.basename(f, '.md')}$`, 'm'));
    assert.match(head, /^description: .{80,}$/m, `${f} says when to use it`);
    assert.match(head, /^model: fable$/m);
    assert.match(head, /^tools:\n(  - \S+\n?)+/m);
    assert.match(src, /cmd-tools-testing\.sh|cmd-odoo-project\.sh/, `${f} names the plugin's commands`);
  }
  const tester = read('agents/odoo-tester.md');
  assert.match(tester, /Never create an account in a suite/);
  assert.match(tester, /No platform name in a step phrase/);
  assert.match(tester, /Playwright MCP browser first/);
});

test('register() adds the assistant context and nothing else', () => {
  const calls: string[] = [];
  const api: any = { name: 'odoo', addAssistantContext: (fn: () => string) => calls.push(fn()) };
  register(api);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0], assistantContext());
  for (const c of COMMANDS) assert.ok(calls[0].includes(c), `the assistant is told about ${c}`);
  for (const a of AGENTS) assert.ok(calls[0].includes(a), `the assistant is told about ${a}`);
});

test('the docs say container-based, name only what ships, and carry no personal value', () => {
  const docs = ['README.md', ...manifest.ai.agents, 'scripts/functions/fun-odoo.sh', 'scripts/odoo-accounts.py'];
  for (const f of docs) {
    const src = read(f);
    assert.doesNotMatch(src, /DDEV-only/i, `${f}: the workspace is container-based, DDEV by default`);
    assert.doesNotMatch(src, /\/home\/(?!YOUR_USER)[a-z]/, `${f} carries no personal path`);
    const mails = src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g) || [];
    for (const m of mails) assert.match(m, /@example\.(com|org)$/, `${f}: ${m} is not an example address`);
  }
  for (const c of COMMANDS) assert.ok(read('README.md').includes(c), `the README lists ${c}`);
});

test('the accounts script is one Python can compile, prints no password, and keeps the site local', () => {
  const file = path.join(PKG, 'scripts', 'odoo-accounts.py');
  const r = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(open(sys.argv[1]).read())', file], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const src = read('scripts/odoo-accounts.py');
  for (const line of src.split('\n').filter((l) => /\bprint\(/.test(l))) assert.doesNotMatch(line, /password/i, line);
  assert.match(src, /\('name', '=', 'partner_autocomplete'\), \('state', '=', 'installed'\)/, 'the module that calls an outside service is looked for');
  assert.match(src, /autocomplete\.button_immediate_uninstall\(\)/, 'and uninstalled');
});

test('it is the Community edition: no Enterprise, no vendor account', () => {
  for (const f of ['package.json', ...manifest.commands.files, 'scripts/functions/fun-odoo.sh', 'scripts/args/arg-odoo.sh', 'scripts/odoo-accounts.py']) {
    assert.doesNotMatch(read(f), /odoo\.com|enterprise-|web_enterprise|iap\.odoo/i, `${f} reaches for nothing of the vendor`);
  }
  assert.match(read('scripts/functions/fun-odoo.sh'), /image: "odoo:/, 'the image is the Community one');
  for (const f of ['README.md', ...manifest.ai.agents]) assert.match(read(f), /never the Enterprise edition|Never the Enterprise edition/, `${f} says Community only`);
  assert.match(read('README.md'), /cmd-odoo20-project\.sh/, 'the README says how the plugin relates to the folder\'s example builder');
});
