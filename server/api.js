// server/api.js
import express from "express";
import { firefox } from "playwright";
import { runTimcoOrder } from "../src/timco/runTimcoOrder.js";
import "dotenv/config";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { fetchOrderHistory } from "../src/timco/fetchOrderHistory.js";
import { fetchParcelInfo } from "../src/fetch-parcel/fetch-parcel-info.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

/**
 * SIMPLE IN-MEMORY JOB STORE (OK for single server process).
 * For multi-server or restarts: use Redis / DB.
 */
const jobs = new Map(); // jobId -> { status, result?, error?, createdAt, updatedAt, payloadMeta }
let isBusy = false; // single-run lock

function nowIso() {
  return new Date().toISOString();
}

function makeJobId(orderId) {
  // stable enough for local; use uuid in real production if you prefer
  return `${orderId}-${Date.now()}`;
}

/**
 * Core runner: launches browser + runs workflow + closes resources
 */
async function executeTimcoJob(jobId, payload, opts = {}) {
  const headless = opts.headless ?? process.env.HEADLESS !== "false";
  const timeoutMs =
    opts.timeoutMs ?? Number(process.env.JOB_TIMEOUT_MS || 100000);
  console.log(headless);

  jobs.set(jobId, {
    status: "running",
    createdAt: jobs.get(jobId)?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
    payloadMeta: { orderId: payload?.orderId },
  });

  let browser;
  let context;

  const timeoutHandle = setTimeout(() => {
    // This does not forcibly kill the browser by itself; we handle abort by closing browser in finally.
    // If you want hard abort, you can add an AbortController pattern in your step functions.
  }, timeoutMs);

  try {
    browser = await firefox.launch({ headless });
    context = await browser.newContext();
    const page = await context.newPage();

    // Optional: set a default navigation timeout (defensive)
    page.setDefaultNavigationTimeout(Math.min(timeoutMs, 90000));
    page.setDefaultTimeout(Math.min(timeoutMs, 90000));

    const result = await runTimcoOrder(page, payload);

    jobs.set(jobId, {
      status: result.success ? "succeeded" : "failed",
      result,
      createdAt: jobs.get(jobId)?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      payloadMeta: { orderId: payload?.orderId },
    });

    return result;
  } catch (err) {
    const error = String(err);
    jobs.set(jobId, {
      status: "failed",
      error,
      createdAt: jobs.get(jobId)?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      payloadMeta: { orderId: payload?.orderId },
    });
    return { success: false, failedStep: "apiExecuteTimcoJob", error };
  } finally {
    clearTimeout(timeoutHandle);
    try {
      await context?.close();
    } catch {}
    try {
      await browser?.close();
    } catch {}
    isBusy = false;
  }
}

/**
 * Health
 */
app.get("/health", (req, res) => {
  res.json({ ok: true, busy: isBusy, time: nowIso() });
});

// 🔐 Protect everything under /api
app.use("/api", authMiddleware);

/**
 * Start job:
 * - mode=sync  => waits and returns final result (200/500)
 * - mode=async => returns jobId immediately (202), poll status endpoint
 *
 * Query:
 *  - ?mode=sync|async (default sync)
 */
app.post("/api/timco/order", async (req, res) => {
  const mode = (req.query.mode || "sync").toString().toLowerCase();
  const payload = req.body;
  // console.log(payload);

  // Basic validation (keep it minimal; add zod/joi if you prefer)
  if (!payload?.orderId || !payload?.address || !payload?.csvData) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: orderId, address, csvData",
    });
  }

  // Single-run lock
  if (isBusy) {
    return res.status(409).json({
      success: false,
      error:
        "System busy: another order is currently running. Try again shortly.",
    });
  }

  isBusy = true;
  const jobId = makeJobId(payload.orderId);

  jobs.set(jobId, {
    status: "queued",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    payloadMeta: { orderId: payload.orderId },
  });

  // ASYNC mode: fire and forget, return 202
  if (mode === "async") {
    executeTimcoJob(jobId, payload).catch(() => {});
    return res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/api/timco/order/${jobId}`,
    });
  }

  // SYNC mode: run and wait
  const result = await executeTimcoJob(jobId, payload, { timeoutMs: 100000 });

  if (result?.success) {
    return res.status(200).json({ ...result, jobId });
  }

  return res.status(500).json({ ...result, jobId });
});

/**
 * Poll job status
 */
app.get("/api/timco/order/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }

  return res.json({ success: true, jobId, ...job });
});

/**
 * Optional: list recent jobs (debug)
 */
app.get("/api/timco/jobs", (req, res) => {
  const out = Array.from(jobs.entries())
    .slice(-50)
    .map(([jobId, v]) => ({ jobId, ...v }));
  res.json({ success: true, count: out.length, jobs: out });
});

app.get("/api/timco/fetchOrderHistory", async (req, res) => {
  const opts = { timeoutMs: 100000 };
  const headless = opts.headless ?? process.env.HEADLESS !== "false";
  let browser;
  let context;
  try {
    browser = await firefox.launch({ headless });
    context = await browser.newContext();
    const page = await context.newPage();

    const orders = await fetchOrderHistory(page); // Playwright function

    res.json({
      success: true,
      page: 1,
      count: orders.length,
      orders,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: String(err),
    });
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
});

app.get("/resolve-parcel", async (req, res) => {
  const opts = { timeoutMs: 100000, headless: false };
  const headless = opts.headless ?? process.env.HEADLESS !== "false";
  let browser;
  let context;
  try {
    browser = await firefox.launch({ headless });
    context = await browser.newContext();
    const page = await context.newPage();

    const url = req.query.url;
    const emailNumber = req.query.emailNumber;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "url query param is required",
        example: "/resolve-parcel?url=https://www.dpd.co.uk/d/xxxx",
      });
    }

    const data = await fetchParcelInfo(page, url, emailNumber); // Playwright function
    if (!data.success) {
      return res.status(400).json(data);
    }
    return res.json(data);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: String(err),
    });
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[API] Timco service listening on http://localhost:${port}`);
});
