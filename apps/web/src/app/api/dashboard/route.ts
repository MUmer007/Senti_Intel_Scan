import { NextResponse } from "next/server";
import { db } from "db";
import { sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ Fetching data for authenticated user:", userId);

    // 1. Fetch user's scans using Raw SQL to bypass any Drizzle type/serialization issues
    const userScansResult = await db.execute(sql`
      SELECT 
        s.id, 
        s.status, 
        s.started_at as "startedAt", 
        t.base_url as "targetUrl",
        s.screenshot
      FROM scans s
      LEFT JOIN targets t ON s.target_id = t.id
      WHERE t.org_id = ${userId}
      ORDER BY s.started_at DESC
      LIMIT 10
    `);

    const userScans = Array.isArray(userScansResult) ? userScansResult : (userScansResult as any).rows || [];
    console.log("✅ Found scans:", userScans.length);

    let userFindings: any[] = [];
    if (userScans.length > 0) {
      const scanIds = userScans.map((s: any) => s.id).filter((id: any) => id);
      if (scanIds.length > 0) {
        const idsList = scanIds.map((id: string) => `'${id}'`).join(',');
        
        const findingsResult = await db.execute(sql`
          SELECT * FROM findings
          WHERE scan_id IN (${sql.raw(idsList)})
          ORDER BY created_at DESC
          LIMIT 100
        `);
        userFindings = Array.isArray(findingsResult) ? findingsResult : (findingsResult as any).rows || [];
      }
    }

    return NextResponse.json({
      scans: userScans,
      findings: userFindings,
    });
  } catch (error: any) {
    console.error("❌ Dashboard API Error Details:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}
