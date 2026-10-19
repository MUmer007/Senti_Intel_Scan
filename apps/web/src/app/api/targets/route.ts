import { NextResponse } from "next/server";
import { db } from "db";
import { auth } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTargets = await db.execute(sql`
      SELECT id, base_url as "baseUrl", verified, verify_token, created_at 
      FROM targets 
      WHERE org_id = ${userId}
      ORDER BY created_at DESC
    `);
    
    const rows = Array.isArray(userTargets) ? userTargets : (userTargets as any).rows || [];
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Targets GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("📥 Received add target request:", body);

    const targetUrl = body.baseUrl || body.url || body.targetUrl;

    if (!targetUrl) {
      return NextResponse.json({ error: "Target URL is required." }, { status: 400 });
    }

    const verifyToken = crypto.randomUUID();

    // UPSERT: Insert, but if base_url already exists, update it instead of crashing
    const result = await db.execute(sql`
      INSERT INTO targets (org_id, base_url, verified, verify_token)
      VALUES (${userId}, ${targetUrl}, false, ${verifyToken})
      ON CONFLICT (base_url) 
      DO UPDATE SET 
        org_id = EXCLUDED.org_id,
        verify_token = EXCLUDED.verify_token,
        verified = false
      RETURNING id, base_url as "baseUrl", verify_token
    `);

    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    const newTarget = rows[0];

    return NextResponse.json({ 
      message: "Target added successfully", 
      verifyToken: newTarget.verify_token 
    }, { status: 201 });
  } catch (error: any) {
    console.error("Targets POST Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
