# Healthcare Dashboard Review - Comprehensive Fix Plan

**Date**: 2026-07-08  
**Dashboard URL**: http://127.0.0.1:3004/  
**Review Scope**: All 15 dashboard modules and their sub-tabs

---

## Executive Summary

The Alberta Hospital Wait Times dashboard is functionally operational but has several critical issues that must be addressed before publication:

1. **Multiple data pipelines are failing or returning zero records** (7 domains affected)
2. **No URL-based routing** - users cannot share direct links to specific modules
3. **Inconsistent data freshness** - some modules update every 30 minutes, others haven't updated in 7+ hours
4. **Manual update dependencies** - several domains require manual intervention
5. **Missing data validation** - no checks for empty/zero-record datasets

---

## Critical Issues (Must Fix Before Publication)

### 1. Failed Data Pipelines - Zero Records

**Affected Domains**:
- **Virtual Care** (`virtual-care`): `virtualCareFetcher` returned 1 record, wrote 0 records
- **Spending** (`spending`): Multiple pipelines returning 0 records:
  - `fraserDownloader`: 0 fetched, 0 written
  - `openAlbertaBillingFetcher`: 0 fetched, 0 written
- **Mental Health** (`mental-health`): `alberta211Scraper`: 0 fetched, 0 written
- **Primary Care** (`primary-care`): `openAlbertaInequityFetcher`: 0 fetched, 0 written

**Impact**: These dashboards will show empty or incomplete data, misleading users.

**Root Cause**: 
- Source websites may have changed structure or are blocking scrapers
- API endpoints may be deprecated or require authentication
- Scrapers may be failing silently without proper error handling

**Fix Plan**:
1. Add logging to each failing pipeline to capture exact error messages
2. Test each source URL manually to verify accessibility
3. Update selectors/parse logic for changed HTML structures
4. Add fallback data sources where available
5. Implement data validation: if a pipeline returns 0 records, mark the domain as "unavailable" in the UI

**Files to Modify**:
- `src/pipelines/virtualCareFetcher.ts`
- `src/pipelines/fraserDownloader.ts`
- `src/pipelines/openAlbertaBillingFetcher.ts`
- `src/pipelines/alberta211Scraper.ts`
- `src/pipelines/openAlbertaInequityFetcher.ts`

---

### 2. Manual Update Dependencies

**Affected Domains**:
- **Public Health** (`public-health`): `phacFetcher` - manual status
- **Spending** (`spending`): `openAlbertaFetcher` - manual status
- **Regional Inequity** (`regional-inequity`): `openAlbertaInequityFetcher` - manual status
- **Virtual Care** (`virtual-care`): `virtualCareFetcher` - manual status
- **Mental Health** (`mental-health`): `alberta211Scraper` - manual status

**Current Behavior**: These pipelines show status "manual" with error "Manual update required — automated source unavailable or partial"

**Impact**: Data may become stale if not manually updated regularly.

**Fix Plan**:
1. For each manual pipeline, determine if automation is possible:
   - If source has no API/automated access: Keep manual but add clear UI indicator
   - If source can be automated: Implement automated fetcher
2. Add UI badges to indicate "Manual Update Required" on affected dashboards
3. Implement manual trigger buttons in admin interface for manual pipelines
4. Set up alerts when manual data hasn't been updated in >30 days

**UI Changes Required**:
- Add manual status indicator to `DashboardHeader` component
- Show last manual update timestamp
- Add "Request Update" button for manual domains

---

### 3. No URL-Based Routing

**Current Behavior**: The app is a React SPA with internal state for module selection. URL navigation (e.g., `http://127.0.0.1:3004/disruptions`) does not work - it always shows the ER waits tab.

**Impact**: 
- Users cannot share direct links to specific modules
- Browser back/forward buttons don't work
- Refreshing the page loses the current module selection

