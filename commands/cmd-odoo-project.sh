#!/usr/bin/env bash

# workspace-name: Odoo 17 Community (apps, accounts, tests)

# Installed by the Odoo plugin (plugins.sh --install odoo); __WORKSPACE__ is the workspace it was installed into.
#
# Build an Odoo Community site in a container: Odoo 17.0, or the release --version names, on
# PostgreSQL, at https://<name>.ddev.site. With --install the database is created with the apps
# and Odoo's demo data, and the workspace account is its administrator; with --add-users it also
# gets the default accounts. Community only: no Enterprise, no vendor account.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Set site version.
site_version="17.0";

# Distribution.
distribution_name="odoo";
distribution_title="Odoo Community";
distribution_webroot="";

ARGPARSE_DESCRIPTION="Build an ${distribution_title} project in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/odoo/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/odoo/args/arg-odoo.sh || exit 1 ;

shift $#;

odoo_build ;
