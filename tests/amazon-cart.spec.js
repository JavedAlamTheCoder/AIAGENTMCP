require('dotenv').config();
const { test, expect } = require('@playwright/test');

const AMAZON_URL = 'https://www.amazon.in/';
const SEARCH_TERM = 'iPhone X';

const AMAZON_MOBILE_NUMBER = process.env.AMAZON_MOBILE_NUMBER;
const AMAZON_PASSWORD = process.env.AMAZON_PASSWORD;

if (!AMAZON_MOBILE_NUMBER || !AMAZON_PASSWORD) {
  throw new Error('Please set AMAZON_MOBILE_NUMBER and AMAZON_PASSWORD in your .env file.');
}

async function handleInterruptions(page) {
  const trafficLink = page.locator('a', { hasText: 'Go to the Amazon.in home page to continue shopping' }).first();
  if (await trafficLink.isVisible({ timeout: 5000 })) {
    await trafficLink.click();
    await page.waitForSelector('#nav-link-accountList', { timeout: 30000 });
    return;
  }

  const continueShoppingButton = page.locator('button, a', { hasText: 'Continue shopping' }).first();
  if (await continueShoppingButton.isVisible({ timeout: 5000 })) {
    await continueShoppingButton.click();
    await page.waitForSelector('#nav-link-accountList', { timeout: 30000 });
  }
}

async function openSignIn(page) {
  const signInTrigger = page.locator('#nav-link-accountList, [data-nav-role="signin"]').first();
  await expect(signInTrigger).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/before-signin-click.png' });
  await signInTrigger.click();

  await page.waitForTimeout(2000);

  const emailInput = page.locator('input[name="email"], #ap_email');
  if (await emailInput.isVisible({ timeout: 5000 })) {
    return;
  }

  const hoverTrigger = page.locator('#nav-link-accountList');
  if (await hoverTrigger.isVisible({ timeout: 5000 })) {
    await hoverTrigger.hover();
    const inlineSignIn = page.locator('a, span, button', { hasText: /Sign in/i }).first();
    if (await inlineSignIn.isVisible({ timeout: 5000 })) {
      await inlineSignIn.click();
      await page.waitForTimeout(2000);
    }
  }
}

async function fillInput(page, selector, value) {
  const field = page.locator(selector);
  await expect(field).toBeVisible({ timeout: 30000 });
  await field.fill(value);
}

test('Amazon sign-in, search iPhone X, add to cart, and verify', async ({ page }) => {
  await page.goto(AMAZON_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#twotabsearchtextbox', { timeout: 30000 });

  await handleInterruptions(page);
  await expect(page.locator('#nav-link-accountList')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/homepage.png' });

  await openSignIn(page);

  await fillInput(page, 'input[name="email"], #ap_email', AMAZON_MOBILE_NUMBER);
  await page.screenshot({ path: 'test-results/email-entry.png' });

  const continueButton = page.locator('input#continue, button:has-text("Continue"), #continue').first();
  await expect(continueButton).toBeVisible({ timeout: 20000 });
  await continueButton.click();

  await page.waitForSelector('input[name="password"], #ap_password', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/password-page.png' });
  await fillInput(page, 'input[name="password"], #ap_password', AMAZON_PASSWORD);

  const signInButton = page.locator('input#signInSubmit, button:has-text("Sign in"), button:hasText("Sign-In"), #signInSubmit').first();
  await expect(signInButton).toBeVisible({ timeout: 20000 });
  await signInButton.click();

  await page.waitForSelector('#twotabsearchtextbox', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/after-login.png' });

  await page.fill('#twotabsearchtextbox', SEARCH_TERM);
  await page.click('input#nav-search-submit-button');
  await page.waitForSelector('div.s-main-slot, div[data-component-type="s-search-result"]', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/search-results.png' });

  let productItem = page.locator('div[data-component-type="s-search-result"]', { hasText: /iPhone/i }).first();
  if (await productItem.count() === 0) {
    productItem = page.locator('div[data-component-type="s-search-result"]').first();
  }

  const productLink = productItem.locator('h2 a').first();
  await expect(productLink).toBeVisible({ timeout: 30000 });
  await productLink.scrollIntoViewIfNeeded();
  await productLink.click();

  await page.waitForSelector('#add-to-cart-button', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/product-page.png' });

  const addToCartButton = page.locator('#add-to-cart-button');
  await expect(addToCartButton).toBeVisible({ timeout: 30000 });
  await addToCartButton.click();

  await page.waitForSelector('#nav-cart-count', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/added-to-cart.png' });

  await page.goto('https://www.amazon.in/gp/cart/view.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('div.sc-list-body, span.a-truncate-cut, span.sc-product-title', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/cart-page.png' });

  const cartItem = page.locator('span.a-truncate-cut, span.sc-product-title', { hasText: SEARCH_TERM }).first();
  await expect(cartItem).toBeVisible({ timeout: 30000 });
  await expect(cartItem).toContainText('iPhone X');

  const cartCount = page.locator('#nav-cart-count');
  await expect(cartCount).toHaveText(/^[1-9]\d*$/);
  await page.screenshot({ path: 'test-results/final-verification.png' });
});