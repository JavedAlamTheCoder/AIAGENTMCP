require('dotenv').config();
const { test, expect } = require('@playwright/test');

const AMAZON_URL = 'https://www.amazon.com/';
const SEARCH_TERM = 'laptop';

const AMAZON_MOBILE_NUMBER = process.env.AMAZON_MOBILE_NUMBER;
const AMAZON_PASSWORD = process.env.AMAZON_PASSWORD;

if (!AMAZON_MOBILE_NUMBER || !AMAZON_PASSWORD) {
  throw new Error('Please set AMAZON_MOBILE_NUMBER and AMAZON_PASSWORD in your .env file.');
}

test.setTimeout(180000);

async function pauseForSecurityVerification(page) {
  const selectors = [
    'input[name="captcha"]',
    '#captchacharacters',
    'text=Enter the characters you see below',
    'input[name="otp"]',
    'input[name="code"]',
    'input[id*="auth-mfa-otpcode"]',
    'text=Security challenge',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`Security verification detected (${selector}). Pausing for manual completion.`);
      await page.pause();
      return;
    }
  }
}

async function signIn(page) {
  const accountLink = page.locator('#nav-link-accountList');
  await expect(accountLink).toBeVisible({ timeout: 30000 });
  await accountLink.click();

  const emailInput = page.locator('input[name="email"], #ap_email');
  await expect(emailInput).toBeVisible({ timeout: 30000 });
  await emailInput.fill(AMAZON_MOBILE_NUMBER);

  const continueButton = page.locator('input#continue, #continue');
  await expect(continueButton).toBeVisible({ timeout: 20000 });
  await continueButton.click();

  await pauseForSecurityVerification(page);

  const passwordInput = page.locator('input[name="password"], #ap_password');
  await expect(passwordInput).toBeVisible({ timeout: 30000 });
  await passwordInput.fill(AMAZON_PASSWORD);

  const signInButton = page.locator('input#signInSubmit, #signInSubmit');
  await expect(signInButton).toBeVisible({ timeout: 20000 });
  await signInButton.click();

  await pauseForSecurityVerification(page);
  await expect(accountLink).toBeVisible({ timeout: 30000 });
}

async function navigateToCart(page) {
  const goToCartButton = page.locator('a:has-text("Go to Cart"), a:has-text("Go to cart"), a#hlb-view-cart-announce').first();
  if (await goToCartButton.isVisible({ timeout: 15000 }).catch(() => false)) {
    await goToCartButton.click();
  } else {
    await page.goto('https://www.amazon.com/gp/cart/view.html', { waitUntil: 'domcontentloaded' });
  }

  await expect(page).toHaveURL(/\/gp\/cart\/view\.html|\/cart/, { timeout: 30000 });
  await expect(page.locator('div[data-item-type="active"]:visible, div.sc-list-item:visible').first()).toBeVisible({ timeout: 30000 });
}

test('Add fresh Amazon laptop item to cart and verify', async ({ page }) => {
  await page.goto(AMAZON_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#twotabsearchtextbox')).toBeVisible({ timeout: 30000 });

  await pauseForSecurityVerification(page);
  await signIn(page);

  await expect(page.locator('#twotabsearchtextbox')).toBeVisible({ timeout: 30000 });
  await page.fill('#twotabsearchtextbox', SEARCH_TERM);
  await page.keyboard.press('Enter');

  await expect(page.locator('[data-component-type="s-search-result"], .s-result-item')).toBeVisible({ timeout: 30000 });

  const addToCartButton = page.locator('[data-component-type="s-search-result"], .s-result-item').locator('button:has-text("Add to Cart")').first();
  await expect(addToCartButton).toBeVisible({ timeout: 30000 });
  await addToCartButton.click();

  const cartCount = page.locator('#nav-cart-count');
  await expect(cartCount).toHaveText(/\d+/, { timeout: 30000 });

  await navigateToCart(page);

  const cartItem = page.locator('div[data-item-type="active"]:visible, div.sc-list-item:visible').first();
  await expect(cartItem).toBeVisible({ timeout: 30000 });

  const cartItemText = (await cartItem.innerText()).trim();
  expect(cartItemText.length).toBeGreaterThan(0);

  await page.pause();
});
