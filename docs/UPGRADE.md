# Re-checking the skin after a Roundcube upgrade

The skin extends Elastic, so most of Elastic's changes flow through
automatically. Three things do not, and need a look after every
`roundcube-core` package upgrade.

## 1. Find out which Elastic version is now installed

```sh
dpkg -l roundcube-core | tail -1
grep -m1 "RCMAIL_VERSION" /usr/share/roundcube/program/include/iniset.php
```

## 2. Diff the overridden templates

`OVERRIDES.md` lists every template copied from Elastic together with the
version it was copied from. Compare that version's Elastic with the new one:

```sh
make elastic-diff FROM=1.6.6 TO=<new version>
```

For every file that appears in the diff **and** in `OVERRIDES.md`, port the
upstream change into the override (or drop the override if it is no longer
needed). Then update the version noted in `OVERRIDES.md`.

`includes/layout.html` is a copy with one documented change, the themed
stylesheet link (see `OVERRIDES.md`). After an upgrade, overwrite it with the
new Elastic version and re-apply that block.

Overrides are kept small on purpose. When porting, prefer re-copying the new
upstream template and re-applying the documented change over hand-merging.

## 3. Rebuild the CSS against the new Elastic

The committed `styles.css` was compiled from the LESS of the version noted in
`OVERRIDES.md`. Rebuild it against the new Elastic:

```sh
make distclean
make build RC_VERSION=<new version>
```

Review the diff of `hellomail/styles/styles.css`. Then update `RC_VERSION` in
the `Makefile` and the baseline in `OVERRIDES.md`, and commit.

## 4. Check the web symlinks survived (Debian/Ubuntu packages)

The package publishes skins and plugins through per-directory symlinks in
`/var/lib/roundcube/skins/` and `/var/lib/roundcube/plugins/`. The skin's
links are not owned by the package, so an upgrade may remove or reset those
directories. Verify and recreate them:

```sh
ls -l /var/lib/roundcube/skins/ /var/lib/roundcube/plugins/ | grep hellomail
ln -s /usr/share/roundcube/skins/hellomail /var/lib/roundcube/skins/hellomail
ln -s /usr/share/roundcube/plugins/hellomail /var/lib/roundcube/plugins/hellomail
curl -sI https://mail.example.com/skins/hellomail/styles/styles.css | head -1
```

## 5. Smoke test on the server

After deploying with `rsync`, check in a browser:

- login page, light and dark mode (toggle via the OS colour scheme)
- folder list and message list, including selection and unread state
- reading a message, attachments, reply/forward opening compose
- compose on a wide screen and on a narrow window (responsive fallback)
- the plugin UIs: managesieve filters, archive and markasjunk buttons,
  zipdownload in message view, attachment_reminder on send,
  identity_select, newmail_notifier settings, hide_blockquote toggles,
  vcard_attachments chip in message view

If a change cannot be reproduced from the skin alone, Elastic's own
`devel_mode` (`$config['devel_mode'] = true;`) makes the browser compile
`styles.less` live, which speeds up locating the responsible rule.
