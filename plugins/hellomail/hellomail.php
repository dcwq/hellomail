<?php

// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * hellomail - companion plugin of the hellomail skin
 *
 * 1. Colour themes and list density. Adds a "Colour theme" selector to Settings > Preferences
 *    > User Interface (stored as the user preference hellomail_theme) and
 *    exposes the choice as env.hellomail_theme, which the skin's
 *    includes/layout.html uses to link styles/styles-<theme>.css instead of
 *    the default styles/styles.css. Themes are compiled ahead of time from
 *    skins/hellomail/styles/themes/<theme>.less.
 *
 * 2. Message list snippets. Adds a short plain-text preview of the body to
 *    every row of the message list, so the skin can render Gmail-like
 *    "subject – snippet" lines. The messages_list hook receives the
 *    rcube_message_header objects of the page being listed; for each the
 *    first text part (text/plain preferred, text/html as fallback) is fetched
 *    partially, reduced to plain text, trimmed and stored in
 *    $header->list_cols['snippet']. Core merges list_cols into the
 *    add_message_row() arguments and the skin's JavaScript registers the
 *    column, so no core change is needed. Snippets are cached per folder/UID.
 *
 * Both parts do nothing visible with other skins.
 *
 * Config (optional, see config.inc.php.dist):
 *   hellomail_default_theme        theme used when the user picked none
 *   hellomail_snippet_length       characters kept (default 140), 0 disables
 *   hellomail_snippet_fetch_bytes  bytes fetched per message (default 16384)
 *   hellomail_snippet_cache_ttl    cache lifetime (default "30d", false to disable)
 *
 * @license GPL-3.0-or-later
 */
class hellomail extends rcube_plugin
{
    public $task = 'mail|settings';

    /** Message list densities; applied by hellomail.js as html.hm-density-<name> */
    private static $densities = ['compact', 'default', 'comfortable'];

    /** Theme names; each needs skins/hellomail/styles/styles-<name>.css (except the default styles.css) */
    private static $themes = ['green', 'ocean', 'violet', 'rose', 'amber', 'graphite'];

    const DEFAULT_THEME = 'green';

    /** @var rcmail */
    private $rcmail;

    /** @var rcube_cache|null */
    private $cache;

    private $length;
    private $fetch_bytes;

    public function init()
    {
        $this->rcmail = rcmail::get_instance();
        $this->load_config();

        // --- themes -----------------------------------------------------
        $this->add_hook('preferences_list', [$this, 'preferences_list']);
        $this->add_hook('preferences_save', [$this, 'preferences_save']);

        $html_output = $this->rcmail->output && $this->rcmail->output->type == 'html';

        if ($html_output) {
            $theme = $this->current_theme();

            if ($theme != self::DEFAULT_THEME) {
                $this->rcmail->output->set_env('hellomail_theme', $theme);
            }

            $density = $this->rcmail->config->get('hellomail_density');

            if ($density && $density != 'default' && in_array($density, self::$densities, true)) {
                $this->rcmail->output->set_env('hellomail_density', $density);
            }
        }

        // --- snippets ---------------------------------------------------
        $this->length      = (int) $this->rcmail->config->get('hellomail_snippet_length', 140);
        $this->fetch_bytes = (int) $this->rcmail->config->get('hellomail_snippet_fetch_bytes', 16384);

        if ($this->rcmail->task == 'mail' && $this->length > 0) {
            $this->add_hook('messages_list', [$this, 'messages_list']);

            if ($html_output) {
                $this->rcmail->output->set_env('hellomail_snippet', true);
            }
        }
    }

    /**
     * Theme chosen by the user, validated against the known list
     */
    private function current_theme()
    {
        $theme = $this->rcmail->config->get('hellomail_theme');

        if (!$theme || !in_array($theme, self::$themes, true)) {
            $theme = $this->rcmail->config->get('hellomail_default_theme', self::DEFAULT_THEME);
        }

        return in_array($theme, self::$themes, true) ? $theme : self::DEFAULT_THEME;
    }

