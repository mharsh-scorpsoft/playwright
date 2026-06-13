## What the project is doing

The code is set up so that an external system sends an order request, and then a Node.js API server uses Playwright to drive the Timco website. The core work happens in the browser automation, but the API layer handles request validation, security, and job state.

It is not only about loading the page. There is also a CSV creation step, a checkout path, and an address update flow. In practice, the login and upload steps are the first things, but the documentation below may jump around a bit.

## High-level flow

- The external system calls `POST /api/timco/order`
- The API checks a token and decides whether to run the order immediately or queue it
- The system creates a CSV file for the order
- A browser launches and logs into `https://timco.co.uk`
- The bot uploads the CSV on the order upload page
- It then moves through the summary, cart, checkout, and shipping address flows
- Finally the result is returned to the caller and logs are written to `Logs/<orderId>`

Because the job queue is in memory, the queue behavior is not durable. If the server restarts, all queued jobs are gone. That is fine for this kind of simple local automation.

## Important files

- `server/api.js`: API routes, auth, job lifecycle
- `server/middleware/auth.middleware.js`: token auth logic
- `src/timco/runTimcoOrder.js`: the orchestration chain for a single order
- `src/timcoBot.js`: page interactions, login, address, date selection
- `src/csvHelper.js`: CSV creation and upload submission
- `src/routing.js`: flow between summary, cart, and checkout
- `src/logger.js`: log file creation and structured step logging
- `tests/timco-order.spec.js`: direct Playwright test of the order workflow

## API details

The `POST /api/timco/order` endpoint supports two modes:

- `sync` (default): wait for the whole order run to finish and return the final result
- `async`: return a `jobId` immediately and let the browser automation continue in the background

The request body must include `orderId`, `address`, and `csvData`. Without those fields the API returns a `400`.

The server uses a global flag called `isBusy` to prevent more than one order from running at once. This means if one order is active, the next request gets `409` until the first finishes.

## Automation sequence

In the main orchestrator, `runTimcoOrder`, the order flow is roughly:

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

Each step is wrapped so that failures stop the run early and return a failed result. That is good for the workflow, though it means if the step order is wrong the whole thing fails faster.

## Browser actions and page flow

The login function opens `/login`, accepts cookies if needed, and fills the email/password fields from environment variables. It looks for either `Sign Out` or the account name to decide if login worked.

Then the upload flow goes to `/orderupload`, attaches `Logs/<orderId>/<orderId>.csv` to the file input, and clicks submit. If the upload page does not appear as expected, the process will fail there.

After upload, the bot expects a summary page with a `Create Order` button. Clicking that may show a modal if the cart already has items, and it handles either case.

Next, the bot reaches the cart page and clicks the checkbox for terms. It tries several methods to check the box in case the page uses a custom UI. Then it clicks `Checkout`.

The address flow opens a modal for a different shipping address, enters contact details and address fields, and then clicks `Add Address`. There is a follow-up modal where the bot clicks `Don't Add`, which is a bit unusual but part of the current flow.

Finally the bot selects the next available delivery date in a calendar, fills the order reference field, and clicks continue.

## Test behavior

The test file `tests/timco-order.spec.js` does not call the API at all. It directly runs `runTimcoOrder(page, payload)` using Playwright's test runner.

That means the test only validates the order automation itself, not the API server, auth middleware, or job tracking. It is a good way to check the core browser flow, but it is not a full end-to-end server test.

## Logging and artifacts

Each order run creates a log folder under `Logs/<orderId>`. The logger writes a JSON log file with timestamps and step messages. When `SAVE_SCREENSHOT=true`, screenshots are saved for key moments such as after login, after upload, and after checkout steps.

The CSV helper writes the order CSV in `Logs/<orderId>/<orderId>.csv` and then reuses the same path during the upload step.

## Known quirks

- The API only allows one job at a time because of `isBusy`
- Timeouts are configured, but they do not cancel the browser automatically if the job takes too long
- `webOrderReference` is returned in the final object even though the value is never assigned in the current active code path
- The checkout flow has a commented-out bank transfer and order reference block, so some of the later steps may be incomplete
- The address modal flow is somewhat messy and may depend on the page markup being exactly as expected

## Notes

This document is a lighter, less formal summary of the workflow. Some sections are intentionally more narrative and not fully linear, to match the way the process can feel while reading it.
