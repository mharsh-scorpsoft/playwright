// src/timcoBot.js

/**
 * Accept the cookie banner if it is visible.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function acceptCookiesIfPresent(page) {
  // Button label appears as "ACCEPT ALL" in your screenshot
  const acceptButton = page.getByRole("button", { name: /accept all/i });

  if (await acceptButton.isVisible().catch(() => false)) {
    console.log('🍪 Cookie banner visible – clicking "ACCEPT ALL"');
    await acceptButton.click();
    // small pause so layout can settle
    await page.waitForTimeout(500);
  } else {
    console.log("🍪 No cookie banner visible");
  }
}

/**
 * Perform login on timco.co.uk using credentials from .env
 *
 * @param {import('@playwright/test').Page} page
 */

export async function loginTimco(page) {
  const email = process.env.TIMCO_EMAIL;
  const password = process.env.TIMCO_PASSWORD;
  const accountName = process.env.TIMCO_ACCOUNT_NAME || "Scott Sandeman";

  if (!email || !password) {
    throw new Error(
      "TIMCO_EMAIL or TIMCO_PASSWORD is not set in environment (.env)"
    );
  }

  // 1. Open login page
  await page.goto("https://timco.co.uk/login", {
    waitUntil: "domcontentloaded",
  });

  // 2. Handle cookie popup if present
  await acceptCookiesIfPresent(page);

  // 3. Fill login form
  await page.fill(
    'input[type="email"], input[name="Email"], input[name="email"]',
    email
  );
  await page.fill(
    'input[type="password"], input[name="Password"], input[name="password"]',
    password
  );

  // 4. Click the "Log in" button explicitly by its label
  const loginButton = page.getByRole("button", { name: /log in/i });

  await Promise.all([
    page.waitForLoadState("networkidle"),
    loginButton.click(),
  ]);

  // 5. Wait for something that indicates we are logged in
  // Prefer "Sign Out"; fall back to account name
  try {
    await page.waitForSelector("text=Sign Out", { timeout: 15000 });
    console.log('✅ Logged in – "Sign Out" link found');
    return true;
  } catch {
    // If "Sign Out" was not found, try account name
    try {
      await page.waitForSelector(`text=${accountName}`, { timeout: 5000 });
      console.log(`✅ Logged in – account name "${accountName}" found`);
      return true;
    } catch (err) {
      console.warn(
        "⚠️ Could not confirm login by header text. Login has failed."
      );
      throw new Error(
        'Login may have failed – header did not show "Sign Out" or account name.'
      );
    }
  }
}

/**
 * Take a screenshot of the current page
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} screenshotPath
 */
export async function takeScreenshot(
  page,
  screenshotPath = "screenshots/timco-login.png",
  logger,
  artifacts
) {
  const saveScreenshot =
    (process.env.SAVE_SCREENSHOT || "").toLowerCase() === "true";

  if (!saveScreenshot) return;

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  if (logger?.step) logger.step("Screenshot saved at:", { screenshotPath });
  artifacts.screenshots.push(screenshotPath);

  console.log(`📸 Screenshot saved at: ${screenshotPath}`);
}

/**
 * Logs out of timco.co.uk.
 * Returns true if logout looks successful, false otherwise.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [logger] - optional logger from createOrderLogger
 */
export async function logoutTimco(page, logger) {
  try {
    logger?.step?.("Logging out from Timco");

    const res = await page.goto("https://timco.co.uk/logout", {
      waitUntil: "domcontentloaded",
    });

    // Basic network check
    const okResponse = !!res && res.ok();

    console.log("✅ Logged OUT");

    // // Optional UI check: look for "Log In / Register" button again
    // let uiLooksLoggedOut = false;
    // try {
    //   await page.waitForSelector('text=Log In / Register', { timeout: 5000 });
    //   uiLooksLoggedOut = true;
    // } catch {
    //   uiLooksLoggedOut = false;
    // }

    // const success = okResponse && uiLooksLoggedOut;
    const success = okResponse;

    if (success) {
      logger?.info?.("Logout successful");
    } else {
      logger?.error?.("Logout may have failed", {
        okResponse,
        uiLooksLoggedOut,
        url: page.url(),
      });
    }

    return success;
  } catch (err) {
    logger?.error?.("Logout threw an exception", { error: String(err) });
    return false;
  }
}

/**
 * On https://timco.co.uk/checkout/addresses:
 * - Clicks "Use Different Address"
 * - Waits for #searchShippingAddressModel modal
 *
 * Returns true if the modal is visible, false otherwise.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [logger]
 * @returns {Promise<boolean>}
 */
