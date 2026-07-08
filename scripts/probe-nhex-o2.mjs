import axios from 'axios';
import AdmZip from 'adm-zip';
import XLSX from 'xlsx';

const url = 'https://www.cihi.ca/sites/default/files/document/nhex-2025-full-data-tables-en.zip';
const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
const zip = new AdmZip(Buffer.from(r.data));
const entry = zip.getEntry('nhex-open-data-2025-en.xlsx');
const wb = XLSX.read(entry.getData(), { type: 'buffer' });
const sheet = wb.Sheets['Table O.2'];
if (!sheet) {
  console.log('no O.2');
  process.exit(0);
}
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
for (let i = 0; i < Math.min(8, rows.length); i++) console.log(i, rows[i].slice(0, 10));