#!/usr/bin/env bash

# Odoo Community for the Webship Workspace: build a site, run odoo-bin on it, add its default
# accounts, and wire its step pack into the testing setup.
#
# Placed by `plugins.sh --install odoo` in core/scripts/plugins/odoo/functions/, where bootstrap
# sources it after the core's own functions. Everything runs in the project's containers (DDEV by
# default), never on the host: Odoo is the official Community image as a service of the project,
# the router serves its port at the project's address (Odoo runs with --proxy-mode and a
# --db-filter for its one database), and PostgreSQL is the container tool's own database, so the
# database commands and the backups work as for any other project. Community only: no Enterprise
# edition, no vendor account, and the module that talks to an outside service is uninstalled.
#
# The core carries an example Odoo builder of its own (functions/fun-odoo.sh: build_odoo,
# odoo_cli, odoo_write_compose, odoo_write_nginx, behind cmd-odoo20-project.sh). This file defines
# none of those names, so the example keeps working with the plugin installed.
#
# DDEV has no project type for Odoo, so an Odoo project of this plugin is recognised by a file
# (.ddev/config.odoo.yaml, written by the builder), and four names are the ones the core's tools
# look for:
#   set_odoo_users          the default accounts                (cmd-tools-add-users.sh <project> odoo)
#   add_odoo_users          create them in the Odoo shell       (the same tool, and --add-users of the builder)
#   cancel_odoo_users       delete or archive them              (cmd-tools-cancel-users.sh <project> odoo)
#   testing_configure_odoo  the step pack in the testing stack  (cmd-tools-testing.sh <project>)

# The step pack an Odoo project is tested with, and the release line it is required at.
readonly ODOO_STEPS_PACKAGE='@webship-js/odoo-steps';
readonly ODOO_STEPS_VERSION='^2.1.0';

# The one database of a project (the container tool's own), and the port Odoo listens on.
readonly ODOO_DATABASE='db';
readonly ODOO_PORT='8069';

# The default accounts, the ones a scenario logs in as: one per kind of user. Accounts are
# configuration, created once on the site; a test suite never creates or deletes one. The
# administrator Odoo creates is the workspace account and is not in this list.
function set_odoo_users() {
  users=(administrator salesperson accountant employee portal);
  local user ;
  for user in "${users[@]}" ; do
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
    printf -v "user_${user}_role" '%s' "${user}" ;
  done
}

# Is this folder an Odoo project of this plugin? The builder leaves .ddev/config.odoo.yaml in it.
function odoo_is_project() {
  local project_path="$1";
  [ -f "${project_path}/.ddev/config.odoo.yaml" ] ;
}

# Go to the project a tool was asked about, or say why not.
function odoo_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! odoo_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not an Odoo project of this plugin (it has no .ddev/config.odoo.yaml)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# What the container tool is told about Odoo: the official Community image as a service of the
# project, on the project's database, with the router serving its port at the project's address.
function odoo_site_write_ddev_config() {
  local project_path="$1" version="$2";
  mkdir -p "${project_path}/.ddev" "${project_path}/addons" || return 1 ;
  cat > "${project_path}/.ddev/config.odoo.yaml" <<YAMLEOF
# Odoo Community in this project. Written by the Odoo builder of the workspace; build again rather
# than editing by hand. The release is the tag of the image in docker-compose.odoo.yaml.
web_environment:
  - ODOO_VERSION=${version}
YAMLEOF
  cat > "${project_path}/.ddev/docker-compose.odoo.yaml" <<COMPOSEEOF
## Odoo Community, as a service of this project. Written by the Odoo builder of the workspace;
## build again rather than editing by hand. Custom modules go in the project's addons/ folder.
volumes:
  odoo_data:

services:
  odoo:
    container_name: ddev-\${DDEV_SITENAME}-odoo
    image: "odoo:${version}"
    restart: "no"
    labels:
      com.ddev.site-name: \${DDEV_SITENAME}
      com.ddev.approot: \${DDEV_APPROOT}
    depends_on:
      - db
    environment:
      # The image's entrypoint turns these three into the database options: the container tool's
      # own database.
      - HOST=db
      - USER=db
      - PASSWORD=db
      # The router serves Odoo's port at the project's address.
      - VIRTUAL_HOST=\$DDEV_HOSTNAME
      - HTTP_EXPOSE=80:${ODOO_PORT}
      - HTTPS_EXPOSE=443:${ODOO_PORT}
    expose:
      - "${ODOO_PORT}"
    # --proxy-mode: Odoo sits behind the router and reads the scheme and the host from the
    #   forwarded headers, so its links are https.
    # --db-filter: one database only, so a visitor is never sent to the database selector.
    # No --workers: in its default threaded mode Odoo serves the pages and the websocket of the
    #   bus on the same port, which is the one the router exposes.
    command: odoo --proxy-mode --db-filter=^${ODOO_DATABASE}\$\$ --database=${ODOO_DATABASE} --max-cron-threads=1
    volumes:
      - odoo_data:/var/lib/odoo
      - ../addons:/mnt/extra-addons
COMPOSEEOF
}

