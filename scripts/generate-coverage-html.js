const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'coverage', 'output.txt');
const outputDir = path.join(__dirname, '..', 'coverage');
const outputFile = path.join(outputDir, 'index.html');

function parseTestSummary(text) {
  const summary = { tests: 0, pass: 0, fail: 0, skip: 0, durationMs: 0 };
  for (const line of text.split('\n')) {
    const t = line.replace(/^#\s*/, '').trim();
    if (t.startsWith('tests ')) summary.tests = parseInt(t.split(/\s+/)[1]) || 0;
    if (t.startsWith('pass ')) summary.pass = parseInt(t.split(/\s+/)[1]) || 0;
    if (t.startsWith('fail ')) summary.fail = parseInt(t.split(/\s+/)[1]) || 0;
    if (t.startsWith('skipped ')) summary.skip = parseInt(t.split(/\s+/)[1]) || 0;
    if (t.startsWith('duration_ms ')) summary.durationMs = parseFloat(t.split(/\s+/)[1]) || 0;
  }
  return summary;
}

function parseCoverage(text) {
  const lines = text.split('\n');
  const files = [];
  let inTable = false;
  let headerFound = false;

  for (const rawLine of lines) {
    // Strip the "# " prefix (TAP comment syntax)
    const afterPrefix = rawLine.replace(/^#\s?/, '');
    // Count leading spaces for directory depth
    const depthMatch = afterPrefix.match(/^(\s*)/);
    const depth = depthMatch ? depthMatch[1].length : 0;
    const trimmed = afterPrefix.trim();

    // Detect the table header
    if (!headerFound && trimmed.startsWith('file') && trimmed.includes('line %')) {
      headerFound = true;
      continue;
    }

    if (!headerFound) continue;

    // Separator line
    if (trimmed.startsWith('---') || trimmed === '') continue;

    // End of table
    if (trimmed.startsWith('all files')) {
      // Parse summary
      const parts = trimmed.split('|').map((s) => s.trim());
      if (parts.length >= 4) {
        const summary = {
          name: 'All files',
          linePct: parseFloat(parts[1]) || 0,
          branchPct: parseFloat(parts[2]) || 0,
          funcsPct: parseFloat(parts[3]) || 0,
          uncoveredLines: '',
          isSummary: true,
        };
        files.push(summary);
      }
      break;
    }

    // Skip lines that don't have coverage data (directory headers or empty)
    const hasCoverageData = /\d+\.\d+/.test(trimmed);
    if (!hasCoverageData) continue;

    const parts = trimmed.split('|').map((s) => s.trim());
    if (parts.length >= 5) {
      files.push({
        name: parts[0],
        linePct: parseFloat(parts[1]) || 0,
        branchPct: parseFloat(parts[2]) || 0,
        funcsPct: parseFloat(parts[3]) || 0,
        uncoveredLines: parts[4] || '',
        depth,
        isSummary: false,
      });
    }
  }

  return files;
}

function pctClass(pct) {
  if (pct >= 80) return 'high';
  if (pct >= 50) return 'medium';
  return 'low';
}

function pctBar(pct) {
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
  return `<div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="pct">${pct.toFixed(1)}%</span>`;
}

function generateHtml(files, testSummary) {
  const summaryRow = files.find((f) => f.isSummary);
  const fileRows = files.filter((f) => !f.isSummary);

  const testStats = `
    <div class="test-stats">
      <span class="stat ${testSummary.fail > 0 ? 'fail' : ''}">${testSummary.tests} tests</span>
      <span class="stat pass">${testSummary.pass} passed</span>
      ${testSummary.fail > 0 ? `<span class="stat fail">${testSummary.fail} failed</span>` : ''}
      ${testSummary.skip > 0 ? `<span class="stat skip">${testSummary.skip} skipped</span>` : ''}
      <span class="stat">${(testSummary.durationMs / 1000).toFixed(1)}s</span>
    </div>`;

  const summaryCards = summaryRow
    ? `
    <div class="summary">
      <div class="card">
        <div class="card-value ${pctClass(summaryRow.linePct)}">${summaryRow.linePct.toFixed(1)}%</div>
        <div class="card-label">Lines</div>
      </div>
      <div class="card">
        <div class="card-value ${pctClass(summaryRow.branchPct)}">${summaryRow.branchPct.toFixed(1)}%</div>
        <div class="card-label">Branches</div>
      </div>
      <div class="card">
        <div class="card-value ${pctClass(summaryRow.funcsPct)}">${summaryRow.funcsPct.toFixed(1)}%</div>
        <div class="card-label">Functions</div>
      </div>
    </div>`
    : '';

  const tableRows = fileRows
    .map(
      (f) => `
    <tr class="${f.depth > 0 ? 'nested depth-' + f.depth : ''}">
      <td class="file-name" style="padding-left:${f.depth * 12 + 8}px">${escapeHtml(f.name)}</td>
      <td class="pct-cell">${pctBar(f.linePct)}</td>
      <td class="pct-cell">${pctBar(f.branchPct)}</td>
      <td class="pct-cell">${pctBar(f.funcsPct)}</td>
      <td class="uncovered">${escapeHtml(truncateUncovered(f.uncoveredLines))}</td>
    </tr>`
    )
    .join('\n');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VS Code Git Client — Coverage Report</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
h1 { font-size: 1.5rem; margin-bottom: 4px; }
.subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 16px; }
.test-stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.test-stats .stat { background: #1e293b; padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; color: #94a3b8; }
.test-stats .stat.pass { color: #22c55e; }
.test-stats .stat.fail { color: #ef4444; }
.test-stats .stat.skip { color: #eab308; }
.summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.card { background: #1e293b; border-radius: 8px; padding: 16px 24px; text-align: center; min-width: 120px; }
.card-value { font-size: 1.75rem; font-weight: 700; }
.card-value.high { color: #22c55e; }
.card-value.medium { color: #eab308; }
.card-value.low { color: #ef4444; }
.card-label { color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
.toolbar input { background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 12px; color: #e2e8f0; font-size: 0.875rem; width: 260px; outline: none; }
.toolbar input:focus { border-color: #6366f1; }
.toolbar .count { color: #94a3b8; font-size: 0.8rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
th { text-align: left; padding: 8px 8px; border-bottom: 2px solid #334155; color: #94a3b8; font-weight: 600; cursor: pointer; user-select: none; white-space: nowrap; }
th:hover { color: #e2e8f0; }
th .arrow { margin-left: 4px; font-size: 0.7rem; }
td { padding: 6px 8px; border-bottom: 1px solid #1e293b; }
tr:hover td { background: #1e293b; }
.file-name { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8125rem; white-space: nowrap; }
.pct-cell { min-width: 140px; }
.bar-bg { display: inline-block; width: 80px; height: 8px; background: #334155; border-radius: 4px; vertical-align: middle; margin-right: 6px; }
.bar-fill { height: 8px; border-radius: 4px; transition: width 0.3s; }
.pct { font-variant-numeric: tabular-nums; }
.uncovered { color: #64748b; font-size: 0.75rem; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.footer { margin-top: 24px; color: #475569; font-size: 0.75rem; }
</style>
</head>
<body>
<h1>VS Code Git Client</h1>
<p class="subtitle">Coverage Report — ${now} UTC</p>
${testStats}
${summaryCards}
<div class="toolbar">
  <input type="text" id="filter" placeholder="Filter files…" oninput="filterTable()">
  <span class="count" id="rowCount"></span>
</div>
<table>
<thead>
<tr>
  <th onclick="sortTable(0)">File<span class="arrow"></span></th>
  <th onclick="sortTable(1)">Lines<span class="arrow"></span></th>
  <th onclick="sortTable(2)">Branches<span class="arrow"></span></th>
  <th onclick="sortTable(3)">Functions<span class="arrow"></span></th>
  <th>Uncovered Lines</th>
</tr>
</thead>
<tbody id="tbody">
${tableRows}
</tbody>
</table>
<p class="footer">Generated by Node.js --experimental-test-coverage</p>
<script>
let sortCol = 1;
let sortAsc = false;
function sortTable(col) {
  const tbody = document.getElementById('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (sortCol === col) sortAsc = !sortAsc; else { sortCol = col; sortAsc = false; }
  rows.sort((a, b) => {
    const aVal = parseFloat(a.cells[col].textContent) || 0;
    const bVal = parseFloat(b.cells[col].textContent) || 0;
    return sortAsc ? aVal - bVal : bVal - aVal;
  });
  rows.forEach(r => tbody.appendChild(r));
  updateArrows();
}
function updateArrows() {
  document.querySelectorAll('th .arrow').forEach((a, i) => {
    a.textContent = i === sortCol ? (sortAsc ? '▲' : '▼') : '';
  });
}
function filterTable() {
  const q = document.getElementById('filter').value.toLowerCase();
  const rows = document.querySelectorAll('#tbody tr');
  let visible = 0;
  rows.forEach(r => {
    const name = r.cells[0].textContent.toLowerCase();
    const match = !q || name.includes(q);
    r.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  document.getElementById('rowCount').textContent = q ? visible + ' / ' + rows.length + ' files' : rows.length + ' files';
}
updateArrows();
document.getElementById('rowCount').textContent = document.querySelectorAll('#tbody tr').length + ' files';
</script>
</body>
</html>`;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncateUncovered(lines) {
  if (!lines) return '';
  if (lines.length <= 60) return lines;
  return lines.slice(0, 57) + '…';
}

// Main
const input = fs.readFileSync(inputFile, 'utf8');
const testSummary = parseTestSummary(input);
const files = parseCoverage(input);
const html = generateHtml(files, testSummary);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');
console.log(`Coverage HTML written to ${outputFile} (${files.length} entries)`);
