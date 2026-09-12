// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Compiles the skin stylesheet for every theme.
 *
 *   styles/styles.less           -> styles/styles.css          (default theme)
 *   styles/styles-<theme>.less   -> styles/styles-<theme>.css
 *
 * Runs lessc from build/skins/hellomail so that the relative Elastic import
 * resolves, with hellomail/styles on the include path for Elastic's
 * optional _variables/_styles hooks. URLs are rewritten to point at Elastic's
 * fonts and images.
 */

import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const dir     = 'build/skins/hellomail/styles';
const entries = ['styles.less', ...readdirSync(dir).filter((f) => /^styles-[a-z0-9]+\.less$/.test(f))];

for (const entry of entries) {
    const out = `hellomail/styles/${entry.replace(/\.less$/, '.css')}`;
    execFileSync('node_modules/.bin/lessc', ['--rewrite-urls=all', `--include-path=${dir}`, `${dir}/${entry}`, out], { stdio: 'inherit' });
    console.log(`  ${out}`);
}
