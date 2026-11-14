#!/usr/bin/env bash

# Installed by the Odoo plugin (plugins.sh --install odoo); __WORKSPACE__ is the workspace it was installed into.
#
# odoo-bin for one Odoo project of this workspace, in its container: say what the site is, run
# an odoo-bin command, install apps, update the installed modules, restart Odoo, add or remove
# the default accounts. Nothing here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="odoo";

ARGPARSE_DESCRIPTION="Run odoo-bin on an Odoo project of __WORKSPACE__: status, a command, apps, an update, a restart, the default accounts"
# The args file comes with the plugin: core/scripts/plugins/odoo/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/odoo/args/arg-odoo-cli.sh || exit 1 ;

shift $#;

odoo_cli_tool ;
