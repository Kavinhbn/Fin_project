// ─── Help content: plain-language explanations of every field, badge and metric in the app ───
// Kept as data (not JSX) so it's easy to scan, review and keep accurate as the app changes.

export interface Term {
  name: string
  plain: string
  why?: string
  technical?: string
}

export const FIELD_GLOSSARY: readonly Term[] = [
  { name: 'Age', plain: 'How many years old the patient is.', why: 'Risk of all three conditions rises with age, on its own and combined with other factors.' },
  { name: 'Sex', plain: 'Male or female, as recorded on the checkup.', why: 'Average risk levels and typical warning signs differ somewhat by sex.' },
  { name: 'BMI', plain: 'Body Mass Index — a simple number from weight and height that estimates body fat.', why: 'A higher BMI is linked to higher risk of all three conditions.', technical: 'kg of weight divided by height in metres, squared' },
  { name: 'Systolic BP', plain: 'The top (higher) number in a blood pressure reading — the pressure when the heart beats.', why: 'Directly used to judge hypertension risk in "Full features" mode; a core measurement.', technical: 'mmHg, e.g. the "120" in "120/80"' },
  { name: 'Diastolic BP', plain: 'The bottom (lower) number in a blood pressure reading — the pressure when the heart rests between beats.', why: 'Same role as systolic BP: a core hypertension measurement.', technical: 'mmHg, e.g. the "80" in "120/80"' },
  { name: 'Fasting glucose', plain: 'Blood sugar level measured after not eating for several hours (usually overnight).', why: 'One of the two standard lab tests used to diagnose diabetes.', technical: 'mg/dL' },
  { name: 'HbA1c', plain: 'A blood test that shows the average blood sugar level over the past 2–3 months, not just right now.', why: 'The other standard diabetes test — more stable than a single glucose reading.', technical: '"glycated haemoglobin", measured as a %' },
  { name: 'Total cholesterol', plain: 'The overall amount of cholesterol (a fat-like substance) in the blood.', why: 'High cholesterol is a well-known contributor to heart disease.', technical: 'mg/dL' },
  { name: 'HDL', plain: 'The "good" cholesterol — it actually helps clear other cholesterol out of the blood.', why: 'Low HDL raises heart disease risk even if total cholesterol looks normal.', technical: 'High-Density Lipoprotein, mg/dL' },
  { name: 'LDL', plain: 'The "bad" cholesterol — it\'s the kind that builds up in artery walls.', why: 'High LDL is one of the strongest lab predictors of heart disease.', technical: 'Low-Density Lipoprotein, mg/dL' },
  { name: 'Triglycerides', plain: 'Another type of fat carried in the blood, separate from cholesterol.', why: 'High levels are linked to both diabetes and heart disease risk.', technical: 'mg/dL' },
  { name: 'Smoking', plain: 'Whether the patient currently smokes, used to smoke regularly, or has never smoked.', why: 'One of the single biggest controllable risk factors for heart disease.' },
  { name: 'Race / ethnicity', plain: 'A demographic category from the checkup record.', why: 'Some conditions have different average rates across groups in the population data the model was trained on; including it measurably improves the model\'s accuracy.' },
  { name: 'Education', plain: 'Highest level of school completed.', why: 'Correlates with lifestyle and healthcare-access patterns that affect risk; adding it improved the model\'s accuracy in testing.' },
  { name: 'Income-to-poverty ratio', plain: 'A number showing how a household\'s income compares to the official poverty line for its size — 1.0 means exactly at the line, higher means wealthier.', why: 'Financial stress is linked to worse health outcomes; this is capped at 5 in the data (anything 5x the poverty line or above is just recorded as 5).' },
  { name: 'Regular vigorous activity', plain: 'Whether the patient regularly does hard exercise — the kind that gets you breathing heavily (running, heavy lifting, fast cycling).' },
  { name: 'Regular alcohol use', plain: 'Whether the patient has had 12 or more alcoholic drinks in the past year.' },
]

