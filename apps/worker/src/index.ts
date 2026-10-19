import { Worker, Job, Queue } from "bullmq";
import { chromium } from "playwright";
import { execa } from "execa";
import { db } from "db";
import { scans, findings } from "db";
import { eq, sql } from "drizzle-orm";
import { normalizeNucleiFinding } from "shared";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config({ path: "../../.env" });

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
console.log("🔌 Discord Webhook URL loaded:", WEBHOOK_URL ? "YES" : "NO");

async function sendWebhookNotification(targetUrl: string, title: string, severity: string) {
  if (!WEBHOOK_URL) return;
  const payload = { 
    content: `🚨 **${severity.toUpperCase()} VULNERABILITY FOUND** 🚨\n**Title:** ${title}\n**Target:** ${targetUrl}\n**Time:** ${new Date().toISOString()}` 
  };
  try {
    await fetch(WEBHOOK_URL, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    });
    console.log(`🔔 Webhook notification sent for: ${title}`);
  } catch (e) { 
    console.error("Webhook error:", e); 
  }
}

console.log("🔌 Connecting to Redis at localhost:6379...");

// 1. Initialize the Queue (for adding jobs)
const scanQueue = new Queue("sentinelscan-scans", {
  connection: { host: "localhost", port: 6379 },
});

// 2. Initialize the Worker (for processing jobs)
const scanWorker = new Worker(
  "sentinelscan-scans",
  async (job: Job) => {
    console.log("🔥🔥🔥 WORKER RECEIVED JOB:", job.id, job.data);
    const { scanId, targetUrl, scanType = "quick" } = job.data;
    console.log(`🚀 Starting ${scanType} scan for ${targetUrl} (Job: ${job.id})`);

    await db.update(scans).set({ status: "scanning" as any, startedAt: new Date() }).where(eq(scans.id, scanId));

    let findingsCount = 0;

    try {
      console.log(`⚡ Running Nuclei ${scanType} scan for ${targetUrl}...`);
      const templateArgs: string[] = [];
      let timeout = 120000;
      
      if (scanType === "quick") {
        templateArgs.push("-t", "http/technologies/");
        timeout = 120000;
      } else if (scanType === "vulnerability") {
        timeout = 600000;
      } else if (scanType === "full") {
        timeout = 900000;
      }
      
      const { stdout } = await execa("D:\\sentinelscan\\nuclei\\nuclei.exe", [
        "-u", targetUrl, "-jsonl", ...templateArgs, "-ni", "-duc"
      ], { timeout, stdin: "ignore" });

      console.log(`✅ Nuclei run finished for ${targetUrl}`);

      console.log(`📸 Capturing screenshot of ${targetUrl}...`);
      try {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
        const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 50 });
        const screenshotBase64 = screenshotBuffer.toString("base64");
        await browser.close();
        
        console.log(`✅ Screenshot captured! Length: ${screenshotBase64.length} chars. Saving to DB...`);
        await db.execute(sql`UPDATE scans SET screenshot = ${screenshotBase64} WHERE id = ${scanId}`);
        console.log(`✅ Screenshot successfully saved to database!`);
      } catch (screenError: any) {
        console.log(`⚠️ Screenshot failed:`, screenError.message);
      }

      const lines = stdout.split("\n").filter((line) => line.trim() !== "");
      for (const line of lines) {
        try {
          const rawFinding = JSON.parse(line);
          const normalized = normalizeNucleiFinding(rawFinding);
          await db.insert(findings).values({
            scanId,
            fingerprint: normalized.fingerprint || "unknown-fingerprint",
            source: normalized.source,
            cwe: normalized.cwe || null,
            title: normalized.title,
            severity: normalized.severity as any,
            url: normalized.url || null,
            evidence: normalized.evidence || null,
            status: "open",
          });
          findingsCount++;
          
          if (normalized.severity === "high" || normalized.severity === "critical") {
            await sendWebhookNotification(targetUrl, normalized.title, normalized.severity);
          }
        } catch (e) { /* ignore non-JSON lines */ }
      }
    } catch (error: any) {
      console.error(`❌ Scan failed for ${targetUrl}:`, error.message);
    }

    await db.update(scans).set({ status: "done" as any, finishedAt: new Date() }).where(eq(scans.id, scanId));
    console.log(`🎉 Scan completed successfully. Saved ${findingsCount} findings.`);
  },
  { connection: { host: "localhost", port: 6379 }, concurrency: 2 }
);

console.log("👂 Scan Worker is running and listening for jobs on queue: 'sentinelscan-scans'");

// 3. Initialize the Scheduler
console.log("⏰ Setting up scheduled scans (Running every 1 minute for testing)...");
cron.schedule('0 2 * * *', async () => {
  console.log("⏰ Running scheduled scan check...");
  try {
    const targets = await db.execute(sql`SELECT id, base_url FROM targets WHERE verified = true`);
    const rows = Array.isArray(targets) ? targets : (targets as any).rows || [];
    
    for (const t of rows) {
      const newScan = await db.execute(sql`
        INSERT INTO scans (target_id, status, scan_type, started_at) 
        VALUES (${t.id}, 'queued', 'scheduled', NOW()) 
        RETURNING id
      `);
      const scanId = (Array.isArray(newScan) ? newScan : (newScan as any).rows || [])[0].id;
      
      await scanQueue.add("run-scan", { 
        scanId, 
        targetUrl: t.base_url, 
        scanType: "vulnerability" 
      });
      console.log(`✅ Queued scheduled scan for ${t.base_url} (Scan ID: ${scanId})`);
    }
  } catch (e) { 
    console.error("❌ Scheduler error:", e); 
  }
});

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down worker...");
  await scanWorker.close();
  await scanQueue.close();
  process.exit(0);
});
