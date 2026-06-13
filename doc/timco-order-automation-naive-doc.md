# Timco Order Automation - Basic Project Notes

## What this project is doing

This project is basically made for placing order on Timco website automatically.

An external system sends the order details to our Node.js API, and after that the system use Playwright to open the Timco website like a normal browser. Then it login, upload the CSV file, go through cart and checkout, add the shipping address, select delivery date and then return the final result.

So this is not only an API project. The main work is actually happening inside the browser automation. API is only receiving the request and starting the order process.

---

## Basic flow

The flow is something like this:

1. External system call `POST /api/timco/order`
2. API check the auth token
3. API check order data is valid or not
4. System create CSV file for order
5. Browser open Timco website
6. Bot login into Timco account
7. Bot upload the CSV file
8. Bot move from summary page to cart
9. Bot accept terms and go to checkout
10. Bot open different delivery address modal
11. Bot fill the new shipping address
12. Bot select next available delivery date
13. Bot logout from Timco
14. Final result return back to the caller

This is the normal working flow. If any step fail in between, then the automation stop and return failed result.

---

## Important files

These are the main files which are important in this project:

| File | What it is doing |
|---|---|
| `server/api.js` | This file handle API routes, request checking and job running |
| `server/middleware/auth.middleware.js` | This file check the auth token |
| `src/timco/runTimcoOrder.js` | Main file where single order flow is running |
| `src/timcoBot.js` | This file has browser actions like login, address filling and date selection |
| `src/csvHelper.js` | This file create CSV file and upload it |
| `src/routing.js` | This file handle movement from summary to cart and checkout |
| `src/logger.js` | This file create logs for every order |
| `tests/timco-order.spec.js` | This test file run the order automation directly |

---

## API details

Main API endpoint is:

```http
POST /api/timco/order
```

The request should have these main fields:

```json
{
  "orderId": "ORDER123",
  "address": {},
  "csvData": []
}
```

Required fields are:

- `orderId`
- `address`
- `csvData`

If these fields are not there, API return `400` error.

The API also check token before running the order. If token is wrong, request should not be allowed.

---

## Sync and async mode

This API support two mode.

### Sync mode

In sync mode, API wait until the full browser automation finish. After that it return the final result.

This is simple but can take time because browser need to complete all order steps.

### Async mode

In async mode, API return a `jobId` quickly and automation keep running after that.

But the queue is only in memory. So if server restart, the queued jobs will be lost. This is fine for small or local setup, but not good for big production system.

---

## One job at a time

The project use a global `isBusy` flag.

This means only one order can run at one time. If another order request come while one order is already running, then API return `409`.

This is done to avoid two browser jobs running together and creating issue on Timco website.

---

## Automation steps

Inside `runTimcoOrder`, the flow is mainly like this:

1. `loginTimco`
2. `createCSV`
3. `uploadOrderCsvAndSubmit`
4. `acceptCookiesIfPresent`
5. `goFromSummaryToCart`
6. `confirmTermsAndCheckout`
7. `openDifferentAddressModal`
8. `fillNewShippingAddressModal`
9. `selectNextAvailableDeliveryDate`
10. `logoutTimco`

Every step is important. If one step break, then next steps mostly cannot continue.

---

## Login flow

The bot open Timco login page and fill email and password from environment variables.

After login, it check if login worked by looking for things like `Sign Out` or account name on the page.

If these things are not found, then login is treated as failed.

---

## CSV upload flow

After login, the bot go to order upload page.

It create the CSV file in this path:

```txt
Logs/<orderId>/<orderId>.csv
```

Then it attach this CSV file in the upload input and submit it.

If the upload page is not loaded correctly, or file input is not found, then this step fail.

---

## Summary and cart flow

After CSV upload, Timco show summary page.

The bot looks for `Create Order` button and click it.

Sometimes there can be a modal if cart already has some item. The code try to handle that also.

After that, bot reach the cart page. It click terms checkbox and then click checkout.

The checkbox can be little tricky, so code tries multiple way to check it.

---

## Address flow

At checkout, bot open different shipping address modal.

Then it fill contact name, address fields and other required details.

After adding address, there is another modal where bot click `Don't Add`. This part looks little unusual but it is part of current flow.

This address flow may break if Timco change the page design or field names.

---

## Delivery date flow

After address is done, bot select the next available delivery date from calendar.

Then it fill order reference field and continue.

Some later checkout steps look incomplete because some code is commented, like bank transfer and order reference related part.

---

## Logs and screenshots

For each order, system create a folder like this:

```txt
Logs/<orderId>
```

Inside this folder, it save log file and CSV file.

If `SAVE_SCREENSHOT=true`, then screenshots are also saved for important steps like after login, after upload and checkout pages.

This is useful for debugging because we can see where automation failed.

---

## Test file

The test file is:

```txt
tests/timco-order.spec.js
```

This test does not call API endpoint.

It directly run:

```js
runTimcoOrder(page, payload)
```

So it only test the browser automation part. It does not test API auth, job queue, or request validation.

So this is good for checking main Timco flow, but it is not full end to end test of API server.

---

## Known issues and points

Some things which are important to remember:

- Only one job can run at same time because of `isBusy`
- Queue is in memory, so jobs are lost if server restart
- Timeout is there, but browser may not always close automatically
- `webOrderReference` is returned but it looks like value is not properly assigned
- Some checkout code is commented out, so flow may be incomplete
- Address modal flow is little messy and depends on Timco page structure
- If Timco website change buttons or fields, automation can break

---

## Final notes

This document is just a simple project understanding note.

The project is mainly a browser automation system with API wrapper around it. It take order data, create CSV, upload it to Timco, complete checkout steps and give back result.

The code is useful for simple automation, but for more stable production use, the queue, timeout handling and error recovery should be improved.
