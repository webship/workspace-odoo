/**
 * What this plugin needs from the workspace it is added to and from the machine (the manifest's `needs` and `suggests`).
 * The workspace reads them: github.com/webship/workspace, core/workspace-app/PLUGINS.md.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

// Compiled, this test runs from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).workspacePlugin;

test("the manifest says what the plugin needs: the plugins and the commands it cannot work without, and what a part of it uses", () => {
  assert.deepStrictEqual(manifest.needs, [['dev', 'test', 'sandboxes', 'demos'], 'ai-agents']);
  assert.deepStrictEqual(manifest.suggests, undefined);
  assert.deepStrictEqual(manifest.needs[0], manifest.commands.workspaces, 'the alternatives are the folders the commands go to');
  assert.ok(manifest.ai.agents.length > 0, 'it ships agents, which is why it needs the folder they are placed in');
  assert.match(fs.readFileSync(path.join(PKG, 'README.md'), 'utf8'), /^## What it needs$/m, 'and the README says so');
});
