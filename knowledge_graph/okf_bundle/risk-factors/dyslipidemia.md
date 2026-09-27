---
type: Risk factor
title: Dyslipidemia (LDL, HDL, triglycerides)
description: Unhealthy cholesterol and triglycerides as CVD risk.
resource: https://www.cdc.gov/heart-disease/risk-factors/index.html
tags:
- risk-factor
- lipids
- ldl
- hdl
- triglycerides
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
- id: dheart
  resource: https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-heart.html
  title: 'CDC: Diabetes and your heart'
- id: stroke
  resource: https://www.cdc.gov/stroke/risk-factors/index.html
  title: 'CDC: Stroke risk factors'
entities:
- dyslipidemia
- cvd
- stroke
- ldl
- hdl
- triglycerides
claims:
- kind: risk_increase
  source: dyslipidemia
  target: cvd
  directed: true
- kind: risk_increase
  source: dyslipidemia
  target: stroke
  directed: true
---

- CDC: "Too much LDL ('bad') cholesterol in your bloodstream can form plaque on damaged artery walls."[^dh]
- CDC: "High triglycerides and low HDL ('good') cholesterol or high LDL cholesterol contributes to hardening of the arteries."[^dh]
- CDC lists unhealthy blood cholesterol as a heart disease risk factor.[^rf]
- CDC lists high cholesterol as a stroke risk factor.[^st]

No numeric lipid cut-offs were verified; none are encoded.

[^dh]: CDC Diabetes and your heart.
[^rf]: CDC Heart disease risk factors.
[^st]: CDC Stroke risk factors.
