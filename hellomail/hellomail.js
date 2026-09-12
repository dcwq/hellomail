// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Hellogmail skin - client-side additions on top of Elastic's ui.js
 *
 * Loaded from templates/includes/footer.html right after Elastic's ui.js.
 * Only extends behaviour; Elastic's UI object stays untouched.
 */

(function ($) {
    'use strict';

    if (!window.rcmail) {
        return;
    }

    var STORAGE_KEY = 'hellomail.sidebar.collapsed';

    // Message list density chosen in Settings (plugin sets env.hellomail_density)
    if (rcmail.env.hellomail_density) {
        $('html').addClass('hm-density-' + rcmail.env.hellomail_density);
    }

    function storage_get(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function storage_set(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }

    // Folder sidebar collapse (icons only). Mail task only: the settings and
    // addressbook sidebars are lists of sections, not icon-friendly.
    function sidebar_toggle_init() {
        var sidebar = $('#layout-sidebar.listbox');

        if (!sidebar.length || !$('#mailboxlist').length) {
            return;
        }

        // Collapsed folders are icons only, so give every folder link a
        // tooltip with its name (Roundcube renders the links without title).
        var apply_titles = function () {
            $('#mailboxlist li > a').each(function () {
                if (!this.title) {
                    this.title = $.trim($(this).clone().children().remove().end().text());
                }
            });
        };

        var set_state = function (collapsed) {
            sidebar.toggleClass('collapsed', collapsed);
            storage_set(STORAGE_KEY, collapsed ? '1' : '0');
            if (collapsed) {
                apply_titles();
            }
            $(window).trigger('resize');
        };

        var button = $('<a>')
            .attr({ 'class': 'button icon sidebar-toggle', href: '#', role: 'button', title: rcmail.gettext('folders') })
            .append($('<span class="inner">').text(rcmail.gettext('folders')))
            .on('click', function (e) {
                e.preventDefault();
                set_state(!sidebar.hasClass('collapsed'));
            });

        sidebar.children('.header').prepend(button);

        if (storage_get(STORAGE_KEY) === '1') {
            sidebar.addClass('collapsed');
            rcmail.addEventListener('init', apply_titles);
        }
    }

    // Gmail-style hover actions on message list rows: archive (when the
    // archive plugin is active), delete, mark read/unread.
    function list_actions_init() {
        var list = rcmail.message_list;

        if (!list || rcmail.env.msglist_layout !== 'widescreen') {
            return;
        }

        var label = function (name, domain) {
            var text = rcmail.get_label(name, domain);
            return text === name ? '' : text;
        };

        var button = function (cls, title, handler) {
            return $('<a>')
                .attr({ href: '#', 'class': cls, role: 'button', title: title })
                .on('mousedown mouseup', function (e) { e.stopPropagation(); })
                .on('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    handler();
                });
        };

        // Gmail shows only the time for today's messages; Roundcube's pretty
        // dates prefix it with "Today". Drop the prefix.
        var today_prefix = rcmail.get_label('today') + ' ';

        list.addEventListener('initrow', function (row) {
            var tr = row.obj, uid = row.uid;

            if (!tr || !uid || $(tr).find('.hm-actions').length) {
                return;
            }

            var date = $('span.date', tr);
            if (date.length && today_prefix.length > 1 && date.text().indexOf(today_prefix) === 0) {
                date.text(date.text().slice(today_prefix.length));
            }

            // Gmail keeps the left edge to checkbox and star. The attachment
            // icon moves next to the date and only exists when there is one;
            // the empty threads cell (rendered in list mode too) goes away.
            var attachment = $('td.flags > span.attachment', tr);
            if (attachment.length) {
                if (attachment.children().length && date.length) {
                    attachment.insertBefore(date);
                }
                else {
                    attachment.remove();
                }
            }
            if (!rcmail.env.threading) {
                $('td.threads', tr).remove();
            }

            var box = $('<span class="hm-actions skip-on-drag">');

            if (rcmail.env.archive_folder && rcmail.env.mailbox !== rcmail.env.archive_folder) {
                box.append(button('archive', label('buttontext', 'archive'), function () {
                    list.select(uid);
                    rcmail.command('plugin.archive');
                }));
            }

            box.append(button('delete', label('delete'), function () {
                list.select(uid);
                rcmail.command('delete');
            }));

            box.append(button('toggle-read', '', function () {
                rcmail.mark_message($(tr).hasClass('unread') ? 'read' : 'unread', uid);
            }).on('mouseenter', function () {
                this.title = label($(tr).hasClass('unread') ? 'markread' : 'markunread');
            }));

            $('td.subject', tr).append(box);
        });

        // Checkboxes are always visible, like Gmail (Elastic keeps its own
        // toggle in the "Select" menu; this only sets the default).
        $('#messagelist').addClass('withselection');

        // In threads mode, show how many messages a thread holds next to the
        // sender of its root message ("Marcin, me 4" in Gmail).
        var thread_counts = function () {
            if (!rcmail.env.threading || !list.rows) {
                return;
            }

            var counts = {}, uid, row, root;

            for (uid in list.rows) {
                row = list.rows[uid];
                if (!row || !row.parent_uid) {
                    continue;
                }
                root = row;
                while (root && root.parent_uid && list.rows[root.parent_uid]) {
                    root = list.rows[root.parent_uid];
                }
                counts[root.uid] = (counts[root.uid] || 0) + 1;
            }

            for (uid in list.rows) {
                row = list.rows[uid];
                if (!row || !row.obj) {
                    continue;
                }
                var badge = $('span.fromto .hm-thread-count', row.obj);
                if (counts[uid]) {
                    if (!badge.length) {
                        badge = $('<span class="hm-thread-count">').appendTo($('span.fromto', row.obj));
                    }
                    badge.text(counts[uid] + 1);
                }
                else {
                    badge.remove();
                }
            }
        };

        rcmail.addEventListener('listupdate', thread_counts);
    }

    // Body snippets from the hellomail plugin. The plugin attaches a
    // "snippet" column to every row's data. Roundcube only renders columns
    // listed in env.msglist_cols, but that list is also used by
    // set_message_coltypes() with server-provided header definitions, where
    // an unknown column throws. So "snippet" is added to the list only for
    // the duration of each add_message_row() call, and placed in the subject
    // cell of Elastic's widescreen row template.
    function snippet_column_init() {
        if (!rcmail.env.hellomail_snippet) {
            return;
        }

        var orig_add = rcmail.add_message_row;

        rcmail.add_message_row = function (uid, cols, flags, attop) {
            var list  = this.env.msglist_cols,
                added = false;

            if (this.env.msglist_layout === 'widescreen' && cols && cols.snippet !== undefined
                && $.isArray(list) && $.inArray('snippet', list) < 0
            ) {
                list.push('snippet');
                added = true;
            }

            try {
                return orig_add.apply(this, arguments);
            }
            finally {
                if (added) {
                    list.splice($.inArray('snippet', list), 1);
                }
            }
        };

        rcmail.addEventListener('init', function () {
            $.each(rcmail.env.widescreen_list_template || [], function () {
                if (this.className === 'subject' && $.inArray('snippet', this.cells) < 0) {
                    this.cells.push('snippet');
                }
            });
        });
    }

    // Gmail-style account button (initial in a circle) at the right end of
    // the content header, opening a small menu with settings and logout.
    // Uses Elastic's popup machinery (UI.popup_init) so it looks native.
    // The menu links carry class "active": rcube_webmail.register_menu_button()
    // marks a popup button disabled when none of its links is active.
    function account_menu_init() {
        var header = $('#layout-content > .header');
        var name   = $.trim($('#hm-username').text());

        if (!header.length || !name || !window.UI || !UI.popup_init) {
            return;
        }

        var initial = name.charAt(0).toUpperCase();

        // The rail's Settings, theme, About and Logout buttons are hidden on
        // wide screens (CSS) and live here instead. Theme and About delegate
        // to Elastic's own buttons so its behaviour stays untouched.
        var item = function (cls, text, handler) {
            return $('<li role="menuitem">').append(
                $('<a href="#" class="' + cls + ' active">').text(text)
                    .on('click', function (e) { e.preventDefault(); handler(); }));
        };

        var theme_button = $('#taskmenu a.theme'),
            about_button = $('#taskmenu a.about'),
            theme_item;

        var menu_list = $('<ul class="menu listing" role="menu">')
            .append(item('mail', $.trim($('#taskmenu a.mail').text()) || 'Mail', function () { rcmail.command('mail'); }))
            .append(item('contacts', $.trim($('#taskmenu a.contacts').text()) || 'Contacts', function () { rcmail.command('addressbook'); }))
            .append(item('settings', rcmail.get_label('settings'), function () { rcmail.command('settings'); }));

        if (theme_button.length) {
            theme_item = item('theme', $.trim(theme_button.text()), function () {
                theme_button.get(0).click();
                // Elastic swaps the label after switching; mirror it
                setTimeout(function () { theme_item.find('a').text($.trim(theme_button.text())); }, 50);
            });
            menu_list.append(theme_item);
        }

        if (about_button.length) {
            menu_list.append(item('about', $.trim(about_button.text()), function () { about_button.get(0).click(); }));
        }

        menu_list.append(item('logout', rcmail.get_label('logout'), function () { rcmail.command('logout'); }));

        $('<div id="hm-account-menu" class="popupmenu">')
            .append($('<div class="hm-account-head">')
                .append($('<span class="hm-account-initial">').text(initial))
                .append($('<div class="hm-account-name">').text(name)))
            .append(menu_list)
            .appendTo(document.body);

        var button = $('<a href="#" class="hm-account" role="button">')
            .attr({ 'data-popup': 'hm-account-menu', 'data-popup-pos': 'bottom', title: name })
            .text(initial)
            .appendTo(header);

        UI.popup_init(button.get(0));
    }

    // Reading pane: wrap header and body in a card, and replace Roundcube's
    // contact photo placeholder with a circle of the sender's initials. A real
    // photo from the address book is kept.
    function message_view_init() {
        var header = $('#message-header');

        if (!header.length) {
            return;
        }

        $('#message-header, #message-content').wrapAll('<div class="hm-card">');

        var img  = header.find('img.contactphoto');
        var link = header.find('.header-summary .rcmContactAddress').first();
        var name = $.trim(link.text()) || $.trim(link.attr('title') || '');

        if (!img.length || !name) {
            return;
        }

        var email    = link.attr('title') || name;
        var initials = name.replace(/["'<>()]/g, '').split(/[\s._@-]+/).filter(Boolean)
            .slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
        var hue = 0;

        for (var i = 0; i < email.length; i++) {
            hue = (hue * 31 + email.charCodeAt(i)) % 360;
        }

        var avatar = $('<span class="hm-avatar" aria-hidden="true">').text(initials || '?')
            .css('background-color', 'hsl(' + hue + ', 42%, 46%)');

        var is_placeholder = function (src) { return !src || /contactpic\.svg|data:image/.test(src); };
        var swap = function () { img.replaceWith(avatar); };

        if (is_placeholder(img.attr('src')) || (img[0].complete && img[0].naturalWidth === 0)) {
            swap();
        }
        else {
            img.on('error', swap).on('load', function () {
                if (is_placeholder(this.src)) {
                    swap();
                }
            });
        }
    }

    // Gmail-style floating compose card. On wide screens the compose page is
    // loaded with _extwin=1 (Elastic renders it without the task menu) into
    // an iframe docked bottom-right, instead of navigating away from the
    // list. Roundcube's own extwin handling does the rest: the page calls
    // window.close() after sending or cancelling, which is intercepted here,
    // and reports back through window.opener, which points at this window.
    function compose_card_init() {
        if (rcmail.env.task !== 'mail' || !rcmail.open_compose_step) {
            return;
        }

        // In the preview frame, hand over to the parent window
        if (rcmail.is_framed() && parent.rcmail && parent.rcmail.hm_compose_card) {
            rcmail.open_compose_step = function (p) { parent.rcmail.hm_compose_card(p); };
            return;
        }

        var orig_open = rcmail.open_compose_step,
            card, frame, title_el, subject_timer;

        var wide = function () {
            return window.matchMedia('(min-width: 1025px)').matches;
        };

        var set_title = function (text) {
            title_el.text(text || rcmail.get_label('writenewmessage'));
        };

        var destroy = function () {
            clearInterval(subject_timer);
            if (card) {
                card.remove();
                card = frame = null;
            }
        };

        var frame_loaded = function () {
            var win = frame.get(0).contentWindow;

            try {
                win.opener = window;            // lets rcmail.opener() find this window
                win.close  = function () { destroy(); };

                subject_timer = setInterval(function () {
                    var input = win.document.querySelector('input[name="_subject"]');
                    if (input) {
                        set_title($.trim(input.value));
                    }
                }, 500);
            }
            catch (e) { /* cross-origin: leave defaults */ }
        };

        var open = function (p) {
            if (card) {
                card.removeClass('minimized');
                return;
            }

            var url = rcmail.url('mail/compose', $.extend({ _extwin: 1 }, p || {}));

            card = $('<div id="hm-compose" class="hm-compose">');
            title_el = $('<span class="hm-compose-title">');

            var head = $('<div class="hm-compose-head">')
                .append(title_el)
                .append($('<a href="#" class="hm-compose-btn minimize" role="button">').attr('title', rcmail.get_label('minimize'))
                    .on('click', function (e) { e.preventDefault(); card.toggleClass('minimized').removeClass('maximized'); }))
                .append($('<a href="#" class="hm-compose-btn maximize" role="button">').attr('title', rcmail.get_label('maximize'))
                    .on('click', function (e) { e.preventDefault(); card.toggleClass('maximized').removeClass('minimized'); }))
                .append($('<a href="#" class="hm-compose-btn close" role="button">').attr('title', rcmail.get_label('close'))
                    .on('click', function (e) {
                        e.preventDefault();
                        // "list" in an extwin compose page closes the window,
                        // after Roundcube's own unsaved-changes confirmation
                        var win = frame.get(0).contentWindow;
                        if (win && win.rcmail) {
                            win.rcmail.command('list');
                        }
                        else {
                            destroy();
                        }
                    }))
                .on('dblclick', function () { card.toggleClass('minimized'); });

            frame = $('<iframe class="hm-compose-frame" name="hm-compose-frame">')
                .attr({ src: url, title: rcmail.get_label('writenewmessage') })
                .on('load', frame_loaded);

            set_title();
            card.append(head).append(frame).appendTo(document.body);
        };

        rcmail.hm_compose_card = function (p) {
            if (wide()) {
                open(p);
            }
            else {
                orig_open.call(rcmail, p);
            }
        };

        rcmail.open_compose_step = rcmail.hm_compose_card;
    }

    // Thin progress bar above the message list while a list/search request
    // is in flight (Roundcube's own "Loading..." toast stays as it is).
    function list_progress_init() {
        var list = $('#layout-list');

        if (!list.length || !$('#messagelist').length) {
            return;
        }

        var timer;

        $('<div class="hm-progress" aria-hidden="true">').insertBefore('#messagelist-content');

        var off = function () { clearTimeout(timer); list.removeClass('hm-loading'); };
        var on  = function () {
            list.addClass('hm-loading');
            clearTimeout(timer);
            timer = setTimeout(off, 20000);   // safety net for failed requests
        };

        $.each(['requestlist', 'requestsearch', 'requestcheck-recent'], function (i, ev) {
            rcmail.addEventListener(ev, on);
        });
        $.each(['responseafterlist', 'responseaftersearch', 'responseaftercheck-recent', 'listupdate'], function (i, ev) {
            rcmail.addEventListener(ev, off);
        });
    }

    // Inside the compose card the page is narrower than 1024px, so Elastic's
    // editor-init handler (registered when ui.js loads, i.e. before this
    // script) swaps the editor toolbar for its touch version. Put the full
    // toolbar of program/js/editor.js (Roundcube 1.6) back.
    function compose_frame_editor_init() {
        if (window.name !== 'hm-compose-frame' || rcmail.env.action !== 'compose') {
            return;
        }

        var touch_toolbar = 'undo redo | link image styleselect',
            full_toolbar  = 'bold italic underline | alignleft aligncenter alignright alignjustify'
                + ' | bullist numlist outdent indent ltr rtl blockquote'
                + ' | link unlink table | charmap image media | code searchreplace undo redo';

        rcmail.addEventListener('editor-init', function (o) {
            // Elastic may prefix the toolbar (e.g. "plaintext | ") in compose
            if (o && o.config && typeof o.config.toolbar === 'string' && o.config.toolbar.indexOf(touch_toolbar) >= 0) {
                o.config.toolbar = o.config.toolbar.replace(touch_toolbar, full_toolbar);
            }
        });
    }

    // Gmail layout on wide screens: no task rail. The logo and a Compose
    // pill sit at the top of the sidebar, task switching moves to the
    // account menu. Elastic's rail stays in the DOM (hidden by CSS under
    // html.hm-no-rail) so narrow layouts and its own handlers keep working.
    function rail_init() {
        var sidebar = $('#layout-sidebar.listbox');

        if (!sidebar.length || rcmail.env.framed || rcmail.env.extwin) {
            return;
        }

        $('html').addClass('hm-no-rail');

        var top  = $('<div id="hm-sidebar-top">');
        var row  = $('<div class="hm-sidebar-brand">').appendTo(top);
        var logo = $('#logo');

        if (logo.length) {
            var mirror = $('<img id="hm-logo" alt="">').attr('src', logo.attr('src'));
            $('<a class="hm-logo-link" href="./?_task=mail&_mbox=INBOX">').append(mirror).appendTo(row);

            // Elastic swaps #logo's src for dark mode / screen size; follow it
            if (window.MutationObserver) {
                new MutationObserver(function () { mirror.attr('src', logo.attr('src')); })
                    .observe(logo.get(0), { attributes: true, attributeFilter: ['src'] });
            }
        }

        if (rcmail.env.task === 'mail' && $('#taskmenu a.compose').length) {
            $('<a href="#" class="hm-compose-pill" role="button">')
                .attr('title', rcmail.get_label('writenewmessage'))
                .append($('<span class="inner">').text($.trim($('#taskmenu a.compose').text())))
                .on('click', function (e) { e.preventDefault(); rcmail.command('compose', '', this, e); })
                .appendTo(top);
        }

        sidebar.prepend(top);

        // The mail sidebar header (username, folder actions): the name is in
        // the account menu, the collapse toggle and folder menu move up here
        var header = sidebar.children('.header');
        row.append(header.find('a.sidebar-toggle'));
        row.append(header.find('a.sidebar-menu'));
    }

    sidebar_toggle_init();
    rail_init();
    list_progress_init();
    compose_card_init();
    compose_frame_editor_init();
    message_view_init();
    snippet_column_init();
    rcmail.addEventListener('init', account_menu_init);
    rcmail.addEventListener('init', list_actions_init);

})(jQuery);
