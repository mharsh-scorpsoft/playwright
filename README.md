# Timco Order Automation Bot

A Node.js-based web automation system that automates the complete order placement workflow on [timco.co.uk](https://timco.co.uk) using Playwright. The system exposes a REST API that accepts order requests with shipping details and product data, executes the automated workflow, and returns detailed execution results with logs and screenshots.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Starting the API Server](#starting-the-api-server)
  - [API Endpoints](#api-endpoints)
  - [Making Requests](#making-requests)
- [Workflow Steps](#workflow-steps)
- [Logging and Artifacts](#logging-and-artifacts)
- [Testing](#testing)
- [Error Handling](#error-handling)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

---

## Overview

This automation bot streamlines the Timco ordering process by:

1. Accepting order requests via REST API from external systems (e.g., cloud.tco.co.uk)
2. Logging into the Timco website with stored credentials
3. Uploading CSV product data
4. Navigating through the order summary and cart
5. Filling shipping address details
6. Selecting delivery dates
7. Completing the checkout process
8. Returning success/failure status with detailed logs and screenshots

## Features

- **REST API**: Synchronous and asynchronous job execution modes
- **Job Queue**: In-memory job tracking with status monitoring
- **Browser Automation**: Headless/headed Firefox browser automation via Playwright
- **Structured Logging**: Per-order JSON logs with timestamps and step details
- **Screenshot Capture**: Automatic screenshots at each workflow step
- **Error Recovery**: Graceful error handling with detailed failure reporting
- **Authentication**: Token-based API security
- **Configurable Timeouts**: Environment-based timeout and headless mode configuration

## Architecture

### High-Level Flow

```
External System (cloud.tco.co.uk)
         ↓
    POST /api/timco/order
         ↓
    Express API Server
         ↓
    Job Queue (in-memory)
         ↓
    Playwright Browser Automation
         ↓
    timco.co.uk Website
         ↓
    Order Completion + Logs
         ↓
    Response to Client
```

### Component Breakdown

| Component | File | Purpose |
|-----------|------|---------|
| API Server | `server/api.js` | Express server handling HTTP requests, job management |
| Authentication | `server/middleware/auth.middleware.js` | Token-based API protection |
| Order Orchestrator | `src/timco/runTimcoOrder.js` | Main workflow coordinator |
| Browser Actions | `src/timcoBot.js` | Low-level Playwright automation functions |
| Navigation | `src/routing.js` | Page navigation and checkout flow |
| CSV Handler | `src/csvHelper.js` | CSV file creation and upload |
| Logger | `src/logger.js` | Structured logging system |
| Tests | `tests/timco-order.spec.js` | End-to-end Playwright tests |

## Project Structure

```
playwright/
├── Logs/                          # Order-specific logs and artifacts
│   └── <orderId>/
│       ├── <orderId>.csv          # Generated CSV file
│       ├── after-*.png            # Step screenshots
│       └── order-<orderId>-<timestamp>.log
├── server/
│   ├── api.js                     # Express API server
│   └── middleware/
│       └── auth.middleware.js     # Authentication middleware
├── src/
│   ├── timco/
│   │   └── runTimcoOrder.js       # Main workflow orchestrator
│   ├── timcoBot.js                # Browser automation functions
│   ├── routing.js                 # Navigation and checkout
│   ├── csvHelper.js               # CSV creation and upload
│   └── logger.js                  # Logging utilities
├── tests/
│   ├── timco-order.spec.js        # E2E test
│   └── example.spec.js            # Example tests
├── playwright.config.js           # Playwright configuration
├── package.json                   # Dependencies and scripts
└── .env                           # Environment variables (not in repo)
```

## Prerequisites

- **Node.js**: v18 or higher
- **npm**: Comes with Node.js
- **Operating System**: Windows, macOS, or Linux
- **Browser**: Firefox (installed automatically by Playwright)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd playwright
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers**:
   ```bash
   npx playwright install firefox
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Timco Credentials
TIMCO_EMAIL=your-email@example.com
TIMCO_PASSWORD=your-password
TIMCO_ACCOUNT_NAME=Your Account Name

# API Configuration
PORT=3000
CLOUD_AUTH_TOKEN=your-secure-token-here

# Job Configuration
HEADLESS=true                    # Set to "false" to see browser
JOB_TIMEOUT_MS=100000           # Job timeout in milliseconds
SAVE_SCREENSHOT=true            # Enable/disable screenshots

# Environment
NODE_ENV=production             # production or development
```

### Security Notes

- **Never commit `.env` file** to version control
- Use strong, unique tokens for `CLOUD_AUTH_TOKEN`
- Rotate credentials regularly
- Store sensitive data in secure secret management systems in production

## Usage

### Starting the API Server

```bash
npm run api
```

The server will start on the configured port (default: 3000):
```
[API] Timco service listening on http://localhost:3000
```

### API Endpoints

#### 1. Health Check

**Endpoint**: `GET /health`

**Description**: Check API server status and availability

**Response**:
```json
{
  "ok": true,
  "busy": false,
  "time": "2025-01-14T12:00:00.000Z"
}
```

---

#### 2. Create Order (Sync/Async)

**Endpoint**: `POST /api/timco/order`

**Authentication**: Required (Bearer token or headers)

**Query Parameters**:
- `mode` (optional): `sync` or `async` (default: `sync`)

**Request Headers**:
```
Authorization: Bearer <CLOUD_AUTH_TOKEN>
# OR
x-api-token: <CLOUD_AUTH_TOKEN>
# OR
token: <CLOUD_AUTH_TOKEN>
```

**Request Body**:
```json
{
  "orderId": "PO-4651",
  "address": {
    "contact_details": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "company": "Example Corp",
      "phone_number": "07789996135",
      "mobile_number": "07789996135"
    },
    "address_search": {
      "country": "United Kingdom",
      "postcode": "DD4 0NP"
    },
    "your_address": {
      "address_1": "14 Example Street",
      "address_2": "Apartment 5",
      "city": "Dundee",
      "postcode": "DD4 0NP",
      "country": "United Kingdom",
      "county": "Angus"
    }
  },
  "csvData": {
    "47147MH": "10",
    "ABC123": "5"
  }
}
```

**Sync Mode Response** (200 or 500):
```json
{
  "success": true,
  "failedStep": null,
  "error": null,
  "artifacts": {
    "logDir": "Logs/PO-4651",
    "screenshots": [
      "Logs/PO-4651/after-login.png",
      "Logs/PO-4651/after-upload.png",
      "..."
    ]
  },
  "durationMs": 45230,
  "jobId": "PO-4651-1705234567890"
}
```

**Async Mode Response** (202):
```json
{
  "success": true,
  "jobId": "PO-4651-1705234567890",
  "statusUrl": "/api/timco/order/PO-4651-1705234567890"
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Missing required fields: orderId, address, csvData"
}
```

**Busy Response** (409):
```json
{
  "success": false,
  "error": "System busy: another order is currently running. Try again shortly."
}
```

---

#### 3. Get Job Status

**Endpoint**: `GET /api/timco/order/:jobId`

**Authentication**: Required

**Response**:
```json
{
  "success": true,
  "jobId": "PO-4651-1705234567890",
  "status": "succeeded",
  "result": {
    "success": true,
    "artifacts": { "..." },
    "durationMs": 45230
  },
  "createdAt": "2025-01-14T12:00:00.000Z",
  "updatedAt": "2025-01-14T12:00:45.000Z",
  "payloadMeta": {
    "orderId": "PO-4651"
  }
}
```

**Job Statuses**:
- `queued`: Job accepted, waiting to start
- `running`: Job currently executing
- `succeeded`: Job completed successfully
- `failed`: Job failed with error

---

#### 4. List Recent Jobs

**Endpoint**: `GET /api/timco/jobs`

**Authentication**: Required

**Description**: Returns last 50 jobs (for debugging)

**Response**:
```json
{
  "success": true,
  "count": 3,
  "jobs": [
    {
      "jobId": "PO-4651-1705234567890",
      "status": "succeeded",
      "..."
    }
  ]
}
```

### Making Requests

#### Using cURL (Sync Mode)

```bash
curl -X POST http://localhost:3000/api/timco/order \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "PO-123",
    "address": {
      "contact_details": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "company": "Example Corp",
        "phone_number": "07789996135",
        "mobile_number": "07789996135"
      },
      "address_search": {
        "country": "United Kingdom",
        "postcode": "DD4 0NP"
      },
      "your_address": {
        "address_1": "14 Example Street",
        "address_2": "",
        "city": "Dundee",
        "postcode": "DD4 0NP",
        "country": "United Kingdom",
        "county": "Angus"
      }
    },
    "csvData": {
      "47147MH": "10"
    }
  }'
```

#### Using cURL (Async Mode)

```bash
curl -X POST "http://localhost:3000/api/timco/order?mode=async" \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

#### Using JavaScript/Node.js

```javascript
const axios = require('axios');

const response = await axios.post(
  'http://localhost:3000/api/timco/order',
  {
    orderId: 'PO-123',
    address: { /* ... */ },
    csvData: { '47147MH': '10' }
  },
  {
    headers: {
      'Authorization': 'Bearer your-token-here',
      'Content-Type': 'application/json'
    }
  }
);

console.log(response.data);
```

## Workflow Steps

The automation executes the following steps in sequence:

### 1. **Login to Timco** (`loginTimco`)
- Navigate to `https://timco.co.uk/login`
- Handle cookie consent banner
- Fill email and password fields
- Submit login form
- Verify successful login (check for "Sign Out" or account name)
- **Screenshot**: `after-login.png`

### 2. **Create CSV File** (`createCSV`)
- Generate CSV file from `csvData` object
- Format: `ProductCode,Quantity`
- Save to `Logs/<orderId>/<orderId>.csv`

### 3. **Upload CSV** (`uploadOrderCsvAndSubmit`)
- Navigate to `https://timco.co.uk/orderupload`
- Attach CSV file to file input
- Submit upload form
- Wait for order summary page
- **Screenshot**: `after-upload.png`

### 4. **Navigate to Cart** (`goFromSummaryToCart`)
- Click "Create Order" button on summary page
- Handle confirmation modal if cart needs emptying
- Wait for cart/basket page to load
- **Screenshot**: `after-summary.png`

### 5. **Confirm Terms & Checkout** (`confirmTermsAndCheckout`)
- Locate and check Terms of Service checkbox
- Scroll checkbox into view
- Handle custom checkbox implementation
- Click "Checkout" button
- Navigate to checkout/addresses page
- **Screenshot**: `after-checkbox.png`

### 6. **Open Address Modal** (`openDifferentAddressModal`)
- Click "Use Different Address" link
- Wait for address search modal to appear
- Click "New Address" button
- Open new shipping address form
- **Screenshot**: `after-modalOpened.png`

### 7. **Fill Shipping Address** (`fillNewShippingAddressModal`)
- Fill contact details (name, email, phone)
- Expand "Your Address" section
- Fill address fields (address, city, postcode, county, country)
- Click "Add Address" button
- Handle confirmation modal (click "Don't Add" to address book)
- **Screenshot**: `after-FillNewShippingAddressModal.png`

### 8. **Select Delivery Date** (`selectNextAvailableDeliveryDate`)
- Wait for calendar widget to load
- Select first available delivery date
- Fill order reference field with `orderId`
- Click "Continue" to place order
- **Screenshot**: `after-dateSelected.png`

### 9. **Logout** (`logoutTimco`)
- Navigate to `https://timco.co.uk/logout`
- Best-effort logout (non-fatal if fails)

## Logging and Artifacts

### Log Structure

Each order creates a dedicated directory under `Logs/<orderId>/`:

```
Logs/
└── PO-4651/
    ├── PO-4651.csv                           # Generated CSV
    ├── after-login.png                        # Step screenshots
    ├── after-upload.png
    ├── after-summary.png
    ├── after-checkbox.png
    ├── after-modalOpened.png
    ├── after-FillNewShippingAddressModal.png
    ├── after-dateSelected.png
    └── order-PO-4651-2025-12-27_18-37-45.log # Structured JSON log
```

### Log Format

Logs are written in JSON Lines format (one JSON object per line):

```json
{"ts":"2025-01-14T12:00:00.123Z","level":"INFO","message":"Starting Timco order","orderId":"PO-4651"}
{"ts":"2025-01-14T12:00:05.456Z","level":"STEP","message":"Screenshot saved at:","screenshotPath":"Logs/PO-4651/after-login.png"}
{"ts":"2025-01-14T12:00:45.789Z","level":"ERROR","message":"Step failed","stepName":"loginTimco","error":"Login failed"}
```

### Log Levels

- **INFO**: General information and success messages
- **STEP**: Step-by-step workflow progress
- **ERROR**: Errors and failures

### Screenshots

Screenshots are captured at each major workflow step when `SAVE_SCREENSHOT=true`. Each screenshot is saved with a descriptive name indicating which step was just completed.

## Testing

### Running Tests

The project includes Playwright end-to-end tests:

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/timco-order.spec.js

# Run tests with UI
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Generate HTML report
npx playwright show-report
```

### Test Configuration

Tests are configured in `playwright.config.js`:
- **Test directory**: `./tests`
- **Browser**: Firefox (Desktop Firefox device)
- **Parallel execution**: Enabled by default
- **Reporter**: HTML report
- **Trace**: Captured on first retry

### Writing Custom Tests

```javascript
import { test, expect } from '@playwright/test';
import { runTimcoOrder } from '../src/timco/runTimcoOrder.js';

test('Custom order test', async ({ page }) => {
  test.setTimeout(90000);

  const payload = {
    orderId: 'TEST-001',
    address: { /* ... */ },
    csvData: { '47147MH': '10' }
  };

  const result = await runTimcoOrder(page, payload);
  expect(result.success).toBeTruthy();
});
```

## Error Handling

### Error Response Structure

When a step fails, the response includes:

```json
{
  "success": false,
  "failedStep": "loginTimco",
  "error": "Login may have failed – header did not show 'Sign Out' or account name.",
  "artifacts": {
    "logDir": "Logs/PO-4651",
    "screenshots": ["..."]
  },
  "durationMs": 12450
}
```

### Common Failure Points

| Step | Common Issues | Solutions |
|------|---------------|-----------|
| Login | Invalid credentials | Verify `.env` credentials |
| CSV Upload | File not found | Ensure CSV creation step succeeds |
| Checkbox | Custom checkbox not clicking | Script handles multiple click methods |
| Address Modal | Modal doesn't appear | Check for cookie banner interference |
| Delivery Date | No available dates | Calendar widget timing issues |

### Retry Strategy

- **API Level**: No automatic retries (client must retry)
- **Job Level**: Single execution per job
- **Step Level**: Each step uses timeouts and multiple attempt strategies

### Timeout Configuration

Default timeouts can be adjusted via environment variables:
- `JOB_TIMEOUT_MS`: Overall job timeout (default: 100000ms)
- Page-level timeouts: Set in `executeTimcoJob` function (default: 90000ms)

## Security

### Authentication

All API endpoints under `/api` require authentication:

1. **Bearer Token** (recommended):
   ```
   Authorization: Bearer <token>
   ```

2. **Custom Headers**:
   ```
   x-api-token: <token>
   token: <token>
   ```

### Best Practices

- Store `CLOUD_AUTH_TOKEN` securely (never in code)
- Use HTTPS in production
- Implement rate limiting for production deployments
- Rotate credentials regularly
- Monitor failed authentication attempts
- Use environment-specific tokens

### Single-Job Lock

The system implements a single-job lock (`isBusy` flag) to prevent concurrent executions:
- Only one order can run at a time
- Returns 409 (Conflict) if busy
- Lock is released after job completion or failure

## Troubleshooting

### Common Issues

#### 1. "System busy" error (409)
**Cause**: Another order is currently running  
**Solution**: Wait for current job to complete, or check job status

#### 2. Login fails
**Cause**: Invalid credentials or site changes  
**Solution**: 
- Verify `.env` credentials
- Check if Timco login page structure changed
- Run in headed mode (`HEADLESS=false`) to observe

#### 3. Screenshots not saving
**Cause**: `SAVE_SCREENSHOT=false` or directory permissions  
**Solution**: 
- Set `SAVE_SCREENSHOT=true` in `.env`
- Ensure write permissions to `Logs/` directory

#### 4. Checkbox not clicking
**Cause**: Custom checkbox implementation  
**Solution**: Script already includes multiple fallback methods (label click, checkmark click, direct property setting)

#### 5. Timeout errors
**Cause**: Slow network or page loading  
**Solution**: 
- Increase `JOB_TIMEOUT_MS`
- Check network connectivity
- Verify Timco site is accessible

#### 6. Browser launch fails
**Cause**: Playwright browsers not installed  
**Solution**: 
```bash
npx playwright install firefox
```

### Debug Mode

Run in headed mode to see browser actions:

```env
HEADLESS=false
```

Or set programmatically:
```javascript
const result = await executeTimcoJob(jobId, payload, { headless: false });
```

### Logs Analysis

Check order-specific logs in `Logs/<orderId>/` for detailed execution trace:

```bash
# View latest log
cat Logs/PO-4651/order-PO-4651-*.log | tail -n 50

# Search for errors
grep ERROR Logs/PO-4651/order-PO-4651-*.log
```

---

## Production Deployment Considerations

### Scalability

Current implementation uses in-memory job storage. For production:

1. **Use Redis or Database** for job queue
2. **Implement worker pools** for concurrent jobs
3. **Add job persistence** for crash recovery
4. **Consider message queue** (RabbitMQ, AWS SQS) for async processing

### Monitoring

Implement monitoring for:
- Job success/failure rates
- Average job duration
- Failed authentication attempts
- System resource usage
- Browser crashes

### Infrastructure

- **Containerization**: Use Docker for consistent environments
- **Orchestration**: Kubernetes for scaling
- **Load Balancing**: Distribute traffic across instances
- **Secret Management**: Use AWS Secrets Manager, Azure Key Vault, etc.

---

## License

[Add your license information here]

## Support

For issues or questions:
- Check logs in `Logs/<orderId>/`
- Review screenshots for visual debugging
- Run tests with `--headed` flag to observe behavior
- Contact support team with job ID and error details

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-14