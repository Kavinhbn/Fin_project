---
type: Condition
title: Cardiovascular disease (CVD)
description: CVD as an umbrella for heart disease and stroke, as sourced from CDC.
resource: https://www.cdc.gov/heart-disease/about/index.html
tags:
- condition
- cvd
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.cdc.gov/heart-disease/about/index.html
sources:
- id: hd
  resource: https://www.cdc.gov/heart-disease/about/index.html
  title: 'CDC: About heart disease'
- id: stroke
  resource: https://www.cdc.gov/stroke/risk-factors/index.html
  title: 'CDC: Stroke risk factors'
entities:
- cvd
claims: []
---

# Definition
- CDC: "The term 'heart disease' refers to several types of heart conditions."[^hd]
- CDC lists coronary artery disease, heart attack, arrhythmia and heart failure as types of heart disease.[^hd]
- Stroke is covered on a separate CDC page.[^stroke]

# Components
- [Coronary heart disease](/conditions/coronary-heart-disease.md)
- [Heart failure](/conditions/heart-failure.md)
- [Stroke](/conditions/stroke.md)

# Scope caveat
How NHANES self-report items (coronary heart disease, angina, heart attack, heart failure, stroke) map onto this umbrella is NOT verified here; see the data_preprocessing labels and the NHANES codebooks.

[^hd]: CDC About heart disease.
[^stroke]: CDC Stroke risk factors.
