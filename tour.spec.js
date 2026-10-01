import { test, expect } from '@playwright/test';

async function openTour(page) {
  await page.goto('/');
  await expect(page.locator('#viewer-shell')).toHaveAttribute('data-loaded', 'true');
}

test('loads the panorama and three detail hotspots without script errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openTour(page);
  await expect(page).toHaveTitle('Living Room — Inhabit');
  await expect(page.locator('.room-hotspot')).toHaveCount(3);
  expect(await page.locator('canvas').evaluate((canvas) => canvas.width)).toBeGreaterThan(1000);
  await expect(page.locator('#zoom-readout')).toHaveText('1.0×');
  await page.screenshot({ path: test.info().outputPath('desktop.png') });
  expect(errors).toEqual([]);
});

test('supports dragging and keyboard navigation', async ({ page }) => {
  await openTour(page);
  const bounds = await page.locator('#panorama').boundingBox();
  const initial = await page.locator('#direction').textContent();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.4, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('#direction')).not.toHaveText(initial);
  await expect(page.locator('#welcome-note')).toBeHidden();
  await page.locator('#panorama').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#direction')).toHaveText('000°');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#direction')).toHaveText('010°');
  await page.keyboard.press('+');
  await expect(page.locator('#zoom-readout')).toHaveText('1.1×');
});

test('clamps zoom at both limits and resets', async ({ page }) => {
  await openTour(page);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('#zoom-in')).toBeDisabled();
  await expect(page.locator('#zoom-readout')).toHaveText('1.9×');
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(page.locator('#zoom-out')).toBeDisabled();
  await expect(page.locator('#zoom-readout')).toHaveText('0.9×');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(page.locator('#zoom-readout')).toHaveText('1.0×');
  await expect(page.locator('#zoom-in')).toBeEnabled();
  await expect(page.locator('#zoom-out')).toBeEnabled();
});

test('opens all detail panels and resets from the room card', async ({ page }) => {
  await openTour(page);
  for (const [key, title] of [['media', 'Media wall'], ['bar', 'Breakfast bar'], ['lounge', 'The lounge']]) {
    await page.locator(`[data-detail="${key}"]`).click();
    await expect(page.locator('#detail-title')).toHaveText(title);
    await expect(page.locator('#detail-panel')).toBeVisible();
    await expect(page.locator(`[data-detail="${key}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#detail-panel')).toBeHidden();
  }
  await page.locator('[data-detail="bar"]').click();
  await page.locator('#scene-home').click();
  await expect(page.locator('#detail-panel')).toBeHidden();
  await expect(page.locator('#direction')).toHaveText('000°');
  await expect(page.locator('#zoom-readout')).toHaveText('1.0×');
});

test('hotspots work with pointer and keyboard', async ({ page }) => {
  await openTour(page);
  await page.locator('[data-hotspot="bar"]').click();
  await expect(page.locator('#detail-title')).toHaveText('Breakfast bar');
  await page.locator('#close-detail').click();
  await expect(page.locator('#detail-panel')).toBeHidden();
  await page.locator('[data-hotspot="bar"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-title')).toHaveText('Breakfast bar');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-hotspot="bar"]')).toBeFocused();
});

test('automatic rotation starts and pauses on interaction', async ({ page }) => {
  await openTour(page);
  await page.locator('#auto-rotate').click();
  await expect(page.locator('#auto-rotate')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#direction')).not.toHaveText('000°');
  await page.locator('#auto-rotate').click();
  await expect(page.locator('#auto-rotate')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#auto-rotate').click();
  await page.locator('#panorama').click({ position: { x: 90, y: 170 } });
  await expect(page.locator('#auto-rotate')).toHaveAttribute('aria-pressed', 'false');
});

test('tour information explains limitations and closes correctly', async ({ page }) => {
  await openTour(page);
  await page.locator('#about-tour').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.source-note')).toContainText('not a walk-through or 3D model');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('#help').click();
  await page.locator('#start-exploring').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#panorama')).toBeFocused();
});

test('can enter and exit fullscreen', async ({ page }) => {
  await openTour(page);
  await page.locator('#fullscreen').click();
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-label', 'Exit fullscreen');
  expect(await page.evaluate(() => document.fullscreenElement?.id)).toBe('viewer-shell');
  await page.locator('#fullscreen').click();
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-label', 'Enter fullscreen');
});

test('mobile viewport supports touch hotspots and stays within the screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('#viewer-shell')).toHaveAttribute('data-loaded', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.locator('#zoom-in')).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('mobile.png') });
  await page.locator('[data-hotspot="bar"]').tap();
  await expect(page.locator('#detail-title')).toHaveText('Breakfast bar');
  await page.locator('#close-detail').tap();
  await page.locator('#reset-view').tap();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 285, y: 350 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 130, y: 350 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#direction')).not.toHaveText('000°');
  await page.locator('#help').tap();
  await expect(page.locator('#start-exploring')).toBeInViewport();
  await context.close();
});

test('small landscape screen keeps controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openTour(page);
  await expect(page.locator('#zoom-in')).toBeInViewport();
  await expect(page.locator('#fullscreen')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(390);
});

test('a failed panorama shows an error rather than an endless loader', async ({ page }) => {
  await page.route('**/images/living-room.webp', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.pnlm-error-msg')).toBeVisible();
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#zoom-in')).toBeDisabled();
});
