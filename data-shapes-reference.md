# Data Shapes for 7 Domains Needing Automated Pipelines

## 1. Primary Care (data-primary-care.json)
- ATTACHMENT_RATES: { id, source_name, source_url, reporting_year, geography, attachmentRatePct }
- ACCEPTING_PROVIDERS: { id, name, type, clinicName, city, zone, address, postalCode, phone, acceptingNewPatients, languages }
- PCN_CAPACITY: { zone, pcnCount, activeProviders, enrolledPatients, totalPaymentsMillions, patientsPerProvider, fundingPerPatient, providersPer100k }
- LGA_COMMUNITY_NEEDS: { lgaName, zone, population, familyPhysiciansPer100k, pctClaimsOutsideLGA, acscHospitalizationRatePer100k, fcscRatePer100k, moodAnxietyEdRatePer100k }
- ED_RELIANCE_BY_CONTINUITY: { group, minorConditionEdVisitsPer1000, description }
- CONTINUITY_SATISFACTION: { zone, highDoctorContinuityPct, highClinicContinuityPct, sameNextDayAccessPct, satisfiedWithWaitTimePct, overallCareRatingExcellentPct }

## 2. Diagnostics & Labs (data-diagnostic.json)
- LAB_LOCATION_WAITS: { id, name, code, address, city, region, waitTimeMin, saveMyPlaceAvailable, appointmentRequired, hours }
- TEST_TURNAROUND_METRICS: { testName, category, specimenType, statTurnaroundHrs, routineTurnaroundDays, volumePerYearMillions }
- IMAGING_WAIT_TRENDS: { year, modality, albertaP50Days, albertaP90Days, canadaP50Days, canadaP90Days }
- FACILITY_IMAGING_WAITS: { facilityId, facilityName, city, zone, mriP50WaitDays, mriP90WaitDays, ctP50WaitDays, ctP90WaitDays, annualCompletedScans }
- PRIORITY_TARGET_COMPLIANCE: { priority, targetLimitText, targetDaysMax, albertaCtCompliancePct, albertaMriCompliancePct }

## 3. Cancer Care (data-cancer.json)
- CANCER_BURDEN_STATS: { cancerType, projectedCases2026, crudeIncidenceRate, ageStandardizedIncidenceRate, projectedDeaths2026, crudeMortalityRate, ageStandardizedMortalityRate }
- CANCER_SCREENING_RATES: { zone, breastScreeningPct, cervicalScreeningPct, colorectalScreeningPct, lungScreeningEnrollmentCount }
- CANCER_SURGERY_WAIT_TRENDS: { year, cancerType, albertaP50Days, albertaP90Days, canadaP50Days, canadaP90Days, completedVolume }
- RADIATION_THERAPY_WAIT_TRENDS: { year, albertaPctWithinBenchmark, canadaPctWithinBenchmark, albertaP50WaitDays, albertaP90WaitDays }
- ALBERTA_CANCER_CENTRES: { id, name, type, city, zone, address, services[] }

## 4. Long Term Care (data-continuing-care.json)
- CONTINUING_CARE_PLACEMENT_STATS: { year, zone, pctPlacedWithin30Days, pctPlacedPreferredOption, daysWaitingP50, daysWaitingP90 }
- RESIDENT_QUALITY_OUTCOMES: { year, metric, albertaRatePct, canadaRatePct, directionIsLowerBetter }
- HOME_CARE_EXPERIENCE: { zone, overallCareRatingPct, unmetNeedsPct, differentStaffCountAverage }
- CONTINUING_CARE_COMPLIANCE: { id, name, type, operator, city, zone, lastInspectionDate, standardsCompliancePct }

## 5. Health Inequity (data-regional-inequity.json)
- COMMUNITY_NEED_PROFILES: { lgaName, zone, type, physiciansPer100k, claimsOutsideLgaPct, acscRatePer100k, deprivationIndex, medianHouseholdIncome }
- CHRONIC_DISEASE_BURDEN: { lgaName, diabetesPrevalencePct, copdPrevalencePct, hypertensionPrevalencePct, infantMortalityPer1000, lifeExpectancyYears }
- ED_RELIANCE_METRICS: { lgaName, totalEdVisitsPer1000, lowAcuityCtas45Pct, afterHoursEdPct, moodAnxietyEdRatePer100k }
- TRAVEL_FOR_CARE: { lgaName, careDeliveredOutsideLgaPct, topDestinationFacility, avgTravelDistanceKm, localBedLeakagePct }
- SERVICE_ACCESS_METRICS: { lgaName, facilitiesPer10k, distanceToNearestEdKm, distanceToNearestImagingKm, providersAcceptingPatients }

## 6. Health Spending (data-spending.json)
- NATIONAL_SPENDING_COMPARE: { province, spendingPerCapita, spendingAsPercentGdp, hospitalSpendingPerCapita, physicianSpendingPerCapita, drugSpendingPerCapita, bedsPer100k, costPerStatCase }
- ALBERTA_ACTIVITY_VOLUME_TREND: { fiscalYear, totalExpenseBillions, surgeriesCount, ctExamsCount, labTestsMillions, edVisitsMillions, hospitalAdmissions, physiciansCount }
- HOSPITAL_EFFICIENCY_TREND: { fiscalYear, spendingPerStaffedBed, hospitalizationsPerBed, surgeriesPerBed, hoursWorkedPerBed, standardStayCost }
- PHYSICIAN_SPECIALTY_BILLING: { specialtyGroup, physicianCount, totalPaymentsMillions, averagePaymentGross, servicesPerPatient }
- ALBERTA_USE_OF_FUNDS: { category, amountBillions, percentageShare }

## 7. Virtual Care (data-virtual-care.json)
- HEALTH_LINK_VOLUMES: { fiscalYear, clinicalReceived, nonClinicalReceived, clinicalOutbound, nonClinicalOutbound, padisCalls }
- VIRTUAL_MD_COHORT_STUDY: { adviceCategory, metricLabel, followThroughPct, timeframe, totalCohortSize }
- VIRTUAL_MD_DISPOSITIONS: { outcome, percentageShare, description }
- EMS_811_DIVERSION_DATA: { disposition, percentageShare, volumeProxy }
- ADJACENT_HELPLINES: { lineName, annualCalls, clinicalType, availability }
