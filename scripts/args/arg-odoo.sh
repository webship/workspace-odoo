#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, its DDEV project and its host name.')
parser.add_argument('-v', '--version',
                    default="${site_version}",
                    help='The Odoo Community release to run, as its container image is tagged. The apps, the accounts and the tests of this builder are proven on the default. [default %(default)s]')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Create the database with the apps, with the workspace account as the administrator.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install, add the default accounts: the ones the test scenarios log in as.')
parser.add_argument('--apps',
                    default="contacts,crm,sale_management,account,website,website_blog,website_sale,website_event,website_hr_recruitment",
                    help='The apps --install installs, by their technical names, with commas. Example: --apps contacts,website [default %(default)s]')
parser.add_argument('--without-demo',
                    action='store_true',
                    default=False,
                    help='With --install, leave the demo data of Odoo out.')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the site in a browser when it is ready.')
ARGEOF
