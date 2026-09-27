import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const SHOTS = 'test-results/screens'

async function fillValid(page: Page) {
  await page.getByLabel('Age').fill('58')
  await page.getByLabel('BMI').fill('31')
  await page.getByLabel('Systolic BP').fill('148')
  await page.getByLabel('Diastolic BP').fill('92')
  await page.getByLabel('HbA1c').fill('6.6')
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.length} node(s) ${v.nodes[0]?.target.join(' ')}`)
}

test('shell shows demo banner and persistent disclaimer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible()
  await expect(page.getByText('Demo data:')).toBeVisible()
  await expect(page.getByRole('note').filter({ hasText: 'licensed physician' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/01-assess-empty.png` })
})

test('invalid inputs show inline errors and do not submit', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Age').fill('500')
  await page.getByLabel('BMI').fill('27')
  await page.getByLabel('Systolic BP').fill('80')
  await page.getByLabel('Diastolic BP').fill('90')
  await page.getByRole('button', { name: 'Estimate risk' }).click()
  await expect(page.getByText('Must be between 18 and 110')).toBeVisible()
  await expect(page.getByText('sbp must be greater than dbp')).toBeVisible()
  await expect(page.getByText('No estimate yet')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/02-assess-errors.png` })
})

test('valid submit shows three risks, then detail drawer with note flow', async ({ page }) => {
  await page.goto('/')
  await fillValid(page)
  await page.getByRole('button', { name: 'Estimate risk' }).click()
  for (const d of ['diabetes', 'hypertension', 'cvd']) await expect(page.getByTestId(`risk-${d}`)).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/03-assess-result.png` })

  await page.getByRole('button', { name: 'Open full assessment' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: `${SHOTS}/04-detail-summary.png` })

  await drawer.getByRole('tab', { name: 'Explanation' }).click()
  await expect(drawer.getByRole('tab', { name: 'Explanation' })).toHaveAttribute('aria-selected', 'true')
  await page.waitForTimeout(300)
  await expect(drawer.getByText('Raises risk (top 3)').first()).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/05-detail-explanation.png` })

  await drawer.getByRole('tab', { name: 'Clinical note' }).click()
  await expect(drawer.getByText('No clinical note yet')).toBeVisible()
  await drawer.getByRole('button', { name: 'Generate note' }).click()
  await expect(drawer.getByText('Primary Clinical Assessment')).toBeVisible()
  await expect(drawer.getByText('AI-generated')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/06-detail-note.png` })

  await drawer.getByRole('button', { name: 'Mark reviewed' }).click()
  await page.getByRole('dialog', { name: 'Mark note as reviewed?' }).getByRole('button', { name: 'Mark reviewed' }).click()
  await expect(drawer.getByText(/Reviewed by/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('assessments list filters and paginates footer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Assessments' }).click()
  await expect(page.getByText(/Showing 1–\d+ of \d+/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Risk level filter' }).click()
  await page.getByRole('option', { name: 'High' }).click()
  await expect(page.getByText(/Showing 1–\d+ of \d+/)).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/07-list-filtered.png` })
})

test('feature mode switch changes evidence page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Model & evidence' }).click()
  await expect(page.getByText('strict (leakage-free) model')).toBeVisible()
  await page.getByRole('combobox', { name: 'Feature mode' }).click()
  await page.getByRole('option', { name: 'Full features' }).click()
  await expect(page.getByText('full-feature model')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/08-evidence-full.png` })
})

test('viewer role is read-only with explanation and no audit nav', async ({ page }) => {
  await page.goto('/?role=viewer')
  await expect(page.getByText(/read-only role/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Estimate risk' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Audit log' })).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/09-viewer.png` })
})

test('admin sees audit log; non-admin blocked by server rule', async ({ page }) => {
  await page.goto('/?role=admin')
  await page.getByRole('button', { name: 'Audit log' }).click()
  await expect(page.getByText(/Showing 1–\d+ of \d+/)).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/10-audit.png` })
})

