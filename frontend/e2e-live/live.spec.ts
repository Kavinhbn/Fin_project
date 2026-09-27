import { expect, test } from '@playwright/test'

test('UI talks to the real backend end to end', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible()
  await expect(page.getByText(/Research prototype/)).toBeVisible()
  await expect(page.getByText('Demo data:')).toHaveCount(0)
  await expect(page.getByRole('note').filter({ hasText: 'licensed physician' })).toBeVisible()

  await page.getByLabel('Age').fill('58')
  await page.getByLabel('BMI').fill('31')
  await page.getByLabel('Systolic BP').fill('148')
  await page.getByLabel('Diastolic BP').fill('92')
  await page.getByRole('button', { name: 'Estimate risk' }).click()
  for (const d of ['diabetes', 'hypertension', 'cvd']) await expect(page.getByTestId(`risk-${d}`)).toBeVisible()

  await page.getByRole('button', { name: 'Open full assessment' }).click()
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('tab', { name: 'Clinical note' }).click()
  await drawer.getByRole('button', { name: 'Generate note' }).click()
  await expect(drawer.getByText('Primary Clinical Assessment')).toBeVisible()
  await expect(drawer.getByText(/claims verified/)).toBeVisible()
  await drawer.getByRole('button', { name: 'Mark reviewed' }).click()
  await page.getByRole('dialog', { name: 'Mark note as reviewed?' }).getByRole('button', { name: 'Mark reviewed' }).click()
  await expect(drawer.getByText(/Reviewed by dev@example.org/)).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/live-note.png' })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Assessments' }).click()
  await expect(page.getByText(/Showing 1–1 of 1/)).toBeVisible()

  await page.getByRole('button', { name: 'Model & evidence' }).click()
  await expect(page.getByText('Macro AUROC')).toBeVisible()
  await expect(page.getByText(/Conformal coverage/)).toBeVisible()
})
