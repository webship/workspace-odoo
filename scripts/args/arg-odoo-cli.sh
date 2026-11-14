#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The Odoo project in this workspace.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='Arguments for odoo-bin, run on the database of the project without the web server. Example: --run "-u sale --stop-after-init". A single argument that starts with a dash is given with an equals sign: --run=--version')
parser.add_argument('-i', '--install-apps',
                    default="_none_",
                    help='Install apps by their technical names, with commas, then start Odoo again. Example: --install-apps project,hr')
parser.add_argument('-u', '--update',
                    action='store_true',
                    default=False,
                    help='Update every installed module (odoo-bin -u all), then start Odoo again.')
parser.add_argument('-s', '--restart',
                    action='store_true',
                    default=False,
                    help='Start Odoo again, and wait until it answers.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default accounts. One that is already there gets its groups and its password again.')
parser.add_argument('-c', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Delete the default accounts; one that is part of the data of the site, or that Odoo will not delete, is archived.')
ARGEOF
