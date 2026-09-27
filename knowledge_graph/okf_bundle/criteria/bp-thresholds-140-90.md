---
type: Diagnostic criteria
title: Blood pressure thresholds, ESC/ESH 140/90
description: ESC/ESH 2018 and WHO define hypertension as 140/90 mmHg or higher.
resource: https://academic.oup.com/eurheartj/article/39/33/3021/5079119
tags:
- criteria
- blood-pressure
- esc
timestamp: '2026-09-27T00:00:00Z'
generated:
  by: claude-code/claude-sonnet-5
  at: '2026-09-27T00:00:00Z'
status: needs_clinician_review
verified_url: https://academic.oup.com/eurheartj/article/39/33/3021/5079119
sources:
- id: esc
  resource: https://academic.oup.com/eurheartj/article/39/33/3021/5079119
  title: 2018 ESC/ESH Guidelines for the management of arterial hypertension
- id: wht
  resource: https://www.who.int/news-room/fact-sheets/detail/hypertension
  title: 'WHO: Hypertension fact sheet'
entities:
- blood_pressure
- hypertension
claims:
- kind: threshold
  source: blood_pressure
  target: hypertension
  directed: true
  detail: office SBP >=140 and/or DBP >=90 mmHg
  guideline: 2018 ESC/ESH
---

- ESC/ESH 2018: "Hypertension is defined as office SBP values >=140 mmHg and/or diastolic BP (DBP) values >=90 mmHg."[^e]
- Classification: optimal <120/<80; normal 120-129 and/or 80-84; high normal 130-139 and/or 85-89; grade 1 140-159 and/or 90-99; grade 2 160-179 and/or 100-109; grade 3 >=180 and/or >=110; isolated systolic >=140 and <90.[^e]
- WHO: hypertension is 140/90 mmHg or higher, confirmed by readings on two days.[^w]

Contrast: [US 130/80](/criteria/bp-thresholds-130-80.md). Newer ESC guidelines (e.g. 2024) were not checked.

[^e]: 2018 ESC/ESH Guidelines.
[^w]: WHO hypertension fact sheet.