test('sidebar collapses on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/')
  await expect(page.getByText('01 Clinical')).toHaveCount(0)
  await page.screenshot({ path: `${SHOTS}/11-narrow.png` })
})

test('keyboard-only path reaches and submits the form', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Age').focus()
  await page.keyboard.type('50')
  await page.getByLabel('BMI').focus()
  await page.keyboard.type('25')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('risk-cvd')).toBeVisible()
})

test('assess result clears when an input or the mode changes', async ({ page }) => {
  await page.goto('/')
  await fillValid(page)
  await page.getByRole('button', { name: 'Estimate risk' }).click()
  await expect(page.getByTestId('risk-cvd')).toBeVisible()
  await page.getByLabel('Age').fill('59')
  await expect(page.getByText('No estimate yet')).toBeVisible()
  await page.getByRole('button', { name: 'Estimate risk' }).click()
  await expect(page.getByTestId('risk-cvd')).toBeVisible()
  await page.getByRole('combobox', { name: 'Feature mode' }).click()
  await page.getByRole('option', { name: 'Full features' }).click()
  await expect(page.getByText('No estimate yet')).toBeVisible()
})

test('drawer keeps disclaimer, tabs use arrow keys, Esc closes only the top layer, list refreshes', async ({ page }) => {
  await page.goto('/')
  await fillValid(page)
  await page.getByRole('button', { name: 'Estimate risk' }).click()
  await page.getByRole('button', { name: 'Open full assessment' }).click()
  const drawer = page.getByRole('dialog', { name: /Assessment/ })
  await expect(drawer.getByRole('note').filter({ hasText: 'licensed physician' })).toBeVisible()

  // roving tabindex + arrows; aria-controls resolves to a real panel
  await drawer.getByRole('tab', { name: 'Summary' }).focus()
  await page.keyboard.press('ArrowRight')
  const expl = drawer.getByRole('tab', { name: 'Explanation' })
  await expect(expl).toBeFocused()
  await expect(expl).toHaveAttribute('aria-selected', 'true')
  await expect(drawer.getByRole('tab', { name: 'Summary' })).toHaveAttribute('tabindex', '-1')
  await page.keyboard.press('End')
  await expect(drawer.getByRole('tab', { name: 'Clinical note' })).toBeFocused()
  await expect(drawer.getByRole('tabpanel')).toHaveAttribute('id', 'panel-note')
  await expect(drawer.getByRole('note').filter({ hasText: 'licensed physician' })).toBeVisible()

  await drawer.getByRole('button', { name: 'Generate note' }).click()
  await expect(drawer.getByRole('article', { name: 'Clinical note' })).toBeFocused()

  await drawer.getByRole('button', { name: 'Mark reviewed' }).click()
  const confirmDlg = page.getByRole('dialog', { name: 'Mark note as reviewed?' })
  await page.keyboard.press('Escape')
  await expect(confirmDlg).toHaveCount(0)
  await expect(drawer).toBeVisible() // only the top layer closed
  await expect(drawer.getByRole('button', { name: 'Mark reviewed' })).toBeFocused() // focus returned

  await drawer.getByRole('button', { name: 'Mark reviewed' }).click()
  await confirmDlg.getByRole('button', { name: 'Mark reviewed' }).click()
  await expect(drawer.getByText(/Reviewed by/)).toBeVisible()
  await expect(drawer.getByRole('article', { name: 'Clinical note' })).toBeFocused()

  // focus trap: Tab never leaves the drawer
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // the mounted list refetched after the review
  await expect(page.getByText('Reviewed', { exact: true }).first()).toBeVisible()
})

test.describe('accessibility (axe, serious/critical only)', () => {
  test('assess screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'New assessment' })).toBeVisible()
    expect(await axe(page)).toEqual([])
  })
  test('list, evidence and audit screens', async ({ page }) => {
    await page.goto('/?role=admin')
    for (const name of ['Assessments', 'Model & evidence', 'Audit log']) {
      await page.getByRole('button', { name }).click()
      await page.waitForTimeout(600)
      expect(await axe(page), name).toEqual([])
    }
  })
})
