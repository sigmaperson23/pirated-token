// One-time change of Switchyard's own stylesheet: near-black page, blue accent, Windows system fonts.
// Amber stays as the one colour that means "needs you".
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css');
let css = readFileSync(file, 'utf8');
if (css.includes('--signal-needs')) {
  console.log('Already changed.');
  process.exit(0);
}

const set = (name, value) => {
  const before = css;
  css = css.replace(new RegExp(`${name}:[^;]+;`), `${name}: ${value};`);
  if (css === before) console.log(`No change for ${name}`);
};
set('--ink-0', '#08090b');
set('--ink-1', '#0d0e11');
set('--ink-2', '#15171b');
set('--ink-3', '#20232a');
set('--line', 'rgba(226, 232, 245, 0.08)');
set('--line-strong', 'rgba(226, 232, 245, 0.17)');
set('--paper', '#f2f4f8');
set('--paper-2', '#a6acb8');
set('--paper-3', '#70768a');
set('--sans', `'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif`);
set('--mono', `'Cascadia Mono', 'JetBrains Mono Variable', Consolas, monospace`);

css = css.replace('--amber: #f0a23a;', '--signal-needs: #f0a23a;\n  --accent: #6d9bf5;\n  --accent-fill: #2f6bed;');
css = css.replace(/\s*--amber-deep:[^;]+;/, '');
css = css.replaceAll('var(--amber)', 'var(--accent)');
css = css.replaceAll('rgba(240, 162, 58,', 'rgba(109, 155, 245,');

// Primary button: flat blue with a white label.
css = css.replace('color: #1c1305;', 'color: #fff;');
css = css.replace('linear-gradient(180deg, #f3ad4c, #e4952f)', 'linear-gradient(180deg, #3a75f2, #2b63dd)');
css = css.replace('rgba(90, 50, 0, 0.25)', 'rgba(10, 30, 90, 0.3)');

css += `
/* Amber is kept for one meaning only: an agent is waiting for a person. */
.lamp-needs {
  background: var(--signal-needs);
  box-shadow: 0 0 0 3px rgba(240, 162, 58, 0.22);
}
.waiting {
  border-left-color: var(--signal-needs);
  background: rgba(240, 162, 58, 0.08);
}
.waiting h3,
.waiting-row:hover,
.signal-needs .pane-state {
  color: var(--signal-needs);
}
.pane.signal-needs {
  border-color: var(--signal-needs);
}
.column-review {
  border-top-color: var(--signal-needs);
}
`;
writeFileSync(file, css);
console.log('Stylesheet changed.');
