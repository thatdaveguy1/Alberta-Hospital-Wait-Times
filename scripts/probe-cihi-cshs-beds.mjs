import fs from 'fs';
import axios from 'axios';
import XLSX from 'xlsx';

const UA = 'Mozilla/5.0';
const REF = { 'User-Agent': UA, Referer: 'https://www.cihi.ca/' };

const CSHS_URL =
  'https://www.cihi.ca/sites/default/files/document/data-file/823-cost-of-a-standard-hospital-stay-data-table-en.xlsx';

async function download(url, out) {
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000, headers: REF });
  fs.writeFileSync(out, Buffer.from(r.data));
  return out;
}

function probeSheet(path, label) {
  const wb = XLSX.read(fs.readFileSync(path));
  const sn = wb.SheetNames.find((n) => n.includes('Table')) ?? wb.SheetNames[1];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
  console.log('\n===', label, sn, 'rows', rows.length);
  for (let i = 0; i < Math.min(4, rows.length); i++) console.log(i, rows[i].slice(0, 14));

  const header = rows[1];
  const col = (name) =>
    header.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
  const idxLevel = col('Reporting level');
  const idxProv = col('Province/Territory');
  const idxFrame = col('Time frame');
  const idxVal = header.findIndex((c) =>
    /cost of a standard hospital stay|cshs/i.test(String(c)),
  );

  const byProv = {};
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[idxLevel]) !== 'Province/Territory') continue;
    const p = String(r[idxProv]).trim();
    const tf = String(r[idxFrame]);
    let v = r[idxVal];
    if (v === '' || v == null) continue;
    v = Number(String(v).replace(/,/g, ''));
    if (!p || Number.isNaN(v)) continue;
    if (!byProv[p]) byProv[p] = {};
    byProv[p][tf] = v;
  }
  console.log('Province/Territory CSHS sample:', JSON.stringify(byProv, null, 2).slice(0, 2500));
}

await download(CSHS_URL, '/tmp/cshs823.xlsx');
probeSheet('/tmp/cshs823.xlsx', 'CSHS 823');

// Scan nearby indicator ids for staffed beds
const bedCandidates = [
  'https://www.cihi.ca/sites/default/files/document/data-file/876-number-of-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/875-number-of-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/874-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/873-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/872-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/871-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/870-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/869-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/868-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/867-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/866-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/865-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/864-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/863-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/862-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/861-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/860-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/859-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/858-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/857-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/856-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/855-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/854-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/853-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/852-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/851-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
  'https://www.cihi.ca/sites/default/files/document/data-file/850-hospital-beds-staffed-and-in-operation-data-table-en.xlsx',
];

for (const url of bedCandidates) {
  const code = await axios.head(url, { timeout: 15000, validateStatus: () => true, headers: REF });
  if (code.status === 200) console.log('BEDS OK', url.split('/').pop());
}