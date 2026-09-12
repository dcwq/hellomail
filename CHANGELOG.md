# Changelog

## 1.0.0

First release. A Gmail-inspired skin for Roundcube 1.6.x that extends the
bundled Elastic skin, with a companion plugin for colour themes and message
list snippets.

### Layout

- No task rail on wide screens: the logo and a Compose pill sit at the top of
  the folder sidebar, task switching moved to the account menu.
- Folder list with rounded selection, plain unread counts and a collapse to
  icons only, with tooltips.
- Search rendered as a rounded pill, white top bars, account button showing
  the user's initial.

### Message list

- One line per message on wide screens: checkbox, star, sender, subject, body
  snippet and date, with the attachment icon next to the date.
- Hover actions for archive, delete and mark read/unread.
- Body snippets supplied by the companion plugin through the `messages_list`
  hook, cached per folder and UID.
- Thread size shown next to the sender in threads mode, time only for today's
  messages, progress bar while the list loads.
- Selectable density: compact, default, comfortable.

### Reading and composing

- Message shown as a card with an initials avatar and attachments as chips.
- Floating compose card docked bottom-right for new messages, replies and
  forwards, with minimise, maximise and close; full-page compose on narrow
  screens.

### Appearance

- Six colour themes (green, blue, violet, rose, amber, graphite) selectable
  per user in Settings, each with a dark mode.
- Icons from Material Symbols, outlined, filled only where the fill carries
  state.
- System font stack, neutral default logo, branding through Roundcube's
  `skin_logo`.

### Installing

- `install.sh` copies the skin and the plugin into a detected Roundcube
  installation, handles the Debian and Ubuntu symlink layout, and supports
  `--dir`, `--dry-run` and `--uninstall`.

### Compatibility

- Built and tested against Roundcube 1.6.6.
- Two Elastic templates overridden, both documented in `OVERRIDES.md`.
- Responsive layouts, keyboard shortcuts, dark mode and plugin UIs come from
  Elastic and keep working.
