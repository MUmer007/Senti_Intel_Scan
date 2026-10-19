import { NextResponse } from "next/server";
import { db } from "db";
import { sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Find or create a target for this user
    let target = await db.execute(sql`SELECT id, base_url FROM targets WHERE org_id = ${userId} LIMIT 1`);
    let targetRow = (Array.isArray(target) ? target : (target as any).rows || [])[0];

    if (!targetRow) {
      const newTarget = await db.execute(sql`INSERT INTO targets (org_id, base_url, verified, verify_token) VALUES (${userId}, 'http://simulated-target.com', true, 'mock-token') RETURNING id, base_url`);
      targetRow = (Array.isArray(newTarget) ? newTarget : (newTarget as any).rows || [])[0];
    }

    // 2. Find or create a scan for this target
    let scan = await db.execute(sql`SELECT id FROM scans WHERE target_id = ${targetRow.id} ORDER BY started_at DESC LIMIT 1`);
    let scanRow = (Array.isArray(scan) ? scan : (scan as any).rows || [])[0];

    if (!scanRow) {
      const newScan = await db.execute(sql`INSERT INTO scans (target_id, status, scan_type, started_at) VALUES (${targetRow.id}, 'done', 'manual', NOW()) RETURNING id`);
      scanRow = (Array.isArray(newScan) ? newScan : (newScan as any).rows || [])[0];
    }

    // 3. Insert the mock Critical finding
    await db.execute(sql`
      INSERT INTO findings (scan_id, fingerprint, source, cwe, title, severity, url, evidence, status, created_at)
      VALUES (
        ${scanRow.id},
        'mock-fingerprint-${Date.now()}',
        'manual_audit',
        'CWE-89: SQL Injection',
        'Critical SQL Injection in Login Form',
        'critical',
        ${targetRow.base_url + '/login.php?user=admin'},
        '{"payload": "\' OR 1=1 --", "response": "Database error near syntax"}',
        'open',
        NOW()
      )
    `);

    return NextResponse.json({ message: "Simulated finding added!" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
