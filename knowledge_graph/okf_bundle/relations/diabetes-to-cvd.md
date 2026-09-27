---
type: Relation
title: Diabetes increases cardiovascular risk
description: Directional association diabetes to CVD, heart failure and stroke.
resource: https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-heart.html
tags:
- relation
- diabetes
- cvd
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-heart.html
sources:
- id: dheart
  resource: https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-heart.html
  title: 'CDC: Diabetes and your heart'
- id: rf
  resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
  title: 'CDC: Heart disease risk factors'
- id: wdm
  resource: https://www.who.int/news-room/fact-sheets/detail/diabetes
  title: 'WHO: Diabetes fact sheet'
- id: stroke
  resource: https://www.cdc.gov/stroke/risk-factors/index.html
  title: 'CDC: Stroke risk factors'
entities:
- diabetes
- cvd
- heart_failure
- stroke
claims:
- kind: risk_increase
  source: diabetes
  target: cvd
  directed: true
  detail: 'CDC: people with diabetes have twice the risk for heart disease'
- kind: risk_increase
  source: diabetes
  target: heart_failure
  directed: true
- kind: risk_increase
  source: diabetes
  target: stroke
  directed: true
---

# Claims
- "People with diabetes have twice the risk for heart disease." "The longer you have diabetes, the higher your risk of heart disease."[^dh]
- "People with diabetes are also more likely to have heart failure."[^dh]
- "The risk of death from heart disease for adults with diabetes is higher than for adults who do not have diabetes."[^rf]
- WHO lists heart attack and stroke among higher-risk outcomes for people with diabetes.[^who]
- CDC lists diabetes as a stroke risk factor.[^st]

These are associations reported by CDC/WHO; the sources as fetched do not state effect sizes beyond "twice the risk".

See [type 2 diabetes](/conditions/type-2-diabetes.md), [CVD](/conditions/cardiovascular-disease.md).

[^dh]: CDC Diabetes and your heart.
[^rf]: CDC Heart disease risk factors.
[^who]: WHO diabetes fact sheet.
[^st]: CDC Stroke risk factors.