export async function openDifferentAddressModal(page, logger) {
  try {
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    let onAddressStep = /\/checkout\/addresses\b/i.test(url);

    // Fallback: check for page text if URL is slightly different
    if (!onAddressStep) {
      const hasHeading = await page
        .getByText(/delivery address|shipping address/i)
        .isVisible()
        .catch(() => false);
      onAddressStep = hasHeading;
    }

    if (!onAddressStep) {
      logger?.error?.(
        "Not on checkout addresses page – cannot open address modal",
        { url }
      );
      return false;
    }

    logger?.step?.(
      'On checkout addresses page, opening "Use Different Address" modal',
      { url }
    );

    // Handle cookies again in case banner reappears
    await acceptCookiesIfPresent(page, logger);

    let link = page
      .getByRole("link", { name: /use different address/i })
      .first();

    await link.waitFor({ timeout: 15000 });

    logger?.step?.('Clicking "Use Different Address" link');

    const modal = page.locator("#searchShippingAddressModel");

    await Promise.all([
      modal
        .waitFor({
          state: "visible",
          timeout: 10000,
        })
        .catch(() => null), // we’ll verify visibility explicitly below
      link.click(),
    ]);

    //Check if modal is actually visible
    const modalVisible = await modal.isVisible().catch(() => false);

    if (!modalVisible) {
      logger?.error?.("Address search modal did not appear after click");
      return false;
    }

    logger?.info?.("Address search modal opened successfully");

    let link2 = page.getByRole("button", { name: /^new address$/i });

    await link2.waitFor({ timeout: 15000 });

    logger?.step?.('Clicking "New Address" button');

    const modal2 = page.locator("#newShippingAddressModal");

    await Promise.all([
      modal2
        .waitFor({
          state: "visible",
          timeout: 10000,
        })
        .catch(() => null), // we’ll verify visibility explicitly below
      link2.click(),
    ]);

    const modalVisible2 = await modal2.isVisible().catch(() => false);

    if (!modalVisible2) {
      logger?.error?.("new Address modal did not appear after click");
      return false;
    }

    logger?.info?.("new address opened successfully");

    return true;
  } catch (err) {
    logger?.error?.("Error in openDifferentAddressModal", {
      error: String(err),
      url: page.url(),
    });
    return false;
  }
}

/**
 * Fill the "ENTER NEW SHIPPING ADDRESS" modal (#newShippingAddressModal)
 * using the provided address object.
 *
 * Expects the modal to already be open.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} address
 * @param {object} [logger]
 * @returns {Promise<boolean>}
 */
export async function fillNewShippingAddressModal(page, address, logger) {
  try {
    const modal = page.locator("#newShippingAddressModal");
    await modal.waitFor({ state: "visible", timeout: 10000 });
    logger?.step?.("Filling new shipping address modal");

    const cd = address?.contact_details ?? {};
    const ya = address?.your_address ?? {};
    const as = address?.address_search ?? {};

    // --- Contact details (already working) ---
    if (cd.first_name) await page.fill("#newaddressFirstname", cd.first_name);
    if (cd.last_name) await page.fill("#newaddressLastname", cd.last_name);
    if (cd.email) await page.fill("#newaddressEmail", cd.email);
    if (cd.company) await page.fill("#newaddressCompany", cd.company);
    if (cd.phone_number)
      await page.fill("#newaddressPhonenumber", cd.phone_number);
    if (cd.mobile_number)
      await page.fill("#newaddressMobilenumber", cd.mobile_number);

    // --- Address search (optional) ---
    if (as.postcode) await page.fill("#addressAutoCompleteId", as.postcode);

    // --- IMPORTANT: expand "Your Address" section ---
    const yourAddressHeading = modal.getByText(/your address/i).first();
    await yourAddressHeading.click();
    await page.waitForTimeout(200);

    // Now the inputs exist – fill them
    const addr1 = modal.locator("#newaddressAddress1");
    await addr1.waitFor({ state: "visible", timeout: 10000 });

    if (ya.address_1) await addr1.fill(ya.address_1);
    if (ya.address_2 !== undefined)
      await page.fill("#newaddressAddress2", ya.address_2);
    if (ya.city) await page.fill("#newaddressCity", ya.city);

    if (ya.postcode) await page.fill("#newaddressPostcode", ya.postcode);

    const newaddressCountry = modal.locator("#newaddressCountry");
    await newaddressCountry.waitFor({ state: "visible", timeout: 10000 });

    if (ya.country) {
      await page
        .selectOption("#newaddressCountry", { label: ya.country })
        .catch(() => {});
    }
    if (ya.county) {
      await page
        .selectOption("#newaddressCounty", { label: ya.county })
        .catch(() => {});
    }

    logger?.info?.("New shipping address modal filled successfully", {
      first_name: cd.first_name,
      city: ya.city,
      postcode: ya.postcode,
    });

    let link = page.getByRole("button", { name: /add address/i });

    await link.waitFor({ timeout: 15000 });

    logger?.step?.('Clicking "Add Address" link');

    const modal2 = page.locator("#saveShippingAddressModel");

    await Promise.all([
      modal2
        .waitFor({
          state: "visible",
          timeout: 10000,
        })
        .catch(() => null), // we’ll verify visibility explicitly below
      link.click(),
    ]);
    //Check if modal is actually visible
    const modalVisible2 = await modal2.isVisible().catch(() => false);

    if (!modalVisible2) {
      logger?.error?.("Address search modal did not appear after click");
      return false;
    }

    logger?.info?.("Address search modal opened successfully");

    const doNotAdd = page.getByRole("button", { name: /^don't add/i });
    await doNotAdd.waitFor({ timeout: 10000 });
    // await doNotAdd.click();
    await doNotAdd.click();
    await page.waitForTimeout(3000);

    return true;
  } catch (err) {
    logger?.error?.("Error in fillNewShippingAddressModal", {
      error: String(err),
      url: page.url(),
    });
    return false;
  }
}

/**
 * Selects the next available delivery date in the calendar
 * on the checkout/addresses page.
 *
 * "Next available" = first span with class .tui-full-calendar-weekday-grid-date.enabled
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [logger]
 * @returns {Promise<boolean>}
 */
export async function selectNextAvailableDeliveryDate(page, logger, orderID) {
  try {
    // Wait for calendar to be rendered
    await page.waitForSelector("#js-calendar", { timeout: 10000 });

    const nextEnabledDate = page
      .locator("#js-calendar .tui-full-calendar-weekday-grid-date.enabled")
      .first();

    await nextEnabledDate.waitFor({ state: "visible", timeout: 10000 });

    const dateAttr = await nextEnabledDate.getAttribute("data-date");
    const label = (await nextEnabledDate.innerText()).trim();

    logger?.step?.("Selecting next available delivery date", {
      dateAttr,
      label,
    });

    await nextEnabledDate.click();

    // Optional: log text shown above calendar after selection
    const deliveryLabel = await page.locator("#delivery-date").innerText();
    logger?.info?.("Delivery date after selection", { deliveryLabel });

    const OrderReference = page.locator("#OrderReference");
    await OrderReference.waitFor({ state: "visible", timeout: 10000 });

    if (orderID) await OrderReference.fill(orderID);

    const continueBtn = page.getByRole("button", { name: /^continue$/i });

    await continueBtn.waitFor({ timeout: 10000 });
    logger?.step?.('Clicking final "Continue" to place order');

    await Promise.all([
      page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 })
        .catch(() => null),
      continueBtn.click(),
    ]);

    return true;
  } catch (err) {
    logger?.error?.("Failed to select next available delivery date", {
      error: String(err),
      url: page.url(),
    });
    return false;
  }
}

