// One-time extraction script: pulls all export const arrays from *Data.ts files
// into JSON files. Run with: npx tsx scripts/extract-data-to-json.ts
import fs from 'fs';
import path from 'path';

const modules = [
  { src: 'src/surgicalData.ts', out: 'data-surgical.json', keys: ['SURGICAL_RECORDS','ORTHOPEDIC_SPECIALTY_RECORDS','SURGICAL_FACILITIES','SPECIALISTS_LIST','CIHI_PROVINCIAL_COMPARATORS','STATSCAN_SATISFACTION_STATS','FRASER_MEDIAN_WEEKS_2025','HISTORICAL_WAIT_TRENDS','STATSCAN_DEMOGRAPHICS','FACILITY_COMPARISONS','SPECIALIST_COMPARISONS'] },
  { src: 'src/diagnosticData.ts', out: 'data-diagnostic.json', keys: ['LAB_LOCATION_WAITS','TEST_TURNAROUND_METRICS','IMAGING_WAIT_TRENDS','FACILITY_IMAGING_WAITS','PRIORITY_TARGET_COMPLIANCE'] },
  { src: 'src/cancerData.ts', out: 'data-cancer.json', keys: ['CANCER_BURDEN_STATS','CANCER_SCREENING_RATES','CANCER_SURGERY_WAIT_TRENDS','RADIATION_THERAPY_WAIT_TRENDS','ALBERTA_CANCER_CENTRES'] },
  { src: 'src/continuingCareData.ts', out: 'data-continuing-care.json', keys: ['CONTINUING_CARE_PLACEMENT_STATS','RESIDENT_QUALITY_OUTCOMES','HOME_CARE_EXPERIENCE','CONTINUING_CARE_COMPLIANCE'] },
  { src: 'src/primaryCareData.ts', out: 'data-primary-care.json', keys: ['ATTACHMENT_RATES','ACCEPTING_PROVIDERS','PCN_CAPACITY','LGA_COMMUNITY_NEEDS','ED_RELIANCE_BY_CONTINUITY','CONTINUITY_SATISFACTION'] },
  { src: 'src/publicHealthData.ts', out: 'data-public-health.json', keys: ['RESPIRATORY_VIRUS_SURVEILLANCE','WASTEWATER_SIGNALS','CHILDHOOD_IMMUNIZATION_COVERAGE','NOTIFIABLE_DISEASE_INCIDENCE','ENVIRONMENTAL_ADVISORIES','OUTBREAK_PROTOCOLS'] },
  { src: 'src/regionalInequityData.ts', out: 'data-regional-inequity.json', keys: ['COMMUNITY_NEED_PROFILES','CHRONIC_DISEASE_BURDEN','ED_RELIANCE_METRICS','TRAVEL_FOR_CARE','SERVICE_ACCESS_METRICS'] },
  { src: 'src/spendingData.ts', out: 'data-spending.json', keys: ['NATIONAL_SPENDING_COMPARE','ALBERTA_ACTIVITY_VOLUME_TREND','HOSPITAL_EFFICIENCY_TREND','PHYSICIAN_SPECIALTY_BILLING','ALBERTA_USE_OF_FUNDS','PROVINCIAL_SPENDING_TREND','PROVINCIAL_USE_OF_FUNDS'] },
  { src: 'src/workforceData.ts', out: 'data-workforce.json', keys: ['PHYSICIAN_SPECIALTY_ZONE','NURSING_SUPPLY_TRENDS','WORKFORCE_AGE_PROFILE','JOB_VACANCY_TRENDS','SPECIALIST_RECRUITMENT_NEEDS','ALLIED_HEALTH_SUPPLY'] },
];

async function main() {
  const cwd = process.cwd();
  let ok = 0;
  let fail = 0;

  for (const mod of modules) {
    try {
      const srcPath = path.resolve(cwd, mod.src);
      const outPath = path.resolve(cwd, mod.out);
      const modExports = await import(srcPath);
      const dataObj: Record<string, unknown> = {};
      for (const key of mod.keys) {
        if (modExports[key] !== undefined) {
          dataObj[key] = modExports[key];
        } else {
          console.warn(`  MISSING: ${key} in ${mod.src}`);
        }
      }
      fs.writeFileSync(outPath, JSON.stringify(dataObj, null, 2), 'utf8');
      const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`OK: ${mod.out} (${sizeKB}KB, ${Object.keys(dataObj).length}/${mod.keys.length} keys)`);
      ok++;
    } catch (err) {
      console.error(`FAIL: ${mod.src} - ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main();