    /**
     * preferences_list hook: theme selector in Settings > Preferences > User Interface
     */
    public function preferences_list($args)
    {
        if ($args['section'] != 'general') {
            return $args;
        }

        $dont_override = (array) $this->rcmail->config->get('dont_override', []);

        if (in_array('hellomail_theme', $dont_override)) {
            return $args;
        }

        $this->add_texts('localization/');

        $field_id = '_hellomail_theme';
        $select   = new html_select(['name' => $field_id, 'id' => $field_id, 'class' => 'custom-select']);

        foreach (self::$themes as $theme) {
            $select->add($this->gettext('theme_' . $theme), $theme);
        }

        // the "skin" block is where core shows the skin chooser
        $args['blocks']['skin']['options']['hellomail_theme'] = [
            'title'   => html::label($field_id, rcube::Q($this->gettext('theme'))),
            'content' => $select->show($this->current_theme()),
        ];

        if (!in_array('hellomail_density', $dont_override)) {
            $field_id = '_hellomail_density';
            $select   = new html_select(['name' => $field_id, 'id' => $field_id, 'class' => 'custom-select']);

            foreach (self::$densities as $density) {
                $select->add($this->gettext('density_' . $density), $density);
            }

            $current = $this->rcmail->config->get('hellomail_density', 'default');

            $args['blocks']['skin']['options']['hellomail_density'] = [
                'title'   => html::label($field_id, rcube::Q($this->gettext('density'))),
                'content' => $select->show(in_array($current, self::$densities, true) ? $current : 'default'),
            ];
        }

        return $args;
    }

    /**
     * preferences_save hook
     */
    public function preferences_save($args)
    {
        if ($args['section'] == 'general' && isset($_POST['_hellomail_theme'])) {
            $theme = rcube_utils::get_input_string('_hellomail_theme', rcube_utils::INPUT_POST);

            if (in_array($theme, self::$themes, true)) {
                $args['prefs']['hellomail_theme'] = $theme;
            }
        }

        if ($args['section'] == 'general' && isset($_POST['_hellomail_density'])) {
            $density = rcube_utils::get_input_string('_hellomail_density', rcube_utils::INPUT_POST);

            if (in_array($density, self::$densities, true)) {
                $args['prefs']['hellomail_density'] = $density;
            }
        }

        return $args;
    }

    /**
     * messages_list hook: attach a snippet to every header of the listed page
     */
    public function messages_list($args)
    {
        if (empty($args['messages']) || !is_array($args['messages'])) {
            return $args;
        }

        $storage = $this->rcmail->get_storage();
        $folder  = $storage->get_folder();
        $cache   = $this->get_cache();

        foreach ($args['messages'] as $header) {
            if (!is_object($header) || empty($header->uid)) {
                continue;
            }

            $mbox = !empty($header->folder) ? $header->folder : $folder;
            $key  = 'snippet:v4:' . $mbox . ':' . $header->uid;

            $snippet = $cache ? $cache->get($key) : null;

            if ($snippet === null) {
                $snippet = $this->fetch_snippet($header->uid, $mbox);

                if ($cache) {
                    $cache->set($key, $snippet);
                }
            }

            if (!is_array($header->list_cols)) {
                $header->list_cols = [];
            }

            $header->list_cols['snippet'] = rcube::Q($snippet);
        }

        // restore the folder the list action was working with
        $storage->set_folder($folder);

        return $args;
    }

