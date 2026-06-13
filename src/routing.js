import { acceptCookiesIfPresent } from './timcoBot.js';

/**
 * Ensure we are on the cart page, tick the Terms checkbox,
 * then click the Checkout button.
 *
 * Returns true if everything completed without error, false otherwise.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [logger]
 * @returns {Promise<boolean>}
 */
export async function confirmTermsAndCheckout(page, logger) {
  try {
    await page.waitForLoadState('domcontentloaded');
    
    // 1) Sanity check: are we on cart?
    const url = page.url();
    let onCart = /\/cart\b/i.test(url);
    if (!onCart) {
      const hasOrderSummary = await page
        .getByText(/order summary/i)
        .isVisible()
        .catch(() => false);
      const hasCheckoutButton = await page
        .getByRole('button', { name: /checkout/i })
        .isVisible()
        .catch(() => false);
      onCart = hasOrderSummary && hasCheckoutButton;
    }
    
    if (!onCart) {
      logger?.error?.('Not on cart page – cannot proceed to checkout', { url });
      return false;
    }
    
    logger?.step?.('On cart page, confirming terms and proceeding to checkout', { url });
    
    // 2) Cookie banner can re-appear; clear it if needed
    await acceptCookiesIfPresent(page, logger);
    
    // 3) Locate checkbox and scroll it into view
    const terms = page.locator('input#termsofservice[type="checkbox"]');
    await terms.waitFor({ timeout: 10000 });
    
    // CRITICAL: Scroll the checkbox into view first
    logger?.step?.('Scrolling terms checkbox into view');
    await terms.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Give the page a moment to settle after scroll
    
    let checked = await terms.isChecked();
    logger?.info?.('Terms checkbox state before', { checked });
    
    if (!checked) {
      // First attempt: Click the label (most reliable for custom checkboxes)
      logger?.step?.('Clicking label[for="termsofservice"]');
      const label = page.locator('label[for="termsofservice"]');
      await label.scrollIntoViewIfNeeded();
      await label.click({ force: true });
      await page.waitForTimeout(500);
      checked = await terms.isChecked();
    }
    
    if (!checked) {
      // Second attempt: Click the span.checkmark (custom checkbox visual element)
      try {
        logger?.step?.('Clicking span.checkmark element');
        const checkmark = page.locator('label[for="termsofservice"] span.checkmark');
        await checkmark.click({ force: true });
        await page.waitForTimeout(500);
        checked = await terms.isChecked();
      } catch (e) {
        logger?.error?.('Checkmark span click failed', { error: String(e) });
      }
    }
    
    if (!checked) {
      // Third attempt: Add the 'completed' class that the site uses
      logger?.step?.('Adding "completed" class and setting checked state');
      await terms.evaluate((el) => {
        el.checked = true;
        el.classList.add('completed');
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(500);
      checked = await terms.isChecked();
    }
    
    // Verify the 'completed' class is present
    const hasCompletedClass = await terms.evaluate((el) => el.classList.contains('completed'));
    logger?.info?.('Terms checkbox state after attempts', { checked, hasCompletedClass });
    
    // Check if either the checkbox is checked OR has the completed class
    if (!checked && !hasCompletedClass) {
      logger?.error?.('Checkbox not checked and no "completed" class after all attempts – aborting');
      return false;
    }
    
    if (!checked && hasCompletedClass) {
      logger?.info?.('Checkbox has "completed" class but not checked property - proceeding anyway');
    }
    
    // 4) Click Checkout
    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.waitFor({ timeout: 10000 });
    
    // Ensure checkout button is also in view
    await checkoutButton.scrollIntoViewIfNeeded();
    
    logger?.step?.('Clicking Checkout button');

    await Promise.all([
        page.waitForLoadState('networkidle'),
        checkoutButton.click()
      ]);

    // await Promise.all([
    //   // URL often becomes /checkout or similar; if not, this will just time out quietly
    //   page.waitForURL(/checkout/i, { timeout: 30000 }).catch(() => null),
    //   checkoutButton.click(),
    // ]);
    
    logger?.info?.('Checkout click completed', { newUrl: page.url() });
    return true;
    
  } catch (err) {
    logger?.error?.('Failed in confirmTermsAndCheckout', {
      error: String(err),
      url: page.url(),
    });
    return false;
  }
}

/**
 * Normal case: click Create Order → cart page loads
 * Alternate case: modal appears → click Create Order in modal → cart page
 * Boolean return (true on success, false on failure)
 * Optional logger
 * Assumes you are already on the summary page.
 * @param {import('@playwright/test').Page} page 
 * @param {import ('src/logger.js');} logger 
 * @returns {Promise<boolean>}
 */

export async function goFromSummaryToCart(page, logger) {
  try {
    logger?.step?.('On summary page – clicking primary "Create Order"');

    // 1) Click the main Create Order button on the summary page
    const mainCreateBtn = page.getByRole('button', { name: /^create order$/i });
    await mainCreateBtn.waitFor({ timeout: 15000 });
    await mainCreateBtn.click();

    // 2) After click, either:
    //    a) we go straight to cart, or
    //    b) a confirm modal appears asking to empty cart first.

    let modalVisible = false;
    try {
      // Look for the confirm text that appears in the modal
      await page.getByText(/your cart will be emptied/i).waitFor({ timeout: 3000 });
      modalVisible = true;
      logger?.step?.('Confirm modal detected after Create Order click');
    } catch {
      modalVisible = false;
      logger?.step?.('No confirm modal detected, waiting for cart directly');
    }

    if (modalVisible) {
      // 3) Click "Create Order" inside the modal
      const modalCreateBtn = page.getByRole('button', { name: /^create order$/i }).last();

      logger?.step?.('Clicking "Create Order" inside confirm modal');
      await Promise.all([
        page.waitForLoadState('networkidle'),
        modalCreateBtn.click()
      ]);
    } else {
      // No modal – just wait for network calm down
      await page.waitForLoadState('networkidle');
    }

    // 4) Wait for cart page
    try {
      await page.waitForURL(/cart|basket/i, { timeout: 15000 });
    } catch {
      // Fallback: look for some cart/basket text
      await page.waitForSelector(/Basket|Cart/i, { timeout: 5000 });
    }

    const currentUrl = page.url();
    logger?.info?.('Reached cart page after Create Order flow', { url: currentUrl });

    return true;
  } catch (err) {
    logger?.error?.('Failed to go from summary to cart', { error: String(err) });
    return false;
  }
}