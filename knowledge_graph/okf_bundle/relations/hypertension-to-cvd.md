---
type: Relation
title: Hypertension increases cardiovascular risk
description: Directional association hypertension to CVD, heart failure and stroke.
resource: https://www.cdc.gov/high-blood-pressure/about/index.html
tags:
- relation
- hypertension
- cvd
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.cdc.gov/high-blood-pressure/about/index.html
sources:
- id: hbp
  resource: https://www.cdc.gov/high-blood-pressure/about/index.html
  title: 'CDC: About high blood pressure'
- id: wht
  resource: https://www.who.int/news-room/fact-sheets/detail/hypertension
  title: 'WHO: Hypertension fact sheet'
- id: rf
  resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
  title: 'CDC: Heart disease risk factors'
- id: stroke
  resource: https://www.cdc.gov/stroke/risk-factors/index.html
  title: 'CDC: Stroke risk factors'
entities:
- hypertension
- cvd
- heart_failure
- stroke
claims:
- kind: risk_increase
  source: hypertension
  target: cvd
  directed: true
- kind: risk_increase
  source: hypertension
  target: heart_failure
  directed: true
- kind: risk_increase
  source: hypertension
  target: stroke
  directed: true
---

# Claims
- "The higher your blood pressure levels, the more risk you have for other health problems, such as heart disease, heart attack, and stroke."[^hbp]
- Hypertension can trigger heart attacks, heart failure and strokes by damaging arteries.[^hbp]
- WHO: uncontrolled hypertension can cause angina, heart attack and heart failure, and can "burst or block arteries that supply blood and oxygen to the brain, causing a stroke."[^who]
- CDC: "High blood pressure is a major risk factor for heart disease."[^rf]

See [hypertension](/conditions/hypertension.md), [CVD](/conditions/cardiovascular-disease.md).

[^hbp]: CDC About high blood pressure.
[^who]: WHO hypertension fact sheet.
[^rf]: CDC Heart disease risk factors.
