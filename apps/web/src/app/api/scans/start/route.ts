import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { db, targets, scans } from "db";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const scanQueue = new Queue("sentinelscan-scans", {
  connection: { host: "localhost", port: 6379 },
});

export async function POST(request: Request) {
  try {
    const { targetId, scanType = "quick" } = await request.json();
    if (!targetId) return NextResponse.json({ error: "Missing targetId" }, { status: 400 });
    
    const targetList = await db.select().from(targets).where(eq(targets.id, targetId));
    const target = targetList[0];
    
    if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });
    if (!target.verified) return NextResponse.json({ error: "Target must be verified before scanning" }, { status: 403 });
    
    const scanId = randomUUID();
    await db.insert(scans).values({ 
      id: scanId, 
      targetId: target.id, 
      status: "queued" 
    });
    
    await scanQueue.add("run-scan", { 
      scanId, 
      targetUrl: target.baseUrl,
      scanType
    });
    
    return NextResponse.json({ success: true, scanId, message: "Scan queued successfully!" });
  } catch (error) {
    console.error("Error starting scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
