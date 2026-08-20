import { test, expect } from '@playwright/test'

test('SmartTraffic map, animated 3D twin and priority corridor work in Chromium', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'SmartTraffic Digital Twin' })).toBeVisible()
  await expect(page.locator('.real-map')).toBeVisible()
  await expect(page.locator('.leaflet-container')).toBeVisible()

  const canvas = page.locator('.twin canvas')
  await expect(canvas).toBeVisible()
  const dimensions = await canvas.evaluate(el => ({ width: el.width, height: el.height }))
  expect(dimensions.width).toBeGreaterThan(100)
  expect(dimensions.height).toBeGreaterThan(100)

  // Prove the WebGL scene is actually animating, not just a static canvas.
  const frameA = await canvas.screenshot()
  await page.waitForTimeout(700)
  const frameB = await canvas.screenshot()
  expect(Buffer.compare(frameA, frameB)).not.toBe(0)

  // Prove the POV camera changes the rendered scene.
  const birdFrame = await canvas.screenshot()
  await page.getByRole('button', { name: 'POV' }).click()
  await page.waitForTimeout(400)
  const povFrame = await canvas.screenshot()
  expect(Buffer.compare(birdFrame, povFrame)).not.toBe(0)

  // Exercise a real backend-backed priority corridor.
  await page.getByRole('button', { name: /Fire service/ }).click()
  await page.getByRole('button', { name: /Launch Fire service corridor/ }).click()

  await expect(page.locator('.schedule')).toBeVisible()
  await expect(page.locator('.schedule')).toContainText('fire')
  await expect(page.locator('.schedule')).toContainText('J1')
  await expect(page.locator('.schedule')).toContainText('J2')
  await expect(page.locator('.schedule')).toContainText('J4')

  await page.waitForTimeout(600)
  const priorityFrameA = await canvas.screenshot()
  await page.waitForTimeout(600)
  const priorityFrameB = await canvas.screenshot()
  expect(Buffer.compare(priorityFrameA, priorityFrameB)).not.toBe(0)

  await page.getByRole('button', { name: 'Predict +15 ticks' }).click()
  await expect(page.locator('.forecast-strip')).toBeVisible()
  await expect(page.locator('.forecast-strip')).toContainText('Predicted network queue')

  await page.getByRole('button', { name: 'Follow' }).click()
  await page.waitForTimeout(500)
  await expect(canvas).toBeVisible()

  expect(pageErrors).toEqual([])
})
