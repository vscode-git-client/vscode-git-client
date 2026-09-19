// One-time script: normalize Command Palette categories in package.json.
// Adds `"category": "VS Code Git Client"` to every contributes.commands entry
// missing one, and retags stragglers (e.g. graph.loadMore's "Git Client").
// Line-based so the diff touches only category lines. Run:
//   node scripts/add-command-categories.js [--check]
const fs = require('fs');
const path = require('path');

const CATEGORY = 'VS Code Git Client';
// Commands that keep a different category.
const KEEP = { 'vscodeGitClient.textCompare.open': 'Text Compare' };

const pkgPath = path.join(__dirname, '..', 'package.json');
const lines = fs.readFileSync(pkgPath, 'utf8').split('\n');

const start = lines.findIndex((l) => /^  "contributes": \{/.test(l));
const cmdStart = lines.findIndex((l, i) => i > start && /^    "commands": \[$/.test(l));
if (cmdStart < 0) throw new Error('commands array not found');
let cmdEnd = -1;
for (let i = cmdStart + 1; i < lines.length; i++) {
  if (/^    \],$/.test(lines[i])) {
    cmdEnd = i;
    break;
  }
}
if (cmdEnd < 0) throw new Error('end of commands array not found');

const out = lines.slice(0, cmdStart + 1);
let added = 0;
let retagged = 0;
let i = cmdStart + 1;
while (i < cmdEnd) {
  if (!/^      \{$/.test(lines[i])) {
    out.push(lines[i]);
    i++;
    continue;
  }
  // Collect one command object: lines[i] ("{") through its closing "}" line.
  const obj = [];
  while (i < cmdEnd && !/^\s*\},?$/.test(lines[i])) {
    obj.push(lines[i]);
    i++;
  }
  obj.push(lines[i]); // closing "}" / "},"
  i++;

  const commandLine = obj.find((l) => /^\s*"command":/.test(l));
  const command = commandLine ? JSON.parse(`{${commandLine.trim().replace(/,$/, '')}}`).command : '';
  const catIdx = obj.findIndex((l) => /^\s*"category":/.test(l));

  if (KEEP[command] !== undefined) {
    out.push(...obj);
    continue;
  }
  if (catIdx >= 0) {
    const cur = JSON.parse(`{${obj[catIdx].trim().replace(/,$/, '')}}`).category;
    if (cur !== CATEGORY) {
      obj[catIdx] = obj[catIdx].replace(/: ".*"/, `: "${CATEGORY}"`);
      retagged++;
      out.push(...obj);
    } else {
      out.push(...obj);
    }
    continue;
  }
  // No category: insert before the closing brace, comma-terminating the last property.
  const closeIdx = obj.length - 1;
  const last = obj[closeIdx - 1];
  if (!/,$/.test(last)) obj[closeIdx - 1] = last + ',';
  obj.splice(closeIdx, 0, `        "category": "${CATEGORY}"`);
  added++;
  out.push(...obj);
}
out.push(...lines.slice(cmdEnd));

const updated = out.join('\n');
if (process.argv.includes('--check')) {
  console.log(`dry run — would add: ${added}, retag: ${retagged}`);
  process.exit(0);
}
fs.writeFileSync(pkgPath, updated);
console.log(`added: ${added}, retagged: ${retagged}`);
