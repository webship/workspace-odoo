import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-odoo.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

/** A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled. */
function project(type: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'odoo-plugin-'));
  const dir = path.join(root, 'dev', 'site1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: site1\ntype: ${type === 'odoo' ? 'generic' : type}\ndocroot: ""\n`);
  // What the builder leaves: the file an Odoo project of this plugin is recognised by.
  if (type === 'odoo') fs.writeFileSync(path.join(dir, '.ddev', 'config.odoo.yaml'), 'web_environment:\n  - ODOO_VERSION=17.0\n');
  // What the folder's example builder (cmd-odoo20-project.sh) leaves: the compose file only.
  if (type === 'odoo20') fs.writeFileSync(path.join(dir, '.ddev', 'docker-compose.odoo.yaml'), 'services:\n  odoo: {}\n');
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'site1', devDependencies: { 'webship-js': '^2.0.6' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'odoo'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'site.feature'), path.join(scripts, 'plugins', 'odoo', 'site.feature'));
  fs.copyFileSync(path.join(PKG, 'scripts', 'odoo-accounts.py'), path.join(scripts, 'plugins', 'odoo', 'odoo-accounts.py'));
  return { root, dir, scripts };
}

/** Run bash with the plugin's functions sourced and `ddev` replaced by a recorder (the database says base is installed). */
function bash(script: string, env: Record<string, string> = {}) {
  const r = spawnSync('bash', ['-c', `ddev() { echo "ddev $*" >> "\${DDEV_LOG:-/dev/null}" ; case "$*" in *psql*) echo installed ;; *curl*) echo 200 ;; esac ; return 0 ; }\ndocker() { echo "docker $*" >> "\${DDEV_LOG:-/dev/null}" ; }\nsleep() { :; }\nsource ${FUNCTIONS}\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env } });
  return r;
}

/** What a recorded `ddev exec -s odoo ODOO_ACCOUNTS=<base64> ODOO_ACCOUNTS_VERB=<verbs> odoo shell …` handed to the accounts script. */
function payloads(log: string) {
  return fs.readFileSync(log, 'utf8').split('\n')
    .map((l) => /^ddev exec -s odoo ODOO_ACCOUNTS=(\S+) ODOO_ACCOUNTS_VERB=(\S+) odoo shell --db_host=db --db_user=db --db_password=db -d db --no-http /.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ verb: m[2], given: JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) }));
}

const ACCOUNT = { account_name: 'webmaster', account_mail: 'webmaster@example.com', account_pass: 'a "quoted" $pass \'word' };

test('the default accounts are one per kind of user, with example addresses', () => {
  const r = bash('set_odoo_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; echo "${!n}|${!m}|${!p}|${!l}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'salesperson', 'accountant', 'employee', 'portal']);
  // Every role the list names is one the accounts script knows the groups of.
  const script = fs.readFileSync(path.join(PKG, 'scripts', 'odoo-accounts.py'), 'utf8');
  for (const [name, mail, password, role] of rows) {
    assert.strictEqual(mail, `${name}@example.com`);
    assert.strictEqual(role, name);
    assert.ok(password.length >= 8);
    assert.match(script, new RegExp(`^    '${role}': \\[`, 'm'), `${role} has its groups`);
  }
});

test('the accounts reach the Odoo shell as one encoded value: the administrator is the workspace account, nothing is written to a file', () => {
  const p = project('odoo');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, ...ACCOUNT };
  const r = bash('set_odoo_users ; add_odoo_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const [call] = payloads(log);
  assert.strictEqual(call.verb, 'add');
  assert.deepStrictEqual(call.given.owner, { name: 'webmaster', email: 'webmaster@example.com', password: ACCOUNT.account_pass }, 'a password with quotes and a dollar sign arrives whole');
  assert.deepStrictEqual(call.given.accounts.map((x: any) => `${x.name}:${x.role}`), ['administrator:administrator', 'salesperson:salesperson', 'accountant:accountant', 'employee:employee', 'portal:portal']);
  assert.ok(!r.stdout.includes(ACCOUNT.account_pass), 'the password of the workspace account is not printed');
  const left = spawnSync('grep', ['-rl', 'quoted', p.dir], { encoding: 'utf8' });
  assert.strictEqual(left.stdout, '', 'and is in no file of the project');
  // The same door for removing them.
  assert.strictEqual(bash('set_odoo_users ; cancel_odoo_users', env).status, 0);
  assert.strictEqual(payloads(log)[1].verb, 'cancel');
});

test('the builder\'s files make Odoo a service of the project on the container\'s own database, behind the router', () => {
  const p = project('drupal11');
  const r = bash(`odoo_site_write_ddev_config ${p.dir} 17.0`);
  assert.strictEqual(r.status, 0, r.stderr);
  const compose = fs.readFileSync(path.join(p.dir, '.ddev', 'docker-compose.odoo.yaml'), 'utf8');
  assert.match(compose, /^    image: "odoo:17\.0"$/m);
  assert.match(compose, /^    container_name: ddev-\$\{DDEV_SITENAME\}-odoo$/m);
  assert.match(compose, /- HOST=db\n(\s+#.*\n)*\s+- USER=db\n\s+- PASSWORD=db\n/);
  assert.match(compose, /- VIRTUAL_HOST=\$DDEV_HOSTNAME\n\s+- HTTP_EXPOSE=80:8069\n\s+- HTTPS_EXPOSE=443:8069\n/, 'the router serves the port of Odoo');
  assert.match(compose, /^    command: odoo --proxy-mode --db-filter=\^db\$\$ --database=db --max-cron-threads=1$/m, 'one database, never the database selector');
  assert.match(compose, /- \.\.\/addons:\/mnt\/extra-addons/);
  assert.ok(fs.existsSync(path.join(p.dir, 'addons')), 'the folder for custom modules');
  assert.match(fs.readFileSync(path.join(p.dir, '.ddev', 'config.odoo.yaml'), 'utf8'), /web_environment:\n  - ODOO_VERSION=17\.0\n/);
  assert.ok(!fs.existsSync(path.join(p.dir, '.ddev', 'nginx_full')), 'no web server configuration of its own: that is the example builder\'s way');
});

test('a build with --install creates the database with the apps, keeps the site local and sets the administrator', () => {
  const p = project('drupal11');
  fs.rmSync(p.dir, { recursive: true });
  const log = path.join(p.root, 'ddev.log');
  const stubs = 'trim_project_name() { :; } ; drop_database() { :; } ; ddev_up() { ddev "$@" ; } ; ddev_nodejs_version() { echo 24 ; } ; ';
  const r = bash(`${stubs} PROJECT_NAME=site1 ; site_version=17.0 ; VERSION=17.0 ; INSTALL=yes ; ADD_USERS=yes ; APPS=contacts,crm ; odoo_build`,
    { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', DDEV_LOG: log, ...ACCOUNT });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const ran = fs.readFileSync(log, 'utf8');
  assert.match(ran, /^ddev config --project-type=generic --webserver-type=generic --docroot= --project-name=site1 --database=postgres:16 --nodejs-version=24$/m);
  assert.match(ran, /^ddev exec -s odoo odoo --db_host=db --db_user=db --db_password=db -d db --no-http --log-level=warn --stop-after-init -i base,contacts,crm$/m, 'with demo data unless asked otherwise');
  const [call] = payloads(log);
  assert.strictEqual(call.verb, 'local,owner,add', 'the site is kept local first, then the administrator, then the accounts');
  assert.strictEqual(call.given.accounts.length, 5);
  assert.match(ran, /^docker restart ddev-site1-odoo$/m, 'Odoo starts again on the finished database');
  assert.ok(!r.stdout.includes(ACCOUNT.account_pass));
  assert.ok(fs.existsSync(path.join(p.dir, '.ddev', 'config.odoo.yaml')), 'the project is one the tools recognise');
});

test('the testing hook adds the step pack, the users registry and a first feature to an Odoo project, once', () => {
  const p = project('odoo');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_odoo ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1', DDEV_LOG: log, ...ACCOUNT });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/odoo-steps'], '^2.1.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.6', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/odoo-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /admin: \{ username: process\.env\.ODOO_ADMIN_USER \|\| 'administrator', password: process\.env\.ODOO_ADMIN_PASSWORD \|\| '[^']+' \},/);
  assert.match(cucumber, /portal: \{ username: process\.env\.ODOO_PORTAL_USER \|\| 'portal'/);
  assert.doesNotMatch(cucumber, /webmaster|quoted/, 'the workspace account is not in the registry');
  assert.match(cucumber, /launchUrl: process\.env\.LAUNCH_URL \|\| 'https:\/\/site1\.ddev\.site',/, 'the router serves Odoo, so the suite is told the address of the site');
  // Still a module node can load, with the registry where webship-js reads it.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; console.log(JSON.stringify([c.require, Object.keys(c.worldParameters.users)]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, handles] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(handles, ['admin', 'salesperson', 'accountant', 'employee', 'portal']);
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'site.feature')));
  assert.deepStrictEqual(payloads(log).map((c) => c.verb), ['add'], 'a site that has its database gets the default accounts');
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'Feature: mine\n');
  assert.strictEqual(run().status, 0);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'site.feature'), 'utf8'), 'Feature: mine\n');
});

test('the testing hook and the CLI tool leave a project of the folder\'s example builder, and of another platform, alone', () => {
  for (const type of ['odoo20', 'drupal11']) {
    const p = project(type);
    const r = bash(`cd ${p.dir} && testing_configure_odoo ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'site1' });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '');
    assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
    assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
    const tool = bash('PROJECT_NAME=site1 ; RUN="--version" ; INSTALL_APPS=_none_ ; trim_project_name() { :; } ; odoo_cli_tool', { WORKSPACE_ROOT: p.root, doc_name: 'dev' });
    assert.strictEqual(tool.status, 1);
    assert.match(tool.stdout, /is not an Odoo project of this plugin/);
  }
});

test('the first feature names no platform in a step, and no password', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'site.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /odoo/i, s);
  assert.doesNotMatch(feature, /password "/);
  assert.doesNotMatch(feature, /sign ?up|I register|create a new record/i, 'a suite never creates an account');
  assert.doesNotMatch(feature, /"webmaster"/, 'the administrator is the workspace account: no scenario logs in as it');
});
