---
type: Diagnostic criteria
title: Blood pressure thresholds, US 130/80
description: US sources classify hypertension from 130/80 mm Hg.
resource: https://www.nhlbi.nih.gov/health/high-blood-pressure/diagnosis
tags:
- criteria
- blood-pressure
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.nhlbi.nih.gov/health/high-blood-pressure/diagnosis
sources:
- id: nhlbi
  resource: https://www.nhlbi.nih.gov/health/high-blood-pressure/diagnosis
  title: 'NHLBI: High blood pressure diagnosis'
- id: hbp
  resource: https://www.cdc.gov/high-blood-pressure/about/index.html
  title: 'CDC: About high blood pressure'
entities:
- blood_pressure
- hypertension
claims:
- kind: threshold
  source: blood_pressure
  target: hypertension
  directed: true
  detail: 'Stage 1: 130-139 systolic or 80-89 diastolic; Stage 2: 140+ or 90+'
  guideline: ACC/AHA 2017 (attribution NOT verified; NHLBI/CDC pages do not name it)
---

- NHLBI: "130 to 139 systolic pressure OR 80 to 89 diastolic pressure" for Stage 1, and "140 or higher systolic pressure OR 90 or higher diastolic pressure" for Stage 2.[^n]
- CDC: "High blood pressure is consistently at or above 130/80 mm Hg."[^c]

# Caveat
The 2017 ACC/AHA guideline (ahajournals.org) returned HTTP 403, and the NHLBI page does not name it. That these values come from ACC/AHA 2017 is therefore unverified here.

Contrast: [ESC/ESH 140/90](/criteria/bp-thresholds-140-90.md). See [hypertension](/conditions/hypertension.md).

[^n]: NHLBI High blood pressure diagnosis.
[^c]: CDC About high blood pressure.