**Fix Plan**:
1. Install React Router: `npm install react-router-dom`
2. Update `App.tsx` to use `<BrowserRouter>` and `<Routes>`
3. Create route paths for each module:
   - `/` → ER waits (default)
   - `/disruptions` → Service Disruptions
   - `/system-flow` → Hospital System Flow
   - `/surgical-waits` → Surgical Waitlists
   - `/workforce` → Health Workforce
   - `/diagnostics` → Diagnostic Imaging + Labs
   - `/primary-care` → Primary Care Access
   - `/long-term-care` → Long Term Care
   - `/patient-experience` → Patient Experience
   - `/virtual-care` → Virtual Care
   - `/cancer` → Cancer Screening & Care
   - `/public-health` → Public Health
   - `/mental-health` → Mental Health
   - `/regional-inequity` → Regional Health Inequity
   - `/health-spending` → Health Spending
4. Update `activeTab` state to sync with URL
5. Update "Change Module" button to navigate via router

**Files to Modify**:
- `src/App.tsx` - Add routing
- `src/main.tsx` - Wrap with BrowserRouter
- `package.json` - Add react-router-dom dependency

---

## High Priority Issues

### 4. Inconsistent Data Freshness

**Current State** (from `data-sync-status.json`):
- **ER Wait Times**: Last updated 2026-07-08T02:28:34.475Z (~30 min ago) ✓
- **Lab Waits**: Last updated 2026-07-08T02:28:34.386Z (~30 min ago) ✓
- **All Other Domains**: Last updated 2026-07-07T19:03:58.120Z (~7 hours ago) ⚠️

**Expected Update Frequencies** (from `TAB_METADATA_MAP` in App.tsx):
- ER waits: every 30 minutes ✓
- Disruptions: every 24 hours
- System flow: daily at 06:00 MT
- Surgical waits: every 24 hours
- Primary care: every 24 hours
- Workforce: every 24 hours
- Diagnostics: Lab waits every 30 min, Imaging annual
- Cancer: every 24 hours
- Mental health: every 24 hours
- Long term care: every 24 hours
- Patient experience: every 24 hours
- Public health: every 24 hours
- Regional inequity: every 24 hours
- Health spending: every 24 hours
- Virtual care: every 24 hours

**Issue**: The daily sync ran at 19:03 on July 7, but it's now past 02:28 on July 8. The daily sync should have run again.

**Fix Plan**:
1. Verify the scheduler is running correctly
2. Check if the daily sync job is scheduled properly in `src/pipelines/scheduler.ts`
3. Add monitoring/alerting for missed sync windows
4. Display "Last Updated" timestamps prominently on each dashboard
5. Add visual indicators for stale data (>25 hours old for daily datasets)

**Files to Modify**:
- `src/pipelines/scheduler.ts` - Verify scheduling logic
- `src/components/DashboardHeader.tsx` - Add staleness indicators
- `server.ts` - Add sync status monitoring endpoint

---

### 5. Missing Data Validation

**Current Behavior**: No validation that datasets contain actual data before rendering charts.

**Impact**: Empty datasets cause charts to render with no data, which is confusing to users.

**Fix Plan**:
1. Add data validation in each dashboard component:
   - Check if arrays are empty before rendering charts
   - Show "No data available" message when empty
   - Add loading states that distinguish between "loading" and "no data"
2. Add validation in API endpoints:
   - Return 404 or empty array with metadata when data is missing
   - Include data quality flags in responses
3. Add dashboard-level health check:
   - Endpoint `/api/health` returns status of each domain
   - UI shows overall system health indicator

**Files to Modify**:
- All dashboard components (add empty state handling)
- `server.ts` (add health check endpoint)
- `src/hooks/useDomainData.ts` (add validation)

---

## Medium Priority Issues

### 6. Data Quality Issues

**Spending Data** (`data-spending.json`):
- Manitoba, New Brunswick, Newfoundland and Labrador have `spendingAsPercentGdp: 0`
- These provinces have `bedsPer100k: 0` and `costPerStandardStay: 0`
- This appears to be missing data, not actual zeros

**Fix Plan**:
1. Investigate why CIHI data is missing for these provinces
2. Add data source notes to explain missing values
3. Consider excluding provinces with incomplete data from comparisons
4. Add visual indicator (e.g., "N/A") for missing values in charts

