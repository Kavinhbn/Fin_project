---
type: Diagnostic criteria
title: Diabetes diagnostic thresholds (HbA1c, fasting glucose)
description: HbA1c 6.5% and fasting glucose 126 mg/dL as published by CDC.
resource: https://www.cdc.gov/diabetes/diabetes-testing/index.html
tags:
- criteria
- hba1c
- glucose
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.cdc.gov/diabetes/diabetes-testing/index.html
sources:
- id: test
  resource: https://www.cdc.gov/diabetes/diabetes-testing/index.html
  title: 'CDC: Diabetes testing'
entities:
- hba1c
- fasting_glucose
- diabetes
claims:
- kind: threshold
  source: hba1c
  target: diabetes
  directed: true
  detail: A1C 6.5% or above; prediabetes 5.7-6.4%
  guideline: CDC (ADA criteria not opened directly)
- kind: threshold
  source: fasting_glucose
  target: diabetes
  directed: true
  detail: 126 mg/dL or above; prediabetes 100-125 mg/dL
  guideline: CDC (ADA criteria not opened directly)
---

# Thresholds (CDC, last reviewed May 15, 2024)
| Test | Normal | Prediabetes | Diabetes |
|---|---|---|---|
| A1C | below 5.7% | 5.7-6.4% | 6.5% or above |
| Fasting blood sugar | 99 mg/dL or below | 100-125 mg/dL | 126 mg/dL or above |

# Caveat
The ADA Standards of Care could not be fetched (HTTP 403), so the values are attributed to CDC only. Confirmation rules (repeat testing) were not verified.

See [type 2 diabetes](/conditions/type-2-diabetes.md).
