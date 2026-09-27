---
type: Risk factor
title: Smoking
description: Tobacco use and cardiovascular risk.
resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
tags:
- risk-factor
- smoking
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
- smoking
- cvd
- stroke
- hypertension
claims:
- kind: risk_increase
  source: smoking
  target: cvd
  directed: true
- kind: risk_increase
  source: smoking
  target: stroke
  directed: true
- kind: risk_increase
  source: smoking
  target: hypertension
  directed: true
---

- CDC: smoking "increases the risk for heart disease and heart attack."[^rf]
- CDC: "Cigarette smoking can damage the heart and blood vessels" and is a stroke risk factor.[^st]
- WHO lists tobacco use as a modifiable hypertension risk factor.[^who]

[^rf]: CDC Heart disease risk factors.
[^st]: CDC Stroke risk factors.
[^who]: WHO hypertension fact sheet.
