import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { mergeDiagnosticData } from '../../src/pipelines/waittimesAlbertaScraper';
import type {
  FacilityImagingWait,
  ImagingWaitTrend,
} from '../../src/diagnosticData';

const tmpBase = path.join(os.tmpdir(), `wa-scraper-merge-test-${process.pid}`);
const originalCwd = process.cwd();

before(() => {
  fs.mkdirSync(tmpBase, { recursive: true });
});

after(() => {
  let cleanupErr: unknown;
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch (err) {
    cleanupErr = err;
  }
  if (cleanupErr) {
    console.warn('waittimesScraperMerge cleanup skipped or failed:', cleanupErr);
  }
  process.chdir(originalCwd);
});

describe('waittimesAlbertaScraper mergeDiagnosticData', { concurrency: false }, () => {
  it('new truthy CT/MRI values override existing, siblings are preserved', () => {
    const tmpDir = path.join(tmpBase, 'facility');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const existing: FacilityImagingWait = {
      facilityId: 'FAC-calgary-hospital',
      facilityName: 'Calgary Hospital',
      city: 'Calgary',
      zone: 'Calgary Zone',
      mriP50WaitDays: 42,
      mriP90WaitDays: 90,
      ctP50WaitDays: 15,
      ctP90WaitDays: 35,
      annualCompletedExamsCount: 1234,
      scannerUtilizationPct: 67,
    };
    fs.writeFileSync('data-diagnostic.json', JSON.stringify({
      FACILITY_IMAGING_WAITS: [existing],
      SIBLING_KEY: ['sibling-value'],
    }));

    const newFacility: FacilityImagingWait = {
      facilityId: 'FAC-calgary-hospital',
      facilityName: 'Calgary Hospital',
      city: 'Calgary',
      zone: '',
      mriP50WaitDays: 55,
      mriP90WaitDays: 0,
      ctP50WaitDays: 0,
      ctP90WaitDays: 48,
      annualCompletedExamsCount: 0,
      scannerUtilizationPct: 0,
    };

    const mergedResult = mergeDiagnosticData([newFacility], []);
    assert.equal(mergedResult.facilitiesWritten, 1);

    const written = JSON.parse(fs.readFileSync('data-diagnostic.json', 'utf8'));
    assert.deepEqual(written.SIBLING_KEY, ['sibling-value']);

    const merged: FacilityImagingWait = written.FACILITY_IMAGING_WAITS[0];
    assert.equal(merged.mriP50WaitDays, 55);
    assert.equal(merged.ctP90WaitDays, 48);
    assert.equal(merged.mriP90WaitDays, 90);
    assert.equal(merged.ctP50WaitDays, 15);
    assert.equal(merged.annualCompletedExamsCount, 1234);
    assert.equal(merged.facilityId, newFacility.facilityId);
    assert.equal(merged.facilityName, newFacility.facilityName);
    assert.equal(merged.city, 'Calgary');
  });

  it('merges trends by year+modality without losing unowned keys', () => {
    const tmpDir = path.join(tmpBase, 'trend');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);

    const existingTrend: ImagingWaitTrend = {
      year: '2025',
      modality: 'CT Scan',
      albertaP50Days: 14,
      albertaP90Days: 32,
      canadaP50Days: 18,
      canadaP90Days: 40,
    };
    fs.writeFileSync('data-diagnostic.json', JSON.stringify({
      FACILITY_IMAGING_WAITS: [],
      IMAGING_WAIT_TRENDS: [existingTrend],
      UNOWNED_ARRAY: [{ id: 1 }],
    }));

    const newTrend: ImagingWaitTrend = {
      year: '2025',
      modality: 'CT Scan',
      albertaP50Days: 20,
      albertaP90Days: 38,
      canadaP50Days: 22,
      canadaP90Days: 45,
    };

    const mergedResult = mergeDiagnosticData([], [newTrend]);
    assert.equal(mergedResult.trendsWritten, 1);

    const written = JSON.parse(fs.readFileSync('data-diagnostic.json', 'utf8'));
    assert.deepEqual(written.UNOWNED_ARRAY, [{ id: 1 }]);

    const merged: ImagingWaitTrend = written.IMAGING_WAIT_TRENDS[0];
    assert.equal(merged.albertaP50Days, 20);
    assert.equal(merged.albertaP90Days, 38);
    assert.equal(merged.canadaP50Days, 22);
    assert.equal(merged.canadaP90Days, 45);
  });
});