# odoo-bin in the Odoo container, on the database of the project, without the web server.
function odoo_bin() {
  ddev exec -s odoo odoo --db_host=db --db_user=db --db_password=db -d "${ODOO_DATABASE}" --no-http "$@" ;
}

# The release of Odoo the project runs.
function odoo_version() {
  ddev exec -s odoo odoo --version 2>/dev/null | tr -d '\r' | sed 's/^Odoo Server //' ;
}

# Has the database been created with Odoo's base module?
function odoo_is_installed() {
  [ "$(ddev exec -s db "psql -U db -d ${ODOO_DATABASE} -tAc \"select state from ir_module_module where name = 'base'\"" 2>/dev/null | tr -d '\r[:space:]')" == 'installed' ] ;
}

# Wait until Odoo answers on its own port.
function odoo_site_wait() {
  local attempt code ;
  for attempt in $(seq 1 90) ; do
    code="$(ddev exec "curl -s -o /dev/null -w '%{http_code}' http://odoo:${ODOO_PORT}/web/login" 2>/dev/null | tr -d '\r')" ;
    case "${code}" in
      200|303) return 0 ;;
    esac
    sleep 2 ;
  done
  echo "Odoo did not answer; the end of its log:" ;
  ddev logs -s odoo 2>/dev/null | tail -n 40 ;
  return 1 ;
}

# Start Odoo again, and wait for it. The running server loaded its code before the last change
# to the modules, so it starts again on the database as it is now.
function odoo_site_restart() {
  docker restart "ddev-${PROJECT_NAME}-odoo" > /dev/null || return 1 ;
  odoo_site_wait ;
}

# Run verbs of odoo-accounts.py (local, owner, add, cancel, list, apps; with commas) in the Odoo
# shell of the project. The script is piped to the shell, and what it needs travels as base64 of
# a JSON object, so no password is written into a file of the project and no quoting can break a
# value.
function odoo_accounts() {
  local verbs="$1" script="${WORKSPACE_SCRIPTS}/plugins/odoo/odoo-accounts.py" rows="" user name mail password role payload ;
  if [ ! -f "${script}" ] ; then
    echo "odoo-accounts.py is not in ${WORKSPACE_SCRIPTS}/plugins/odoo: install the plugin (plugins.sh --install odoo)." ;
    return 1 ;
  fi
  for user in "${users[@]}" ; do
    name="user_${user}_name"; mail="user_${user}_mail"; password="user_${user}_password"; role="user_${user}_role";
    rows="${rows}${!name}"$'\x1f'"${!mail}"$'\x1f'"${!password}"$'\x1f'"${!role}"$'\x1e' ;
  done
  payload="$(ODOO_OWNER_NAME="${account_name}" ODOO_OWNER_MAIL="${account_mail}" ODOO_OWNER_PASS="${account_pass}" \
    ODOO_ROWS="${rows}" python3 -c '
import base64, json, os
accounts = [dict(zip(("name", "email", "password", "role"), row.split("\x1f"))) for row in os.environ["ODOO_ROWS"].split("\x1e") if row]
print(base64.b64encode(json.dumps({
    "owner": {"name": os.environ["ODOO_OWNER_NAME"], "email": os.environ["ODOO_OWNER_MAIL"], "password": os.environ["ODOO_OWNER_PASS"]},
    "accounts": accounts,
}).encode()).decode())')" || return 1 ;
  ddev exec -s odoo "ODOO_ACCOUNTS=${payload} ODOO_ACCOUNTS_VERB=${verbs} odoo shell --db_host=db --db_user=db --db_password=db -d ${ODOO_DATABASE} --no-http --log-level=warn" < "${script}" ;
}

