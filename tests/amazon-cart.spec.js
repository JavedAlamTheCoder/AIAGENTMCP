require('dotenv').config();
const { test, expect } = require('@playwright/test');

const AMAZON_URL = 'https://www.amazon.com/';
const SEARCH_TERM = 'laptop';

const AMAZON_MOBILE_NUMBER = process.env.AMAZON_MOBILE_NUMBER;
const AMAZON_PASSWORD = process.env.AMAZON_PASSWORD;

if (!AMAZON_MOBILE_NUMBER || !AMAZON_PASSWORD) {
  throw new Error('Please set AMAZON_MOBILE_NUMBER and AMAZON_PASSWORD in your .env file.');
}

async function handleInterruptions(page) {
  // Check for captcha or security verification
  const captcha = page.locator('input[name="captcha"], #captchacharacters').first();
  if (await captcha.isVisible({ timeout: 5000 })) {
    console.log('Captcha detected. Pausing for manual completion.');
    await page.pause();
  }

  // Check for OTP or two-factor
  const otpInput = page.locator('input[name="otp"], input[name="code"]').first();
  if (await otpInput.isVisible({ timeout: 5000 })) {
    console.log('OTP detected. Pausing for manual completion.');
    await page.pause();
  }

  // Check for alerts
  const alert = page.locator('[role="alert"], .a-alert').first();
  if (await alert.isVisible({ timeout: 5000 })) {
    console.log('Alert detected, pausing for manual intervention.');
    await page.pause();
  }

  // Other interruptions
  const continueButton = page.locator('button, a', { hasText: 'Continue' }).first();
  if (await continueButton.isVisible({ timeout: 5000 })) {
    await continueButton.click();
    await page.waitForTimeout(2000);
  }
}

async function login(page) {
  // Click sign in
  const signInLink = page.locator('#nav-link-accountList').first();
  await expect(signInLink).toBeVisible({ timeout: 30000 });
  await signInLink.click();

  // Enter email
  const emailInput = page.locator('input[name="email"], #ap_email').first();
  await expect(emailInput).toBeVisible({ timeout: 30000 });
  await emailInput.fill(AMAZON_MOBILE_NUMBER);

  const continueBtn = page.locator('input#continue, #continue').first();
  await expect(continueBtn).toBeVisible({ timeout: 20000 });
  await continueBtn.click();

  await handleInterruptions(page);

  // Enter password
  const passwordInput = page.locator('input[name="password"], #ap_password').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
  await passwordInput.fill(AMAZON_PASSWORD);

  const signInBtn = page.locator('input#signInSubmit, #signInSubmit').first();
  await signInBtn.waitFor({ state: 'visible', timeout: 20000 });
  await signInBtn.click();

  // Wait for login success
  await page.waitForSelector('#nav-link-accountList', { timeout: 30000 });
}

test('Amazon cart flow: login, search laptop, add to cart, verify', async ({ page }) => {
  // 1. Open Amazon
  await page.goto(AMAZON_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#twotabsearchtextbox', { timeout: 30000 });

  await handleInterruptions(page);

  // 2. Login
  await login(page);

  await handleInterruptions(page);

  // 3. Search for laptop
  await page.fill('#twotabsearchtextbox', SEARCH_TERM);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.s-main-slot, [data-component-type="s-search-result"]', { timeout: 30000 });

  // 4. Select any laptop
  const productLink = page.locator('div[data-asin] h2 a').first();
  await expect(productLink).toBeVisible({ timeout: 30000 });
  await productLink.click();

  // 5. Add to cart
  await page.waitForSelector('#add-to-cart-button', { timeout: 30000 });
  const addToCartBtn = page.locator('#add-to-cart-button').first();
  await expect(addToCartBtn).toBeVisible({ timeout: 30000 });
  await addToCartBtn.click();

  // Wait for cart update
  await page.waitForTimeout(2000);

  // 6. Go to cart
  await page.goto('https://www.amazon.com/gp/cart/view.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sc-list-item, [data-name="Active Items"]', { timeout: 30000 });

  // 7. Verify laptop in cart
  const cartItem = page.locator('.sc-product-title, .a-truncate-cut').first();
  await expect(cartItem).toBeVisible({ timeout: 30000 });
  await expect(cartItem).toContainText('laptop', { ignoreCase: true });

  // Additional verification: cart count
  const cartCount = page.locator('#nav-cart-count');
  const countText = await cartCount.textContent();
  expect(parseInt(countText)).toBeGreaterThan(0);

  // Pause at end to keep browser open
  await page.pause();
});