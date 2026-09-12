# Overridden Elastic files

Every file in `hellomail/` that shadows a file of the same path in
`skins/elastic/` is listed here. After a Roundcube upgrade, diff each entry
against the new Elastic version (see `docs/UPGRADE.md`).

Elastic baseline: **Roundcube 1.6.6**.

## Templates

### `templates/includes/layout.html`

- Copied from: Elastic, Roundcube 1.6.6
- Why, part 1: asset resolution. When Roundcube processes
  `<roundcube:include>`, it sets the base skin path to the skin the included
  file was found in. With Elastic's own `layout.html`, the
  `/styles/styles.css` link inside it resolves to Elastic's CSS first and this
  skin's compiled stylesheet is never loaded. With the copy living here the
  base path is `skins/hellomail`, and everything else referenced in the
  file (`/deps/...`, `print.css`) still falls back to Elastic because this
  skin does not ship those files.
- Why, part 2: colour themes. The stylesheet link is wrapped in
  `<roundcube:if condition="env:hellomail_theme">` and links
  `/styles/styles-<theme>.css` when the companion plugin set a theme.
- Diff against upstream: the single
  `<link rel="stylesheet" href="/styles/styles.css">` line in the non-devel
  branch is replaced by the if/else block (5 lines). Everything else is
  verbatim. After an upgrade, re-copy the file and re-apply that block.

### `templates/includes/footer.html`

- Copied from: Elastic, Roundcube 1.6.6
- Why: Elastic offers no hook to load an extra script. This copy adds
  `<script src="/hellomail.js">` after Elastic's `ui.js`, a few
  `<roundcube:add_label>` lines for labels the script uses (`folders`,
  `delete`, `markread`, `markunread`, `settings`, `logout`) and a hidden
  `<span id="hm-username">` with the `username` object for the account menu.
- Diff against upstream: added lines only, nothing removed.

## Other files

### `watermark.html`

- Based on: Elastic, Roundcube 1.6.6 (structure and dark-mode detection script)
- Why: the empty preview pane. Elastic shows its blue cube logo; this shows a
  faint envelope outline on the skin's light or dark surface.

## Scripts

### `hellomail.js`

Not a copy. Runs after Elastic's `ui.js` and only adds behaviour:

- Gmail layout on wide screens: `html.hm-no-rail` hides Elastic's task
  rail whenever the page has a sidebar; the logo (mirrored from `#logo`,
  following Elastic's dark-mode swaps) and a Compose pill are prepended to
  the sidebar, and Mail/Contacts/Settings are reachable from the account
  menu. Narrow layouts keep Elastic's rail;
- sidebar collapse toggle (mail task only), state kept in `localStorage`
  under `hellomail.sidebar.collapsed`;
- hover actions on message list rows (archive, delete, mark read/unread),
  added on the list widget's `initrow` event;
- registration of the `snippet` list column, see below;
- message view: wraps `#message-header` and `#message-content` in a
  `.hm-card` and swaps the contact photo placeholder for an initials circle
  (a real address book photo is kept);
- floating compose card on wide screens: `rcmail.open_compose_step` is
  replaced to load the compose page with `_extwin=1` into an iframe docked
  bottom-right; the frame's `window.close` is intercepted to remove the card
  and `window.opener` points at the list window so Roundcube's extwin flow
  (status messages, list refresh after send) works unchanged. Inside the
  card the full TinyMCE toolbar is restored around Elastic's `editor-init`
  handler, which would otherwise pick the touch toolbar for widths up to
  1024px;
- attachment icon moved from the flags cell to just before the date and
  dropped when there is no attachment; the empty threads cell removed in
  list mode;
- always-visible selection checkboxes (adds Elastic's `withselection` class
  to the list), thread message counts next to the sender in threads mode,
  and the "Today" prefix stripped from list dates;
- list density class on `<html>` from the plugin's `hellomail_density`
  preference;
- progress bar above the message list between `request<action>` and
  `responseafter<action>` events for list, search and check-recent;
- account button with initial in the content header, with a popup menu
  built through Elastic's `UI.popup_init`. On wide screens it also hosts
  Settings, the dark/light mode switch, About and Logout; the rail buttons
  are hidden by CSS there and the menu items click them, so Elastic's own
  handlers run. The menu links carry class
  `active` because `rcube_webmail.register_menu_button()` disables a popup
  button whose menu has no active link.

Skin labels for the card buttons live in `localization/` (enabled by
`"localization": true` in `meta.json`).

Core and Elastic functions it relies on: `rcmail.message_list` events,
`rcmail.mark_message`, `rcmail.command('delete' | 'plugin.archive' |
'settings' | 'logout')`, `rcmail.add_message_row`, `UI.popup_init`.

## Styles

`hellomail/styles/styles.css` and `styles-<theme>.css` are not copies of
Elastic's CSS. They are Elastic's LESS compiled with the overrides from
`_variables.less`, `_styles.less` and one theme file, and must be rebuilt
(`make build`) whenever Elastic's LESS changes.

## Colour themes

`plugins/hellomail` stores the user preference `hellomail_theme`, offers
it in Settings > Preferences > User Interface through the `preferences_list`
and `preferences_save` hooks, and sets `env.hellomail_theme` for HTML
output. `includes/layout.html` links `styles/styles-<theme>.css` when the
env value is present. Theme names are validated against the plugin's list,
so the env value can never point outside the skin's `styles/` directory.

## Message list snippets

Roundcube 1.6 does not produce body previews for the list, so the companion
plugin (`plugins/hellomail`) does it. The chain is:

1. `rcmail_action_mail_index::js_message_list()` runs the `messages_list`
   hook with the page's `rcube_message_header` objects. The plugin sets
   `$header->list_cols['snippet']` on each. Core merges `list_cols` into the
   `add_message_row` command arguments (see `program/actions/mail/index.php`,
   "merge with plugin result").
2. `hellomail.js` wraps `rcmail.add_message_row()` to add `snippet` to
   `rcmail.env.msglist_cols` only while a row is built (the list is also
   consumed by `set_message_coltypes()` on folder change, where an unknown
   column throws), and pushes `snippet` into the subject cell of
   `rcmail.env.widescreen_list_template`, so the row gets
   `<span class="snippet">` inside `td.subject`.
3. `_styles.less` lays that span out after the subject on wide screens and
   hides it elsewhere.

Nothing in core or Elastic is modified. After an upgrade check that
`js_message_list()` still merges `list_cols` and that `add_message_row()` in
`program/js/app.js` still reads `env.msglist_cols` and
`env.widescreen_list_template`.
