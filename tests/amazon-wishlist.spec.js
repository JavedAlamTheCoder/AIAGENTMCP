require('dotenv').config();
const { test, expect } = require('@playwright/test');

const AMAZON_URL = 'https://www.amazon.in/';
const SEARCH_TERM = 'XIAOMI Redmi phone';

// Load credentials from environment variables
const AMAZON_MOBILE_NUMBER = process.env.AMAZON_MOBILE_NUMBER;
const AMAZON_PASSWORD = process.env.AMAZON_PASSWORD;

if (!AMAZON_MOBILE_NUMBER || !AMAZON_PASSWORD) {
  throw new Error('Please set AMAZON_MOBILE_NUMBER and AMAZON_PASSWORD in your .env file.');
}

/**
 * Handle Amazon interruption pages (traffic page, continue shopping, etc.)
 */
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

/**
 * Click on Sign In using stable locators with fallback support
 */
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

  // Fallback: hover and click inline sign-in
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

/**
 * Fill input field with value (helper function)
 */
async function fillInput(page, selector, value) {
  const field = page.locator(selector);
  await expect(field).toBeVisible({ timeout: 30000 });
  await field.fill(value);
}

/**
 * Main test: Add Xiaomi Redmi phone to Amazon list
 */
test('Add XIAOMI Redmi phone to Amazon wishlist and verify', async ({ page }) => {
  // Step 1: Navigate to Amazon India
  await page.goto(AMAZON_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#twotabsearchtextbox', { timeout: 30000 });

  // Step 2: Handle interruptions
  await handleInterruptions(page);
  await expect(page.locator('#nav-link-accountList')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/01-homepage.png' });

  // Step 3: Sign In
  await openSignIn(page);

  // Step 4: Enter mobile number
  await fillInput(page, 'input[name="email"], #ap_email', AMAZON_MOBILE_NUMBER);
  await page.screenshot({ path: 'test-results/02-email-entry.png' });

  // Step 5: Click Continue
  const continueButton = page.locator('input#continue, button:has-text("Continue"), #continue').first();
  await expect(continueButton).toBeVisible({ timeout: 20000 });
  await continueButton.click();

  // Step 6: Enter password
  await page.waitForSelector('input[name="password"], #ap_password', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/03-password-page.png' });
  await fillInput(page, 'input[name="password"], #ap_password', AMAZON_PASSWORD);

  // Step 7: Click Sign In button
  const signInButton = page.locator('input#signInSubmit, button:has-text("Sign in"), button:has-text("Sign-In"), #signInSubmit').first();
  await expect(signInButton).toBeVisible({ timeout: 20000 });
  await signInButton.click();

  // Step 8: Wait for successful login
  await page.waitForSelector('#twotabsearchtextbox', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/04-after-login.png' });

  // Step 9: Search for Xiaomi Redmi phone
  await page.fill('#twotabsearchtextbox', SEARCH_TERM);
  await page.click('input#nav-search-submit-button');
  await page.waitForSelector('div.s-main-slot, div[data-component-type="s-search-result"]', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/05-search-results.png' });

  // Step 10: Select first Redmi phone from search results
  let productItem = page.locator('div[data-component-type="s-search-result"]').first();
  let productLink = productItem.locator('h2 a, [data-component-type="s-search-result"] a[href*="/dp/"]').first();
  
  await expect(productLink).toBeVisible({ timeout: 30000 });
  await productLink.scrollIntoViewIfNeeded();
  const linkUrl = await productLink.getAttribute('href');
  console.log('Product link URL:', linkUrl);
  await productLink.click();

  // Step 11: Wait for product page to load
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.screenshot({ path: 'test-results/06-product-page.png' });

  // Step 12: Handle interruptions on product page
  await handleInterruptions(page);

  // Step 13: Click "Add to List" button (with multiple fallbacks)
  const addToListSelectors = [
    'button:has-text("Add to list")',
    'a:has-text("Add to list")',
    'button:has-text("Add to Wish List")',
    'a:has-text("Add to Wish List")',
    'button[aria-label*="Add to"], button[aria-label*="Add to list"]',
    'a[aria-label*="Add to"], a[aria-label*="Add to list"]',
    'i.a-icon-star',
  ];

  let addToListButton = null;
  for (const selector of addToListSelectors) {
    const button = page.locator(selector).first();
    if (await button.count() > 0) {
      addToListButton = button;
      console.log(`Found "Add to list" button with selector: ${selector}`);
      break;
    }
  }

  if (!addToListButton) {
    console.log('Add to list button not found, waiting longer...');
    await page.waitForTimeout(3000);
    addToListButton = page.locator('button:has-text("Add to list"), a:has-text("Add to list"), button:has-text("Add to Wish List")').first();
  }

  await expect(addToListButton).toBeVisible({ timeout: 30000 });
  await addToListButton.scrollIntoViewIfNeeded();
  await addToListButton.click();
  await page.screenshot({ path: 'test-results/07-after-add-to-list.png' });
  let addToListButton = page.locator('button:has-text("Add to list"), a:has-text("Add to list"), button[aria-label*="Add to list"], a[aria-label*="Add to list"]').first();
  
  // Fallback: Look for heart icon or wishlist button
  if (await addToListButton.count() === 0) {
    addToListButton = page.locator('i.a-icon-star, button:has-text("Add to Wish List"), a:has-text("Add to Wish List")').first();
  }

  await expect(addToListButton).toBeVisible({ timeout: 30000 });
  await addToListButton.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/07-after-add-to-list.png' });

  // Step 13: Handle list selection/creation
  let listDialog = page.locator('div[role="dialog"], div.a-popover, div.s-popover').first();
  if (await listDialog.isVisible({ timeout: 10000 })) {
    // Look for "Create List" button
    const createListButton = page.locator('button:has-text("Create"), button:has-text("New list"), a:has-text("Create list")').first();
    
    // If not found, just click the first available list or default option
    if (await createListButton.count() === 0) {
      const defaultList = page.locator('button, a', { hasText: /Wishlist|Default|Your|Cart/ }).first();
      if (await defaultList.isVisible({ timeout: 5000 })) {
        await defaultList.click();
      }
    } else {
      await createListButton.click();
      await page.waitForTimeout(1000);
      
      // If list name input appears, fill it
      const listNameInput = page.locator('input[placeholder*="list"], input[type="text"]').first();
      if (await listNameInput.isVisible({ timeout: 5000 })) {
        await listNameInput.fill('QA Automation Test List');
        const createButton = page.locator('button:has-text("Create"), button[type="submit"]').first();
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
      }
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/08-after-list-selection.png' });

  // Step 14: Navigate to "Your Lists" or Wishlist page
  await page.click('#nav-link-accountList');
  await page.waitForTimeout(1000);
  
  const yourListsLink = page.locator('a', { hasText: /Your Lists|Your Wishlist|View your lists/i }).first();
  if (await yourListsLink.isVisible({ timeout: 10000 })) {
    await yourListsLink.click();
  } else {
    // Fallback: Navigate directly to wishlist page
    await page.goto('https://www.amazon.in/gp/registry/wishlist/');
  }

  await page.waitForSelector('h1, h2, div[data-component-type*="list"], span.a-truncate', { timeout: 30000 });
  await page.screenshot({ path: 'test-results/09-wishlist-page.png' });

  // Step 15: Verify that the Redmi phone is in the list
  const productInList = page.locator('span, div', { hasText: /Redmi/i }).first();
  await expect(productInList).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'test-results/10-product-in-list-verified.png' });

  console.log('✅ XIAOMI Redmi phone successfully added to list and verified!');

  // Step 16: Keep browser open for manual verification (long wait)
  console.log('⏳ Keeping browser open for 5 minutes for manual verification...');
  await page.waitForTimeout(300000); // 5 minutes
});
