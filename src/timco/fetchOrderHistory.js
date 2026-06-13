import { loginTimco, logoutTimco } from "../timcoBot.js";

/**
 * Accept the cookie banner if it is visible.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function fetchOrderHistory(page) {
  try {
    // 1. LOGIN
    console.log("✅ running order history API");
    await loginTimco(page);

    // 2. GO TO ORDER HISTORY
    await page.goto("https://timco.co.uk/order/history", {
      waitUntil: "networkidle",
    });

    // 3. WAIT FOR TABLE
    const appDiv = page.locator("#app");
    const gridRow = appDiv.locator(".grid-row.gutter");
    const rows = gridRow.locator("table tbody tr");

    await rows.first().waitFor({ timeout: 15000 });

    const orders = await rows.evaluateAll((rows) =>
      rows.map((row) => {
        const cells = row.querySelectorAll("td");

        return {
          [cells[6]?.innerText.trim() || "UNKNOWN_ORDER_REF"]: {
            webOrderNo: cells[1]?.innerText.trim() || null,
            timcoOrderNo: cells[2]?.innerText.trim() || null,
            orderDate: cells[3]?.innerText.trim() || null,
            shipTo: cells[4]?.innerText.trim() || null,
            orderTotal: cells[5]?.innerText.trim() || null,
            status:
              cells[7]?.querySelector(".success-text")?.innerText.trim() ||
              null,
            viewOrderUrl:
              cells[9]?.querySelector("a")?.getAttribute("href") || null,
          },
        };
      })
    );
    console.log("✅ Fetched order history");

    // 5. LOGOUT
    await logoutTimco(page, null);

    return orders;
  } catch (err) {
    throw err;
  }
}

// module.exports = fetchOrderHistory;
