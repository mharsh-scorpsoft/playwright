// src/timco/runTimcoOrder.js
import {
  loginTimco,
  takeScreenshot,
  logoutTimco,
  acceptCookiesIfPresent,
  openDifferentAddressModal,
  fillNewShippingAddressModal,
  selectNextAvailableDeliveryDate,
  selectPayByBankTransfer,
  getOrderReference,
} from "../timcoBot.js";

import { createOrderLogger } from "../logger.js";
import { goFromSummaryToCart, confirmTermsAndCheckout } from "../routing.js";
import { createCSV, uploadOrderCsvAndSubmit } from "../csvHelper.js";

async function stepOrFail({ stepName, logger, fn }) {
  try {
    const result = await fn(); // 👈 capture return value

    if (!result) {
      return { ok: false, stepName, error: null };
    }

    return { ok: true, result }; // 👈 forward it
  } catch (err) {
    return { ok: false, stepName, error: String(err) };
  }
}

export async function runTimcoOrder(page, payload, opts = {}) {
  const { orderId, address, csvData } = payload;

  const logger = opts.logger ?? createOrderLogger(orderId);
  const startedAt = Date.now();

  const artifacts = {
    logDir: logger.dirPath,
    screenshots: [],
  };

  const snap = async (name) => {
    const p = `${logger.dirPath}/${name}.png`;
    await takeScreenshot(page, p, logger, artifacts);
  };

  logger.info("Starting Timco order", { orderId });

  // 1) Login
  let r = await stepOrFail({
    stepName: "loginTimco",
    logger,
    fn: () => loginTimco(page),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }
  await snap("after-login");

  // 2) Create CSV
  r = await stepOrFail({
    stepName: "createCSV",
    logger,
    fn: () => createCSV(orderId, csvData, logger),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }

  // 3) Upload CSV
  r = await stepOrFail({
    stepName: "uploadOrderCsvAndSubmit",
    logger,
    fn: () => uploadOrderCsvAndSubmit(page, orderId, logger),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }

  await acceptCookiesIfPresent(page);
  await snap("after-upload");

  // 4) Summary -> Cart
  r = await stepOrFail({
    stepName: "goFromSummaryToCart",
    logger,
    fn: () => goFromSummaryToCart(page, logger),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }
  await snap("after-summary");

  // 5) Terms + Checkout
  r = await stepOrFail({
    stepName: "confirmTermsAndCheckout",
    logger,
    fn: () => confirmTermsAndCheckout(page, logger),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }
  await snap("after-checkbox");

  // 6) Open modal
  r = await stepOrFail({
    stepName: "openDifferentAddressModal",
    logger,
    fn: () => openDifferentAddressModal(page, logger),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }
  await snap("after-modalOpened");

  // 7) Fill address
  r = await stepOrFail({
    stepName: "fillNewShippingAddressModal",
    logger,
    fn: () => fillNewShippingAddressModal(page, address, logger),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }
  await snap("after-FillNewShippingAddressModal");

  // 8) Select delivery date (your “order placed” gate)
  r = await stepOrFail({
    stepName: "selectNextAvailableDeliveryDate",
    logger,
    fn: () => selectNextAvailableDeliveryDate(page, logger, orderId),
  });
  if (!r.ok) {
    logger.error("Step failed", r);
    return {
      success: false,
      failedStep: r.stepName,
      error: r.error,
      artifacts,
      durationMs: Date.now() - startedAt,
    };
  }
  await snap("after-dateSelected");

  //   // 9) Select selectPayByBankTransfer (your “order placed” gate)
  // r = await stepOrFail({
  //   stepName: 'selectPayByBankTransfer',
  //   logger,
  //   fn: () => selectPayByBankTransfer(page, logger),
  // });
  // if (!r.ok) {
  //   logger.error('Step failed', r);
  //   return {
  //     success: false,
  //     failedStep: r.stepName,
  //     error: r.error,
  //     artifacts,
  //     durationMs: Date.now() - startedAt,
  //   };
  // }
  // await snap('after-selectPayByBankTransfer');

  //     // 10) Select getOrderReference (your “order placed” gate)
  // const orderRefStep = await stepOrFail({
  //   stepName: 'getOrderReference',
  //   logger,
  //   fn: () => getOrderReference(page, logger),
  // });
  // if (!orderRefStep.ok) {
  //   logger.error('Step failed', orderRefStep);
  //   return {
  //     success: false,
  //     failedStep: orderRefStep.stepName,
  //     error: orderRefStep.error,
  //     artifacts,
  //     durationMs: Date.now() - startedAt,

  //   };
  // }
  // const webOrderRef = orderRefStep.result;
  // await snap('after-getOrderReference');

  // 11) Logout (best-effort; do not mask a successful order)
  try {
    await logoutTimco(page, logger);
    logger.info("Log Out completed successfully");
  } catch (e) {
    logger.error("Logout failed (non-fatal)", { error: String(e) });
  }

  logger.info("Order flow completed successfully", { orderId });

  return {
    success: true,
    failedStep: null,
    error: null,
    artifacts,
    durationMs: Date.now() - startedAt,
    webOrderReference: webOrderRef,
  };
}
