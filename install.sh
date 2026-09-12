#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Installs the hellomail skin and its companion plugin into a Roundcube
# installation. Run it from the directory you cloned this repository into.
#
#   sudo ./install.sh                      install, autodetecting Roundcube
#   sudo ./install.sh --dir /path/to/rc    install into a specific directory
#   sudo ./install.sh --uninstall          remove both again
#   ./install.sh --dry-run                 print what would happen
#
# It copies skins/hellomail and plugins/hellomail, creates the per-directory
# symlinks the Debian and Ubuntu packages need, matches the ownership of the
# existing Elastic skin, and prints the two config lines to add. It never
# edits your configuration file.

set -eu

SKIN=hellomail
PLUGIN=hellomail
RC_DIR=
DRY=0
UNINSTALL=0

say()  { printf '%s\n' "$*"; }
err()  { printf 'error: %s\n' "$*" >&2; exit 1; }
run()  { if [ "$DRY" = 1 ]; then printf '  would run: %s\n' "$*"; else "$@"; fi; }

usage() {
    sed -n '3,17p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dir) RC_DIR="${2:-}"; [ -n "$RC_DIR" ] || err "--dir needs a path"; shift 2 ;;
        --dry-run) DRY=1; shift ;;
        --uninstall) UNINSTALL=1; shift ;;
        -h|--help) usage 0 ;;
        *) say "unknown option: $1"; usage 1 ;;
    esac
done

# ---------------------------------------------------------------- source dir
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

[ -f "$HERE/$SKIN/meta.json" ]    || err "run this from the repository, $HERE/$SKIN/meta.json is missing"
[ -d "$HERE/plugins/$PLUGIN" ]    || err "run this from the repository, $HERE/plugins/$PLUGIN is missing"

# ------------------------------------------------------------ roundcube dir
if [ -z "$RC_DIR" ]; then
    for candidate in /usr/share/roundcube /usr/share/roundcubemail \
                     /var/www/roundcube /var/www/roundcubemail \
                     /var/www/html/roundcube /var/www/html/roundcubemail \
                     /opt/roundcube /srv/roundcube
    do
        if [ -d "$candidate/skins/elastic" ]; then RC_DIR="$candidate"; break; fi
    done
fi

[ -n "$RC_DIR" ] || err "could not find Roundcube; pass --dir /path/to/roundcube"
[ -d "$RC_DIR/skins/elastic" ] || err "$RC_DIR does not look like Roundcube: skins/elastic is missing"

VERSION=$(sed -n "s/.*RCMAIL_VERSION', *'\([^']*\)'.*/\1/p" "$RC_DIR/program/include/iniset.php" 2>/dev/null || true)
say "Roundcube: $RC_DIR${VERSION:+ (version $VERSION)}"

case "$VERSION" in
    1.6.*|'') : ;;
    *) say "warning: this skin is built for Roundcube 1.6.x, found $VERSION" ;;
esac

# Debian and Ubuntu packages publish skins and plugins through per-directory
# symlinks under a separate web root; without them the web server answers 404.
WEB_DIR=
for candidate in /var/lib/roundcube /var/lib/roundcubemail; do
    if [ -d "$candidate/skins" ] && [ -L "$candidate/skins/elastic" ]; then WEB_DIR="$candidate"; break; fi
done

SKIN_DEST="$RC_DIR/skins/$SKIN"
PLUGIN_DEST="$RC_DIR/plugins/$PLUGIN"

# -------------------------------------------------------------------- remove
if [ "$UNINSTALL" = 1 ]; then
    say "Removing $SKIN..."
    for path in "$SKIN_DEST" "$PLUGIN_DEST"; do
        [ -e "$path" ] && run rm -rf "$path"
    done
    if [ -n "$WEB_DIR" ]; then
        for link in "$WEB_DIR/skins/$SKIN" "$WEB_DIR/plugins/$PLUGIN"; do
            [ -L "$link" ] && run rm -f "$link"
        done
    fi
    say ""
    say "Done. Remove these from your Roundcube config if they are still there:"
    say "    \$config['skin'] = '$SKIN';"
    say "    '$PLUGIN' in \$config['plugins']"
    exit 0
fi

# ------------------------------------------------------------------- install
if [ "$DRY" != 1 ] && [ ! -w "$RC_DIR/skins" ]; then
    err "no write access to $RC_DIR/skins; run this with sudo"
fi

# refuse to overwrite something that is not ours
for path in "$SKIN_DEST" "$PLUGIN_DEST"; do
    if [ -e "$path" ] && [ ! -e "$path/meta.json" ] && [ ! -e "$path/$PLUGIN.php" ]; then
        err "$path exists and does not look like a previous hellomail install; move it aside first"
    fi
done

say "Installing the skin into $SKIN_DEST"
run rm -rf "$SKIN_DEST"
run cp -a "$HERE/$SKIN" "$SKIN_DEST"

say "Installing the plugin into $PLUGIN_DEST"
run rm -rf "$PLUGIN_DEST"
run cp -a "$HERE/plugins/$PLUGIN" "$PLUGIN_DEST"

# match whatever owns the stock skin, usually root:root
OWNER=$(stat -c '%u:%g' "$RC_DIR/skins/elastic" 2>/dev/null || echo '')
if [ -n "$OWNER" ]; then
    run chown -R "$OWNER" "$SKIN_DEST" "$PLUGIN_DEST"
fi
run chmod -R a+rX "$SKIN_DEST" "$PLUGIN_DEST"

if [ -n "$WEB_DIR" ]; then
    say "Package layout detected, linking into $WEB_DIR"
    [ -e "$WEB_DIR/skins/$SKIN" ]     || run ln -s "$SKIN_DEST" "$WEB_DIR/skins/$SKIN"
    if [ -d "$WEB_DIR/plugins" ]; then
        [ -e "$WEB_DIR/plugins/$PLUGIN" ] || run ln -s "$PLUGIN_DEST" "$WEB_DIR/plugins/$PLUGIN"
    fi
fi

CONFIG_HINT=$RC_DIR/config/config.inc.php
[ -f /etc/roundcube/config.inc.php ] && CONFIG_HINT=/etc/roundcube/config.inc.php

say ""
say "Installed. Add these two lines to $CONFIG_HINT:"
say ""
say "    \$config['skin'] = '$SKIN';"
say "    \$config['plugins'][] = '$PLUGIN';"
say ""
say "Then log out and back in. If your account already had another skin saved"
say "in Settings > Preferences > User Interface, pick Hello Mail there once."