**Diagnostic Lab Data** (`data-diagnostic.json`):
- Many locations show `waitTimeMin: "Closed"` with `dailyVolume: 0`
- This may be accurate (labs are closed outside business hours) but should be validated

**Fix Plan**:
1. Add business hours logic to distinguish "closed for the day" vs "permanently closed"
2. Show next opening time for closed locations
3. Add filter to show only open labs by default

---

### 7. UI/UX Improvements

**Module Navigation**:
- "Change Module" button is the only way to switch modules
- No keyboard shortcuts for module switching
- Module list is not searchable

**Fix Plan**:
1. Add keyboard shortcuts (Cmd+1 through Cmd+9 for quick module access)
2. Add search/filter to module selector
3. Add breadcrumb navigation showing current module path
4. Consider adding a sidebar navigation for larger screens

**Chart Readability**:
- Some charts may have too many data points for the screen size
- Color schemes may not be colorblind-friendly
- Tooltips may not show enough context

**Fix Plan**:
1. Implement responsive chart sizing
2. Add colorblind-friendly palette option
3. Enhance tooltips with more context and units
4. Add chart export functionality (PNG/SVG)

---

## Low Priority Issues

### 8. Code Quality

**Potential Issues Identified**:
- Some `useMemo` hooks may have missing dependencies (from lessons.md)
- Error handling could be more consistent across components
- Some components are very large (e.g., RegionalInequityDashboard at 1589 lines)

**Fix Plan**:
1. Run ESLint with React hooks plugin to catch dependency issues
2. Standardize error handling pattern across all dashboards
3. Consider splitting large components into smaller sub-components
4. Add unit tests for critical data transformation logic

---

## Implementation Phases

### Phase 1: Critical Data Fixes (Week 1)
- Fix all zero-record pipelines
- Add data validation and empty states
- Implement health check endpoint

### Phase 2: Routing & Navigation (Week 1-2)
- Implement React Router
- Add URL-based navigation
- Update module selector to use routing

### Phase 3: Data Freshness & Monitoring (Week 2)
- Fix daily sync scheduling
- Add staleness indicators
- Implement manual update triggers

### Phase 4: Data Quality Improvements (Week 3)
- Fix missing spending data
- Improve lab data presentation
- Add data source documentation

### Phase 5: UI/UX Enhancements (Week 4)
- Add keyboard shortcuts
- Improve chart readability
- Add export functionality

### Phase 6: Code Quality & Testing (Week 5)
- Refactor large components
- Add unit tests
- Standardize error handling

---

## Success Criteria

The dashboard is ready for publication when:

1. ✅ All data pipelines return non-zero records (or have valid fallback data)
2. ✅ URL-based navigation works for all modules
3. ✅ Data freshness is clearly indicated with "Last Updated" timestamps
4. ✅ Stale data (>25 hours old for daily datasets) shows visual warning
5. ✅ Empty datasets show clear "No data available" messages
6. ✅ Manual update domains have clear UI indicators
7. ✅ Health check endpoint returns all domains as healthy
8. ✅ All charts render correctly with real data
9. ✅ No console errors on any module
10. ✅ Mobile responsive design works on all modules

---

## Testing Checklist

Before publication, verify:

- [ ] Load each of the 15 modules and verify data displays correctly
- [ ] Check that charts render without errors
- [ ] Verify "Last Updated" timestamps are recent (<25 hours for daily data)
- [ ] Test URL navigation to each module
- [ ] Test browser back/forward buttons
- [ ] Test page refresh maintains current module
- [ ] Test mobile view on each module
- [ ] Verify empty states show appropriate messages
- [ ] Check health check endpoint returns all domains healthy
- [ ] Test manual update triggers for manual domains
- [ ] Verify no console errors in browser dev tools
- [ ] Test with different browsers (Chrome, Firefox, Safari)

---

## Notes

- The dashboard is built with React 19, Vite, and TypeScript
- Data is stored in JSON files in the project root
- A scheduler in `src/pipelines/scheduler.ts` handles automated updates
- The app runs on port 3004 (to avoid conflicts with other dev servers)
- Some data sources require manual updates due to lack of automated access
- The lessons.md file contains valuable context about previous issues and fixes
