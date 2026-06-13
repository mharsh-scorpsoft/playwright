import { error } from "console";

/**
 * Accept the cookie banner if it is visible.
 *
 * @param {import('@playwright/test').Page} page
 */

function parseUKDeliveryAddress(deliveryAddress) {
  if (!deliveryAddress || typeof deliveryAddress !== "string") {
    return {
      shipping_name: null,
      shipping_address: null,
      shipping_address_city: null,
      shipping_address_postcode: null,
    };
  }

  // split and clean
  const parts = deliveryAddress
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Must have at least: name + city + postcode (minimum 3 parts)
  if (parts.length < 3) {
    return {
      shipping_name: parts[0] ?? null,
      shipping_address: null,
      shipping_address_city: parts[1] ?? null,
      shipping_address_postcode: parts[2] ?? null,
    };
  }

  const shipping_name = parts[0];
  const shipping_address_postcode = parts[parts.length - 1];
  const shipping_address_city = parts[parts.length - 2];

  // Everything between name and city becomes address line
  const middle = parts.slice(1, -2); // could be empty
  const shipping_address = middle.length ? middle.join(", ") : null;

  return {
    shipping_name,
    shipping_address,
    shipping_address_city,
    shipping_address_postcode,
  };
}

export async function fetchParcelInfo(page, url, emailNumber) {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // DPD short link sometimes redirects, so take final URL
  const currentUrl = page.url();

  // Convert "next" page to "events" page
  let eventsUrl = currentUrl;
  if (eventsUrl.includes("/next")) {
    eventsUrl = eventsUrl.replace("/next", "/events");
  } else if (!eventsUrl.includes("/events")) {
    // if not next/events, keep same
    eventsUrl = eventsUrl.replace(/\/+$/, "") + "/events";
  }

  const res = await page.goto(eventsUrl, { waitUntil: "domcontentloaded" });

  if (!res || !res.ok()) {
    return {
      success: false,
      message: `DPD events page failed. Status: ${res?.status()}`,
      eventsUrl,
    };
  }

  // Wait for parcel number label
  await page.waitForSelector("text=Parcel Number", { timeout: 15000 });

  // ✅ Extract Parcel Number (based on your screenshot layout)
  const parcelNumber = await page
    .locator(
      "xpath=//p[normalize-space()='Parcel Number:']/following-sibling::p[1]",
    )
    .innerText();

  // ✅ Extract Delivery Address
  const deliveryAddress = await page
    .locator(
      "xpath=//p[normalize-space()='Delivery Address:']/following-sibling::p[1]",
    )
    .innerText();

  const parsed = parseUKDeliveryAddress(deliveryAddress);
  const refsList = await page
    .locator("table tbody tr td:nth-child(2)")
    .allInnerTexts();

  const senderRefs = refsList
    .flatMap((text) => text.split(","))
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    success: true,
    emailNumber,
    eventsUrl,
    senderRefs,
    parcelNumber: parcelNumber?.trim() || null,
    ...parsed,
  };
}
