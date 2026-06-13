// src/csvHelper.js
import fs from 'fs';
import path from 'path';

/**
 * Create a CSV file from a simple key/value object.
 * Example csvData: { "WBT": "1" }
 * Resulting CSV:
 * WBT,1
 *
 * File path: Logs/<orderId>/<orderId>.csv
 *
 * @param {string|number} orderId
 * @param {Record<string, string|number>} csvData
 * @param {object} [logger] - optional logger from createOrderLogger
 * @returns {Promise<string>} full path to the created CSV file
 */
export async function createCSV(orderId, csvData, logger) {
  if (!orderId) {
    throw new Error('orderId is required to create CSV');
  }

  if (!csvData || typeof csvData !== 'object') {
    throw new Error('csvData must be a non-null object');
  }

  try {
    // Root Logs dir
    const logsRoot = path.join(process.cwd(), 'Logs');

    // If logger has a dirPath (from createOrderLogger), reuse it,
    // otherwise create Logs/<orderId>
    const orderDir =
      logger?.dirPath || path.join(logsRoot, String(orderId));

    await fs.promises.mkdir(orderDir, { recursive: true });

    const filePath = path.join(orderDir, `${orderId}.csv`);

    // Build CSV content: each key/value -> "key,value"
    const lines = Object.entries(csvData).map(([key, value]) => {
      return `${key},${value}`;
    });
    const csvContent = lines.join('\n') + '\n';

    await fs.promises.writeFile(filePath, csvContent, 'utf8');

    logger?.info?.('CSV created successfully', { orderId, filePath });
    return filePath;
  } catch (err) {
    logger?.error?.('Failed to create CSV', {
      orderId,
      error: String(err),
    });
    throw err;
  }
}


/**
 * Go to /orderupload, attach Logs/<orderId>/<orderId>.csv
 * to <input type="file" id="orderUploadFile">, then submit the form.
 *
 * Returns true if everything looks successful, false otherwise.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string|number} orderId
 * @param {object} [logger] - optional logger from createOrderLogger
 * @returns {Promise<boolean>}
 */
export async function uploadOrderCsvAndSubmit(page, orderId, logger) {
  if (!orderId) {
    logger?.error?.('orderId is required for uploadOrderCsvAndSubmit');
    return false;
  }

  // Build CSV path: Logs/<orderId>/<orderId>.csv
  const logsRoot = path.join(process.cwd(), 'Logs');
  const orderDir = logger?.dirPath || path.join(logsRoot, String(orderId));
  const csvPath = path.join(orderDir, `${orderId}.csv`);

  if (!fs.existsSync(csvPath)) {
    logger?.error?.('CSV file not found for upload', { orderId, csvPath });
    return false;
  }

  try {
    logger?.step?.('Opening order upload page', {
      url: 'https://timco.co.uk/orderupload',
    });

    await page.goto('https://timco.co.uk/orderupload', {
      waitUntil: 'domcontentloaded',
    });

    // 1) Wait for the file input
    const fileInput = page.locator('#orderUploadFile');
    await fileInput.waitFor({ timeout: 15000 });

    // 2) Attach the CSV file
    logger?.step?.('Attaching CSV to file input', { csvPath });
    await fileInput.setInputFiles(csvPath);

    // 3) Optional verification: ensure a file is attached
    const filesCount = await fileInput.evaluate(el => (el.files ? el.files.length : 0));
    if (filesCount === 0) {
      logger?.error?.('CSV attachment did not register on file input', {
        orderId,
        csvPath,
      });
      return false;
    }

    // 4) Find the submit button and click it
    // const submitButton = page.locator(
    //   'input.btn-primary.completed[type="submit"][value="Submit"]'
    // );
    const submitButton = page.getByRole('button', { name: /Submit/i });


    // await submitButton.waitFor({ timeout: 10000 });
    logger?.step?.('Submitting upload form');

    await Promise.all([
      page.waitForLoadState('networkidle'),
      submitButton.click(),
    ]);

    logger?.info?.('Upload form submitted, page loaded');
    return true;
  } catch (err) {
    logger?.error?.('Error in uploadOrderCsvAndSubmit', {
      orderId,
      csvPath,
      error: String(err),
    });
    return false;
  }
}




