/**
 * Odoo Community for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the
 * odoo-bin tool in the sites folders, their functions, argparse and the accounts script under
 * core/scripts/plugins/odoo/, the agents in the AI Agents folder. The dashboard needs nothing
 * drawn for it: the builder is in the Build list because it is a cmd-*-project.sh, the row menus
 * are the core's, the agents are listed like any other. What register() adds is what the
 * assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the
 * dashboard's own files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/** The plugin's name, which its functions are named after. */
export const PLATFORM = 'odoo';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-odoo-project.sh', 'cmd-tools-odoo-cli.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['odoo-site-builder', 'odoo-tester'];

/** What the assistant is told about Odoo in this workspace. */
export function assistantContext(): string {
  return [
    'Odoo Community (a plugin, @webship.co/workspace-odoo): an Odoo site is built with',
    '`bash cmd-odoo-project.sh <name> --install --add-users` from a sites folder (dev, test, sandboxes, demos),',
    'in containers like every other project, at https://<name>.ddev.site (the login at /web/login).',
    '`bash cmd-tools-odoo-cli.sh <name>` says what the site is; `--run "<odoo-bin arguments>"` runs odoo-bin on its database,',
    '`--install-apps <a,b>` installs apps, `--update` updates the installed modules, `--restart` starts Odoo again,',
    '`--add-users` adds the default accounts (one per kind of user).',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the Odoo step pack; `--run` runs the suite.',
    `For Odoo work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    'Community only: never the Enterprise edition, never a vendor account. Never run odoo, python or psql on the host for a project.',
    'The example builder cmd-odoo20-project.sh of a sites folder is a different, simpler build; this plugin leaves it as it is.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
