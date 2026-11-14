# The accounts of an Odoo site, and what keeps it local. Runs inside `odoo shell` in the Odoo
# container of the project (the shell provides `env` and `odoo`); the functions of the plugin
# (fun-odoo.sh) pipe it there and hand it what it needs in two variables:
#
#   ODOO_ACCOUNTS_VERB  one or more of local, owner, add, cancel, list, apps, with commas, run in
#                       that order
#   ODOO_ACCOUNTS       base64 of a JSON object:
#                       { owner: { name, email, password },
#                         accounts: [{ name, email, password, role }] }
#
#   local   The site stays local. The "partner_autocomplete" module, which Odoo installs on its
#           own, sends what a user types in a company name to an outside service and mixes the
#           answers into the proposals of the field. A local site must not depend on, or send
#           data to, an outside service, so the module is uninstalled.
#   owner   The administrator Odoo created (admin / admin) becomes the workspace account.
#   add     The default accounts, each with the groups of its role. One that exists (the demo
#           data has a portal user) gets its groups and its password again and keeps its name.
#   cancel  The default accounts are deleted; one that is part of the data of the site (the demo
#           portal user), or that Odoo will not delete because records point at it, is archived.
#   list    Who is there.   apps   The applications that are installed.
#
# Every verb can run again. No password is ever printed.

import base64
import json
import os

from odoo import SUPERUSER_ID, api

GIVEN = json.loads(base64.b64decode(os.environ.get('ODOO_ACCOUNTS') or 'e30=').decode('utf-8'))
VERBS = [verb for verb in os.environ.get('ODOO_ACCOUNTS_VERB', '').split(',') if verb]

# The groups of each role, by external id. A group of an app that is not installed is left out.
ROLES = {
    # Every app that is installed, and the settings.
    'administrator': ['base.group_user', 'base.group_system', 'base.group_partner_manager', 'sales_team.group_sale_manager',
                      'account.group_account_manager', 'website.group_website_designer', 'event.group_event_manager',
                      'hr_recruitment.group_hr_recruitment_manager'],
    # Sales and CRM, own documents only; no Invoicing.
    'salesperson': ['base.group_user', 'sales_team.group_sale_salesman'],
    # Invoicing; no Sales, no CRM.
    'accountant': ['base.group_user', 'account.group_account_invoice'],
    # An internal user with no app-specific group.
    'employee': ['base.group_user'],
    # A portal user: the website and /my, never the web client.
    'portal': ['base.group_portal'],
}

for verb in VERBS:
    Users = env['res.users'].with_context(no_reset_password=True, active_test=False)
    # The field that holds the groups of a user was renamed in a later release.
    groups_field = 'groups_id' if 'groups_id' in Users._fields else 'group_ids'

    if verb == 'local':
        autocomplete = env['ir.module.module'].search([('name', '=', 'partner_autocomplete'), ('state', '=', 'installed')])
        if autocomplete:
            autocomplete.button_immediate_uninstall()
            print('   partner_autocomplete is uninstalled: nothing a user types is sent to an outside service.')
            # The uninstall reloads the registry: take a fresh environment.
            env = api.Environment(odoo.registry(env.cr.dbname).cursor(), SUPERUSER_ID, {})

    elif verb == 'owner':
        owner = GIVEN.get('owner') or {}
        admin = env.ref('base.user_admin')
        admin.write({'login': owner['name'], 'password': owner['password'], 'email': owner['email']})
        env.cr.commit()
        print('   the administrator of the site is %s.' % admin.login)

    elif verb == 'add':
        for person in GIVEN.get('accounts') or []:
            wanted, missing = [], []
            for xmlid in ROLES.get(person['role'], []):
                group = env.ref(xmlid, raise_if_not_found=False)
                (wanted if group else missing).append(group.id if group else xmlid)
            if person['role'] not in ROLES:
                print('   %s: "%s" is not a role this knows (%s).' % (person['name'], person['role'], ', '.join(sorted(ROLES))))
                continue
            values = {'password': person['password'], groups_field: [(6, 0, wanted)], 'active': True}
            user = Users.search([('login', '=', person['name'])], limit=1)
            if user:
                user.write(values)
                state = 'was there: its groups and its password are set again'
            else:
                user = Users.create(dict(values, name=person['name'], login=person['name'], email=person['email']))
                state = 'added'
            env.cr.commit()
            print('   %s %s (%s)%s.' % (person['name'], state, person['role'],
                                        ', without %s (not installed)' % ', '.join(missing) if missing else ''))

    elif verb == 'cancel':
        for person in GIVEN.get('accounts') or []:
            user = Users.search([('login', '=', person['name'])], limit=1)
            if not user:
                print('   %s is not there.' % person['name'])
                continue
            # An account the data of a module defines (the demo data has a portal user) is part of
            # the site: deleting it breaks the next update of that module, so it is archived.
            if env['ir.model.data'].search_count([('model', '=', 'res.users'), ('res_id', '=', user.id)]):
                user.write({'active': False})
                print('   %s is part of the data of the site, so it is archived instead of deleted.' % person['name'])
                env.cr.commit()
                continue
            try:
                with env.cr.savepoint():
                    user.unlink()
                print('   %s deleted.' % person['name'])
            except Exception:
                # Records of the site point at the account: Odoo keeps it, so it is archived.
                user.write({'active': False})
                print('   %s has records the site keeps, so it is archived instead of deleted.' % person['name'])
            env.cr.commit()

    elif verb == 'list':
        system = env.ref('base.group_system')
        for user in Users.search([('share', 'in', [True, False])], order='share, login'):
            if user.id == SUPERUSER_ID:
                continue
            kind = 'portal' if user.share else ('administrator' if system in user[groups_field] else 'internal')
            print('   %-24s %-30s %-14s%s' % (user.login, user.email or '', kind, '' if user.active else ' (archived)'))

    elif verb == 'apps':
        for module in env['ir.module.module'].search([('state', '=', 'installed'), ('application', '=', True)], order='name'):
            print('   %-28s %s' % (module.name, module.shortdesc))

    else:
        print('odoo-accounts.py: ODOO_ACCOUNTS_VERB is local, owner, add, cancel, list or apps, with commas.')

env.cr.commit()
env.cr.close()
