---
type: Relation
title: Diabetes and hypertension co-occurrence
description: Diabetes as a hypertension risk factor and the joint effect on heart
  disease.
resource: https://www.cdc.gov/high-blood-pressure/about/index.html
tags:
- relation
- diabetes
- hypertension
- comorbidity
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
- id: dheart
  resource: https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-heart.html
  title: 'CDC: Diabetes and your heart'
- id: wht
  resource: https://www.who.int/news-room/fact-sheets/detail/hypertension
  title: 'WHO: Hypertension fact sheet'
entities:
- diabetes
- hypertension
claims:
- kind: association
  source: diabetes
  target: hypertension
  directed: false
  detail: CDC discusses adults with diabetes, high blood pressure, or both
- kind: risk_increase
  source: diabetes
  target: hypertension
  directed: true
  detail: CDC lists diabetes as a health condition that increases hypertension risk
---

# Claims
- CDC lists diabetes among health conditions that increase the risk of high blood pressure.[^hbp]
- WHO lists comorbidities such as diabetes or kidney disease as hypertension risk factors.[^who]
- CDC: "Having both high blood pressure and diabetes can greatly increase your risk for heart disease."[^dh]
- CDC: "Adults with diabetes, high blood pressure, or both have a higher risk of developing chronic kidney disease."[^hbp]

# Not established here
The fetched sources do not give a co-occurrence prevalence, and no source opened here states that hypertension causes diabetes; that direction is deliberately not encoded.

See [diabetes](/conditions/type-2-diabetes.md), [hypertension](/conditions/hypertension.md), [diabetes to CVD](/relations/diabetes-to-cvd.md).

[^hbp]: CDC About high blood pressure.
[^who]: WHO hypertension fact sheet.
[^dh]: CDC Diabetes and your heart.
