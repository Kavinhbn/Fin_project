---
type: Risk factor
title: Obesity and BMI
description: Obesity linked to diabetes, hypertension and CVD.
resource: https://www.cdc.gov/obesity/adult-obesity-facts/index.html
tags:
- risk-factor
- obesity
- bmi
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://www.cdc.gov/obesity/adult-obesity-facts/index.html
sources:
- id: ob
  resource: https://www.cdc.gov/obesity/adult-obesity-facts/index.html
  title: 'CDC: Adult obesity facts'
- id: hbp
  resource: https://www.cdc.gov/high-blood-pressure/about/index.html
  title: 'CDC: About high blood pressure'
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
- obesity
- diabetes
- hypertension
- cvd
- stroke
- dyslipidemia
claims:
- kind: risk_increase
  source: obesity
  target: diabetes
  directed: true
- kind: risk_increase
  source: obesity
  target: hypertension
  directed: true
- kind: risk_increase
  source: obesity
  target: cvd
  directed: true
- kind: risk_increase
  source: obesity
  target: stroke
  directed: true
- kind: risk_increase
  source: obesity
  target: dyslipidemia
  directed: true
  detail: linked to higher LDL and triglycerides and lower HDL
---

- CDC: obesity is "having a body mass index (BMI) of 30.0 or higher"; 58% of US adults with obesity have high blood pressure and about 23% have diabetes.[^ob]
- CDC lists obesity as a hypertension risk condition.[^hbp]
- CDC: obesity is "linked to higher 'bad' cholesterol and triglyceride levels and to lower 'good' cholesterol levels."[^rf]
- WHO: "being overweight, not getting enough exercise, and genetics" contribute to type 2 diabetes.[^who]
- CDC lists obesity among stroke risk conditions.[^st]

BMI ranges for overweight were NOT confirmed from a fetched page.

Related: [dyslipidemia](/risk-factors/dyslipidemia.md).

[^ob]: CDC Adult obesity facts.
[^hbp]: CDC About high blood pressure.
[^rf]: CDC Heart disease risk factors.
[^who]: WHO diabetes fact sheet.
[^st]: CDC Stroke risk factors.
