import { test, expect } from '@playwright/test'

test('SmartTraffic map, 3D twin and priority corridor work in Chromium', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'SmartTraffic Digital Twin' })).toBeVisible()
  await expect(page.locator('.real-map')).toBeVisible()
  await expect(page.locator('.leaflet-container')).toBeVisible()

  const canvas = page.locator('.twin canvas')
  await expect(canvas).toBeVisible()
  await expect.poll(async () => canvas.evaluate(el => ({ width: el.width, height: el.height }))).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }))
  const dimensions = await canvas.evaluate(el => ({ width: el.width, height: el.height }))
  expect(dimensions.width).toBeGreaterThan(100)
  expect(dimensions.height).toBeGreaterThan(100)

  await page.getByRole('button', { name: 'POV' }).click()
  await page.waitForTimeout(300)
  await expect(canvas).toBeVisible()

  await page.getByRole('button', { name: /Fire service/ }).click()
  await page.getByRole('button', { name: /Launch Fire service corridor/ }).click()

  await expect(page.locator('.schedule')).toBeVisible()
  await expect(page.locator('.schedule')).toContainText('fire')
  await expect(page.locator('.schedule')).toContainText('J1')
  await expect(page.locator('.schedule')).toContainText('J2')
  await expect(page.locator('.schedule')).toContainText('J4')

  await page.waitForTimeout(800)
  const carCount = await page.locator('.twin canvas').count()
  expect(carCount).toBe(1)

  await page.getByRole('button', { name: 'Predict +15 ticks' }).click()
  await expect(page.locator('.forecast-strip')).toBeVisible()
  await expect(page.locator('.forecast-strip')).toContainText('Predicted network queue')

  await page.getByRole('button', { name: 'Follow' }).click()
  await page.waitForTimeout(500)
  await expect(canvas).toBeVisible()

  expect(pageErrors).toEqual([])
})
