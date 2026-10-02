// Walks each BNM user story through the real UIs and saves screenshots.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/shots';
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const note = (s) => { console.log(s); log.push(s); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('dialog', d => { note('  dialog: ' + d.message()); d.accept(); });
  const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); note('  saved ' + name); };

  if (!process.env.SKIP1) {
  // ---------- Part 2: home screens ----------
  for (const [p, n] of [[10300, 'p2-guest-home'], [10301, 'p2-inventory-home'], [10302, 'p2-reporting-home']]) {
    await page.goto(`http://localhost:${p}/`); await page.waitForLoadState('networkidle'); await shot(n);
  }

  // ---------- Staff 1: Guest verification ----------
  note('STAFF 1');
  await page.goto('http://localhost:10300/'); await page.waitForLoadState('networkidle');
  const id = page.locator('input.guestIdField');
  await id.pressSequentially('AB1234567');
  note('  typed AB1234567 -> field value: ' + await id.inputValue() + ' | submit enabled: ' + await page.locator('button.submit').first().isEnabled());
  await shot('s1-a-alphanumeric-rejected');
  await id.fill(''); await id.pressSequentially('123456789');
  note('  typed 123456789 -> field value: ' + await id.inputValue());
  await shot('s1-b-nine-digits-truncated');
  await id.fill(''); await id.pressSequentially('482913');
  await shot('s1-c-six-digit-id-entered');
  await page.getByRole('button', { name: 'Add guest / record visit' }).click();
  await page.waitForTimeout(1500);
  await page.locator('select').nth(0).selectOption('commuter');
  await page.locator('select').nth(1).selectOption('UG');
  await page.locator('#grad_year').fill('2027');
  await page.locator('#year_issued').fill('2024');
  await shot('s1-d-guest-form-filled');
  await Promise.all([page.waitForEvent('load', { timeout: 10000 }).catch(() => {}), page.getByRole('button', { name: 'Submit', exact: true }).click()]);
  await page.waitForLoadState('networkidle');
  await shot('s1-e-returned-to-main-screen');
  // Returning guest: weekly visit counter
  await page.locator('input.guestIdField').pressSequentially('482913');
  await page.getByRole('button', { name: 'Add guest / record visit' }).click();
  await page.waitForTimeout(1500);
  await shot('s1-f-returning-guest-weekly-visits');

  }
  // ---------- Staff 2: Log incoming inventory ----------
  note('STAFF 2');
  await page.goto('http://localhost:10301/'); await page.waitForLoadState('networkidle');
  await page.locator('button', { hasText: /^\s*Inventory\s*$/ }).click(); await page.waitForLoadState('networkidle');
  await shot('s2-a-inventory-page');
  await page.getByRole('button', { name: 'Quick Entry' }).click();
  await page.locator('#newUPC').fill('12345');
  await page.locator('#newName').fill('Test');
  await page.locator('#newQuantity').fill('1');
  await page.getByRole('button', { name: 'add item' }).click();
  await shot('s2-b-bad-upc-format');
  // A UPC that has never been seen: is it "found"? Is there a "not found" message?
  await page.locator('#newUPC').fill('099999999999');
  await page.locator('#newName').fill('');
  await page.locator('#newQuantity').fill('');
  await page.getByRole('button', { name: 'add item' }).click();
  await shot('s2-c-unknown-upc-no-lookup');
  await page.locator('#newName').fill('Campbell Tomato Soup');
  await page.locator('#newQuantity').fill('12');
  await page.getByRole('button', { name: 'add item' }).click();
  await page.waitForTimeout(1500);
  await shot('s2-d-quick-entry-added');
  // Inventory session (batch entry)
  await page.locator('button', { hasText: 'Start Inventory Session' }).click();
  await page.getByPlaceholder('upc', { exact: true }).fill('041196910759');
  await page.getByPlaceholder('name', { exact: true }).fill('Kraft Mac and Cheese');
  await page.getByPlaceholder('quantity', { exact: true }).fill('24');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await shot('s2-e-session-item-added');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForTimeout(600);
  await shot('s2-f-session-submitted');
  await page.waitForTimeout(2000);
  await shot('s2-g-after-submit-returns-home');

  // ---------- Staff 3 / Staff 4: expired inventory ----------
  note('STAFF 3/4');
  await page.goto('http://localhost:10301/inventory'); await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Quick Entry' }).click();
  await shot('s3-a-no-expiration-field');
  const bodyText = (await page.content()).toLowerCase();
  note('  inventory page mentions "expir": ' + bodyText.includes('expir'));
  await page.goto('http://localhost:10302/'); await page.waitForLoadState('networkidle');
  note('  reporting home mentions "expir": ' + (await page.content()).toLowerCase().includes('expir'));

  // ---------- Admin 1: Guest visit report ----------
  note('ADMIN 1');
  await page.goto('http://localhost:10302/'); await page.waitForLoadState('networkidle');
  await page.locator('button', { hasText: 'Guest Reports' }).click(); await page.waitForLoadState('networkidle');
  const [s, e] = [page.locator('input.form-control').nth(0), page.locator('input.form-control').nth(1)];
  await s.fill('03-01-2026'); await e.fill('10-02-2026');
  await page.getByRole('button', { name: 'Submit' }).click(); await page.waitForTimeout(1500);
  await shot('a1-a-visit-report');
  await s.fill('01-01-2026'); await e.fill('01-31-2026');
  await page.getByRole('button', { name: 'Submit' }).click(); await page.waitForTimeout(1500);
  await shot('a1-b-no-visits-range');
  await s.fill('10-02-2026'); await e.fill('03-01-2026');
  await page.getByRole('button', { name: 'Submit' }).click(); await page.waitForTimeout(1500);
  await shot('a1-c-start-after-end');

  // ---------- Admin 2: Inventory report ----------
  note('ADMIN 2');
  await page.goto('http://localhost:10302/'); await page.waitForLoadState('networkidle');
  await page.locator('button', { hasText: 'Inventory Reports' }).click(); await page.waitForTimeout(1500);
  await shot('a2-a-inventory-reports-default');
  await page.locator('#startDate').fill('09-01-2026'); await page.locator('#endDate').fill('10-02-2026');
  await page.getByRole('button', { name: 'search' }).click(); await page.waitForTimeout(1500);
  await shot('a2-b-inventory-reports-range');

  fs.appendFileSync(OUT + '/log.txt', log.join('\n') + '\n');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