    /**
     * Fetch the beginning of the first text part and reduce it to one line
     */
    private function fetch_snippet($uid, $folder)
    {
        $storage = $this->rcmail->get_storage();
        $storage->set_folder($folder);

        try {
            $message = new rcube_message($uid, $folder);
        }
        catch (Exception $e) {
            return '';
        }

        if (empty($message->headers) || empty($message->mime_parts)) {
            return '';
        }

        $plain = null;
        $html  = null;

        foreach ($message->mime_parts as $part) {
            if ($part->ctype_primary != 'text' || $part->disposition == 'attachment' || $part->mime_id === '') {
                continue;
            }
            if ($part->ctype_secondary == 'plain' && !$plain) {
                $plain = $part;
            }
            elseif ($part->ctype_secondary == 'html' && !$html) {
                $html = $part;
            }
        }

        // text/plain first; if it yields nothing (empty or whitespace-only
        // alternative, common in marketing mail) fall back to the HTML part
        foreach ([$plain, $html] as $part) {
            if (!$part) {
                continue;
            }

            // Partial fetch: decoded and converted to UTF-8 by the storage
            // layer, but not formatted.
            $body = $storage->get_message_part($uid, $part->mime_id, $part, null, null, false, $this->fetch_bytes, false);

            if (is_string($body) && $body !== '') {
                $snippet = $this->to_snippet($body, $part === $html);

                if ($snippet !== '') {
                    return $snippet;
                }
            }
        }

        return '';
    }

    /**
     * Turn a (possibly truncated) message body into a single trimmed line
     */
    private function to_snippet($body, $is_html)
    {
        $body = rcube_charset::clean($body);

        // Some senders put HTML source into the text/plain alternative
        if (!$is_html && preg_match('/<(html|body|table|tr|td|div|style)\b/i', substr($body, 0, 2048))) {
            $is_html = true;
        }

        if ($is_html) {
            // Everything before <body> is head matter; the fetch may have been
            // cut inside a <style> block, so also drop an unterminated one.
            $body = preg_replace('/^.*?<body\b[^>]*>/is', '', $body);
            $body = preg_replace('/<(style|script|head|title)\b[^>]*>.*?<\/\1\s*>/is', ' ', $body);
            $body = preg_replace('/<(style|script)\b[^>]*>.*$/is', ' ', $body);
            $body = preg_replace('/<!--.*?(-->|$)/s', ' ', $body);
            $body = preg_replace('/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/td)\b[^>]*>/i', ' ', $body);
            $body = strip_tags($body);
            $body = html_entity_decode($body, ENT_QUOTES | ENT_HTML5, RCUBE_CHARSET);
            // non-breaking spaces and zero-width characters used as layout glue
            $body = str_replace(["\xC2\xA0", "\xE2\x80\x8B", "\xE2\x80\x8C", "\xEF\xBB\xBF"], ' ', $body);
        }
        else {
            $lines = [];
            foreach (preg_split('/\r?\n/', $body) as $line) {
                // stop at the signature separator, skip quoted lines
                if ($line === '-- ') {
                    break;
                }
                if (isset($line[0]) && $line[0] === '>') {
                    continue;
                }
                $lines[] = $line;
            }
            $body = implode(' ', $lines);
        }

        // URLs carry no meaning in a preview (text/plain link lists, "[https://...]")
        $body = preg_replace('~\[?\b(?:https?://|www\.)\S+\]?~i', ' ', $body);
        // separator lines ("-----", "=====") and tokens too long to be words
        // (leftovers of URLs broken across lines, tracking blobs)
        $body = preg_replace('/[-=_*~.#]{3,}/', ' ', $body);
        $body = preg_replace('/\S{40,}/u', ' ', $body);
        $body = preg_replace('/\s+/u', ' ', $body);

        if ($body === null) {
            return '';
        }

        $body = trim($body);

        if (mb_strlen($body, RCUBE_CHARSET) > $this->length) {
            $body = rtrim(mb_substr($body, 0, $this->length, RCUBE_CHARSET)) . '…';
        }

        return $body;
    }

    private function get_cache()
    {
        if ($this->cache === null) {
            $ttl = $this->rcmail->config->get('hellomail_snippet_cache_ttl', '30d');
            $this->cache = $ttl ? $this->rcmail->get_cache('hellomail', 'db', $ttl, true) : false;
        }

        return $this->cache ?: null;
    }
}
