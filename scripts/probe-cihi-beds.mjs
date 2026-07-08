import fs from 'fs';
import XLSX from 'xlsx';

const wb = XLSX.read(fs.readFileSync('/tmp/beds.xlsx'));
const sn = wb.SheetNames.find((s) => s.includes('Table')) ?? wb.SheetNames[1];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' });
console.log('sheet', sn, 'rows', rows.length);
for (let i = 0; i < Math.min(5, rows.length); i++) {
  console.log(i, rows[i].slice(0, 12));
}
const header = rows[1];
const col = (name) => header.indexOf(name);
const rl = col('Reporting level');
const prov = col('Province/Territory');
const valCol = header.findIndex((c) => /value|number of|beds/i.test(String(c)));
console.log('cols', { rl, prov, valCol, header: header.slice(0, 12) });
const byProv = {};
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (String(r[rl]) !== 'Province/Territory') continue;
  const p = String(r[prov]).trim();
  let v = r[valCol];
  if (v === '' || v == null) {
    for (let j = 8; j < r.length; j++) {
      const n = Number(String(r[j]).replace(/,/g, ''));
      if (!Number.isNaN(n) && n > 0) {
        v = n;
        break;
      }
    }
  } else v = Number(String(v).replace(/,/g, ''));
  if (p && !Number.isNaN(v)) byProv[p] = v;
}
console.log('byProv', byProv);