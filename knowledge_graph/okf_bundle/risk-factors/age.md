---
type: Risk factor
title: Age
description: Age as a non-modifiable risk factor.
resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
tags:
- risk-factor
- age
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.cdc.gov/heart-disease/risk-factors/index.html
sources:
- id: rf
  resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
  title: 'CDC: Heart disease risk factors'
- id: stroke
  resource: https://www.cdc.gov/stroke/risk-factors/index.html
  title: 'CDC: Stroke risk factors'
- id: wht
  resource: https://www.who.int/news-room/fact-sheets/detail/hypertension
  title: 'WHO: Hypertension fact sheet'
entities:
- age
- cvd
- stroke
- hypertension
claims:
- kind: risk_increase
  source: age
  target: cvd
  directed: true
- kind: risk_increase
  source: age
  target: stroke
  directed: true
- kind: risk_increase
  source: age
  target: hypertension
  directed: true
---

- CDC heart disease: "the risk goes up as you age."[^rf]
- CDC stroke: risk "doubles every 10 years after age 55."[^st]
- WHO lists advanced age (65+) as a non-modifiable hypertension risk factor.[^who]

[^rf]: CDC Heart disease risk factors.
[^st]: CDC Stroke risk factors.
[^who]: WHO hypertension fact sheet.