# Build an Odoo Community site from nothing: the containers, and with --install the database with
# its apps and its administrator.
function odoo_build() {
  trim_project_name ;
  local base_url="https://${PROJECT_NAME}.ddev.site" ;
  local version="${VERSION:-${site_version:-17.0}}" ;
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}" ;
  local apps="${APPS:-contacts}" ;

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;

  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}" ;
  cd "${project_path}" || exit 1 ;

  # A generic web server: the web container serves nothing, the router goes to Odoo. The database
  # is the container tool's PostgreSQL, and the project keeps the Node.js of the workspace for its
  # tests.
  ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name=${PROJECT_NAME} \
    --database=postgres:16 --nodejs-version=$(ddev_nodejs_version) || exit 1 ;
  odoo_site_write_ddev_config "${project_path}" "${version}" || exit 1 ;

  echo "Starting Odoo ${version} Community. The first run pulls the image, which takes a few minutes." ;
  ddev_up start -y || exit 1 ;

  if [ "${INSTALL}" == 'yes' ] ; then
    local demo="" ;
    [ "${WITHOUT_DEMO}" == 'yes' ] && demo="--without-demo=all" ;
    echo "Creating the ${ODOO_DATABASE} database with the apps${demo:+ (without demo data)}: ${apps}" ;
    odoo_bin --log-level=warn --stop-after-init -i "base,${apps}" ${demo} || { echo "The Odoo install failed." ; exit 1 ; } ;

    # Keep the site local, and give it the workspace account as its administrator.
    users=() ;
    local verbs="local,owner" ;
    if [ "${ADD_USERS}" == 'yes' ] ; then
      set_odoo_users ;
      verbs="local,owner,add" ;
    fi
    odoo_accounts "${verbs}" || { echo "The accounts of the site could not be set." ; exit 1 ; } ;
    odoo_site_restart || exit 1 ;

    echo "${doc_name} ${PROJECT_NAME} has been installed: Odoo $(odoo_version) Community.";
    echo "Go to ${base_url}/web/login and log in as ${account_name}";
  else
    [ "${ADD_USERS}" == 'yes' ] && echo "--add-users needs --install: there is no database to add accounts to yet." ;
    echo "${doc_name} ${PROJECT_NAME} is running with an empty database: Odoo $(odoo_version) Community.";
    echo "Create the database with: bash cmd-tools-odoo-cli.sh ${PROJECT_NAME} --install-apps contacts   (or build with --install)";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    # The address is given: the router serves Odoo, so the web container has none of its own.
    ddev launch "${base_url}/web/login" ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Create the default accounts in the Odoo shell, each with the groups of its role. One that is
