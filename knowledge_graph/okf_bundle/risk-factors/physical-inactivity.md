---
type: Risk factor
title: Physical inactivity
description: Inactivity and cardiometabolic risk.
resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
tags:
- risk-factor
- inactivity
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
- id: wdm
  resource: https://www.who.int/news-room/fact-sheets/detail/diabetes
  title: 'WHO: Diabetes fact sheet'
- id: wht
  resource: https://www.who.int/news-room/fact-sheets/detail/hypertension
  title: 'WHO: Hypertension fact sheet'
- id: stroke
  resource: https://www.cdc.gov/stroke/risk-factors/index.html
  title: 'CDC: Stroke risk factors'
entities:
- physical_inactivity
- cvd
- diabetes
- hypertension
- stroke
claims:
- kind: risk_increase
  source: physical_inactivity
  target: cvd
  directed: true
- kind: risk_increase
  source: physical_inactivity
  target: diabetes
  directed: true
- kind: risk_increase
  source: physical_inactivity
  target: hypertension
  directed: true
- kind: risk_increase
  source: physical_inactivity
  target: stroke
  directed: true
---

- CDC: "Not getting enough physical activity can lead to heart disease."[^rf]
- WHO: not getting enough exercise contributes to type 2 diabetes.[^wdm]
- WHO lists sedentary behavior as a modifiable hypertension risk factor.[^wht]
- CDC lists physical inactivity as a stroke risk factor.[^st]

[^rf]: CDC Heart disease risk factors.
[^wdm]: WHO diabetes fact sheet.
[^wht]: WHO hypertension fact sheet.
[^st]: CDC Stroke risk factors.