/**
 * Selects "Pay by Bank Transfer (BACS)", handles modal popup,
 * and confirms the order on checkout/confirm page.
 *
 * Modal selector: #bacsPaymentModalPopup
 * Confirm button: #confirmBacsPayment
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [logger]
 * @returns {Promise<boolean>}
 */
export async function selectPayByBankTransfer(page, logger) {
  try {
    // 1. Wait for payment options
    await page.waitForSelector(".payment-options-confirm", { timeout: 10000 });

    const bankTransferOption = page.getByAltText("TIMCO Bacs Payment");

    await bankTransferOption.waitFor({
      state: "visible",
      timeout: 10000,
    });

    logger?.step?.("Selecting Pay by Bank Transfer (BACS)");

    await bankTransferOption.scrollIntoViewIfNeeded();
    await bankTransferOption.click();

    // 2. Wait for BACS modal to appear
    const bacsModal = page.locator("#bacsPaymentModalPopup");

    await bacsModal.waitFor({
      state: "visible",
      timeout: 10000,
    });

    logger?.step?.("BACS payment modal displayed");

    // 3. Click CONFIRM inside modal
    const confirmBtn = page.locator("#confirmBacsPayment");

    await confirmBtn.waitFor({
      state: "visible",
      timeout: 10000,
    });

    logger?.step?.("Confirming BACS payment");

    await Promise.all([
      // Sometimes TIMco uses AJAX, sometimes soft navigation
      page
        .waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 30000,
        })
        .catch(() => null),

      confirmBtn.click(),
    ]);

    logger?.info?.("BACS payment confirmed successfully");

    return true;
  } catch (err) {
    logger?.error?.("Failed to complete BACS payment flow", {
      error: String(err),
      url: page.url(),
    });
    return false;
  }
}

/**
 * Extracts the TIMco order number from the completed page.
 *
 * URL format:
 * https://timco.co.uk/checkout/completed/300848355
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [logger]
 * @returns {Promise<string|null>}
 */
export async function getOrderReference(page, logger) {
  try {
    // Wait until we are on the completed page
    await page.waitForURL(/\/checkout\/completed\/\d+/, {
      timeout: 30000,
    });

    const url = page.url();
    const match = url.match(/\/checkout\/completed\/(\d+)/);

    if (!match) {
      throw new Error("Order number not found in URL");
    }

    const orderNumber = match[1];

    logger?.info?.("Order reference extracted from URL", {
      orderNumber,
      url,
    });

    return orderNumber;
  } catch (err) {
    logger?.error?.("Failed to extract order reference", {
      error: String(err),
      url: page.url(),
    });
    return null;
  }
}
