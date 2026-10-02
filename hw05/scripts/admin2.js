const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const shot = async n => { await p.waitForTimeout(800); await p.screenshot({ path: `shots/${n}.png`, fullPage: true }); console.log('saved', n); };
  await p.goto('http://localhost:10302/inventoryReports'); await p.waitForTimeout(1500);
  await p.locator('#startDate').fill('09-01-2026'); await p.locator('#endDate').fill('10-02-2026');
  await p.locator('button', { hasText: 'search' }).click(); await shot('a2-c-report-list-with-snapshot');
  await p.locator('a', { hasText: '10-02-2026' }).click(); await shot('a2-d-report-detail');
  await p.goto('http://localhost:10302/inventoryReports'); await p.waitForTimeout(1000);
  await p.locator('#startDate').fill('10-02-2026'); await p.locator('#endDate').fill('10-02-2026');
  await p.locator('button', { hasText: 'search' }).click(); await shot('a2-e-single-day-range');
  await b.close();
})();