export const BADGE_GLOSSARY: readonly Term[] = [
  { name: 'Low / Moderate / High', plain: 'The model\'s best-guess risk level for this patient, based on the estimated probability.' },
  { name: 'Uncertain', plain: 'The model is telling you it genuinely isn\'t confident either way for this patient, and would rather say "I don\'t know" than guess.', why: 'This uses a method called conformal prediction: instead of always giving one answer, the model checks whether both "has it" and "doesn\'t have it" are still plausible given how well it performed on similar cases before. If both are plausible, it flags Uncertain rather than picking one. A patient can be both "High" (the raw probability leans that way) and "Uncertain" (the model can\'t rule out the opposite) at the same time — that\'s not a contradiction, it\'s the model being honest about the limits of its own confidence.' },
  { name: 'Interval', plain: 'A range around the percentage showing how much that number could reasonably wobble, based on how the model performed on data it wasn\'t trained on.' },
  { name: 'AI-generated', plain: 'This note\'s text was written by the app, not typed by a person.' },
  { name: 'Verified', plain: 'Every sentence in the note was checked against the model\'s actual numbers (and, for cross-disease claims, against a small medical reference) before being shown. Nothing here was just invented.' },
  { name: 'Flagged', plain: 'Something the note-writer tried to say didn\'t match the model\'s numbers, so it was removed and listed separately instead of silently shown as fact.' },
  { name: 'Awaiting review / Reviewed', plain: 'Whether a clinician has signed off on this note yet. The app never treats its own output as final — a person has to review it.' },
]

export const EXPLANATION_GLOSSARY: readonly Term[] = [
  { name: '"Raises risk" / "Lowers risk" bars', plain: 'For each disease, the top few things pushing this specific patient\'s number up, and the top few pulling it down, compared to a typical adult.', why: 'Figures are in "percentage points" — e.g. "+7 pts" means that factor alone accounts for roughly 7 percentage points of this patient\'s estimated risk.' },
  { name: 'Direct / Through diabetes / Through hypertension', plain: 'For cardiovascular disease (CVD) specifically, the app splits the estimate into three parts: risk that comes straight from the patient\'s own numbers (Direct), risk that flows in because the patient is likely diabetic (Through diabetes), and risk that flows in because they\'re likely hypertensive (Through hypertension).', why: 'This is a model-based estimate of how the three conditions interact, not a proven medical fact about causation — it shows what the model is doing, not a guarantee of what\'s biologically happening in this patient.' },
]

export const METRIC_GLOSSARY: readonly Term[] = [
  { name: 'Macro AUROC', plain: 'How well the model can tell apart people who truly have a condition from people who don\'t, averaged across all three diseases.', why: '0.50 = no better than a coin flip. 1.00 = perfect. This model scores around 0.82–0.90 depending on the mode — solidly useful, not perfect.' },
  { name: 'Macro F1', plain: 'A single score balancing two things: when the model says "at risk", how often is it right, and out of everyone truly at risk, how many did it actually catch. Averaged across the three diseases.' },
  { name: 'Calibration error (ECE)', plain: 'Whether "70% risk" really means about 70 out of 100 similar patients turn out to have the condition. A lower number is better — it means the percentages can be trusted at face value.' },
  { name: 'Conformal coverage', plain: 'How often the model\'s "confident" answers (Low/Moderate/High, not Uncertain) actually turn out correct, measured on real patients the model never trained on. This is set up so it should be right about 90% of the time when it is confident.' },
  { name: 'Calibration chart', plain: 'A graph comparing the risk percentage the model predicted against how often that risk actually showed up in real patients. A perfect model would trace the dashed diagonal line exactly.' },
  { name: 'Baseline comparison', plain: 'How this model stacks up against several standard alternatives (plain logistic regression, Random Forest, LightGBM, CatBoost, and others) on the same patients, so you can see it isn\'t cherry-picked to look good against nothing.' },
  { name: 'Subgroup performance', plain: 'The same accuracy numbers, but broken out by group — sex, age band, ethnicity — so it\'s visible if the model works noticeably worse for any particular group of people.' },
]