# already there gets its groups and its password again. The list is loaded by the caller
# (set_odoo_users): the core's add_users, the builder, the CLI tool.
function add_odoo_users() {
  odoo_enter_project || return 1 ;
  local user user_name user_mail user_password user_role ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role";

    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "      User role: ${!user_role}";
    echo " ================================================================= ";
  done
  odoo_accounts add ;
  local status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# Delete the default accounts. One that Odoo will not delete is archived instead.
function cancel_odoo_users() {
  odoo_enter_project || return 1 ;
  local user user_name ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name";
    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo " ================================================================= ";
  done
  odoo_accounts cancel ;
  local status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# What cmd-tools-odoo-cli.sh does: the first of --run, --install-apps, --update, --restart,
# --add-users, --cancel-users that was asked for; with none of them, what the site is.
function odoo_cli_tool() {
  trim_project_name ;
  odoo_enter_project || exit 1 ;

  if ! ddev describe -j 2>/dev/null | grep -q '"status":"running"' ; then
    ddev start -y || exit 1 ;
  fi

  if [ ! "${RUN}" == '_none_' ] ; then
    # Unquoted on purpose: --run "-u sale --stop-after-init" is a list of arguments.
    odoo_bin ${RUN} ;
    exit $? ;
  fi

  if [ ! "${INSTALL_APPS}" == '_none_' ] ; then
    local created='no' ;
    odoo_is_installed || created='yes' ;
    odoo_bin --log-level=warn --stop-after-init -i "${INSTALL_APPS}" || exit 1 ;
    users=() ;
    if [ "${created}" == 'yes' ] ; then
      # The database was empty: this created it, so it gets its administrator too.
      odoo_accounts local,owner || exit 1 ;
    else
      odoo_accounts local || exit 1 ;
    fi
    odoo_site_restart || exit 1 ;
  elif [ "${UPDATE}" == 'yes' ] ; then
    odoo_bin --log-level=warn --stop-after-init -u all || exit 1 ;
    odoo_site_restart || exit 1 ;
    echo "Odoo $(odoo_version): every installed module is updated." ;
  elif [ "${RESTART}" == 'yes' ] ; then
    odoo_site_restart || exit 1 ;
    echo "Odoo $(odoo_version) is running." ;
  elif [ "${ADD_USERS}" == 'yes' ] ; then
    set_odoo_users ;
    add_odoo_users ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_odoo_users ;
    cancel_odoo_users ;
  else
    echo "${doc_name}/${PROJECT_NAME}: Odoo $(odoo_version) Community at https://${PROJECT_NAME}.ddev.site" ;
    if odoo_is_installed ; then
      users=() ;
      echo "" ; echo "Apps:" ; odoo_accounts apps ;
      echo "" ; echo "Accounts:" ; odoo_accounts list ;
    else
      echo "   The database is empty: create it with --install-apps <apps>, or build with --install." ;
    fi
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of an Odoo project. The core's testing_configure calls this
# in the project folder once webship-js is scaffolded and before the dependencies are installed;
# for a project that is not this plugin's it changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's
# own, gives cucumber.js the users registry of the default accounts (a handle a scenario reads,
# mapped to an account; never the workspace account) and the address of the site, and writes a
# first feature when the project has none of its own. Every part is skipped when it is already there, so a second run adds what
# the first missed and never resets a suite.
function testing_configure_odoo() {
  local project_path="$1";
  odoo_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  Odoo: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi

  echo "Adding the Odoo step pack (${ODOO_STEPS_PACKAGE} ${ODOO_STEPS_VERSION}).";
  set_odoo_users ;
  local registry="" user user_name user_password handle ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_password="user_${user}_password";
    # The pack's features call the administrator "admin".
    handle="${user}" ; [ "${user}" == 'administrator' ] && handle="admin" ;
    registry="${registry}${handle}|${!user_name}|${!user_password}"$'\n' ;
  done

  # The address of the site. The router serves Odoo, not the web container, so the container tool
  # has no address to hand the web container (LAUNCH_URL is empty there): the suite gets it here.
  local site_name ;
  site_name="$(sed -n 's/^name:[[:space:]]*"\{0,1\}\([A-Za-z0-9._-]*\)"\{0,1\}[[:space:]]*$/\1/p' "${project_path}/.ddev/config.yaml" | head -n 1)" ;

  python3 - "${project_path}" "${ODOO_STEPS_PACKAGE}" "${ODOO_STEPS_VERSION}" 'ODOO' "${registry}" "https://${site_name:-${PROJECT_NAME}}.ddev.site" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry, address = sys.argv[1:7]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

# cucumber.js: the pack's step definitions after webship-js's own, and the users registry.
cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

if not re.search(r"^[ \t]*users:[ \t]*\{", src, re.M):
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
    if not world:
        sys.exit("  cucumber.js has no worldParameters block to add the users registry to.")
    pad = world.group(1) + '  '
    rows = [r.split('|') for r in registry.splitlines() if r.strip()]
    block = [
        pad + "// The users registry: a handle a scenario reads, mapped to an account of this site (the default",
        pad + "// accounts: cmd-tools-add-users.sh). Override one with %s_<HANDLE>_USER and %s_<HANDLE>_PASSWORD." % (prefix, prefix),
        pad + "users: {",
    ]
    for handle, name, password in rows:
        env = '%s_%s' % (prefix, handle.upper())
        block.append(pad + "  %s: { username: process.env.%s_USER || '%s', password: process.env.%s_PASSWORD || '%s' }," % (handle, env, name, env, password))
    block.append(pad + "},")
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: the users registry (%s)' % ', '.join(r[0] for r in rows))

# The address the suite opens when LAUNCH_URL is not set, which it is not in this project: the
# placeholder of the scaffold becomes the address of the site. An address somebody set stays.
placeholder = "process.env.LAUNCH_URL || 'http://localhost:8080'"
if placeholder in src:
    src = src.replace(placeholder, "process.env.LAUNCH_URL || '%s'" % address)
    print('  cucumber.js: the address of the site (%s)' % address)

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature, when the project has none for the site yet: the front page, the login page,
  # each default account in its role.
  local feature="${WORKSPACE_SCRIPTS}/plugins/odoo/site.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/site.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/site.feature" \
      && echo "  tests/features/site.feature: a first feature for the site" ;
  fi

  # The scenarios log in as the default accounts: make sure a site that has its database has them.
  if odoo_is_installed ; then
    ( add_odoo_users > /dev/null ) && echo "  the default accounts are on the site (${users[*]})" ;
  fi
}
