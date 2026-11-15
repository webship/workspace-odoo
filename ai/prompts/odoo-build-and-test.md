Build an Odoo Community site in a sites folder and prove it with its first webship-js feature.

`claude` is the default launcher; the text between the triple quotes is plain and can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Build an Odoo Community site named <name> in this sites folder and test it with webship-js
# ~/workspace/<dev|test|sandboxes|demos> · https://<name>.ddev.site · the login at /web/login · container-based (DDEV by default)
# the builder deletes a project of the same name first: stop if <name> is a site somebody still needs
# nothing on the host: no odoo-bin, python, psql or npm outside the site's container
# the Community edition only: no other edition, no trial, no licence, no vendor account

1. bash cmd-odoo-project.sh <name> --install --add-users
   (the default apps with demo data; add --apps <a,b> for another list of apps, --without-demo to leave the demo data out)
2. bash cmd-tools-odoo-cli.sh <name>
   tell me the version, the address, the apps and the accounts it lists
3. bash cmd-tools-testing.sh <name>
   webship-js, the step pack, the users registry and tests/features/site.feature
4. bash cmd-tools-testing.sh <name> --dry-run --path tests/features/site.feature
5. bash cmd-tools-testing.sh <name> --run --path tests/features/site.feature
   the first feature expects the default apps: with another list of apps, tell me which scenarios do not apply instead of changing them

If a command fails, show the line that failed and stop. Do not retry with other flags.
When the feature is green: the address, the version, how many scenarios and steps passed.
Then ask me whether to keep the site or remove it with: bash cmd-tools-remove.sh <name>
"""
```
