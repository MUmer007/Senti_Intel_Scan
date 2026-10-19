const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'apps', 'web', 'src', 'app');
const apiDir = path.join(baseDir, 'api', 'targets');

// 1. Create directories
if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
}

// 2. Write page.tsx
const pageContent = `"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setVerifyToken(null);

    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: url, orgId: "org_123" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add target");
      setVerifyToken(data.verifyToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Add a Target</CardTitle>
          <CardDescription>
            Enter the URL of the website you want to scan. You must prove ownership to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!verifyToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Generate Verification Token"
                )}
              </Button>
            </form>
          ) : (
            <Alert className="bg-green-50 border-green-200">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Token Generated!</AlertTitle>
              <AlertDescription className="mt-2 text-sm text-green-700">
                <p className="mb-2">To prove ownership, add this TXT record to your DNS:</p>
                <code className="block bg-white p-2 rounded border border-green-200 text-xs font-mono break-all">
                  sentinelscan-verify={verifyToken}
                </code>
                <p className="mt-2">Or create a file at <code>/.well-known/sentinelscan.txt</code> containing the token.</p>
                <Button className="mt-4 w-full" variant="outline">
                  I have added the record, Verify Now
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
`;

fs.writeFileSync(path.join(baseDir, 'page.tsx'), pageContent);

// 3. Write route.ts
const routeContent = `import { NextResponse } from "next/server";
import { db } from "db";
import { targets } from "db";
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { baseUrl, orgId } = body;

    if (!baseUrl || !orgId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const verifyToken = randomUUID();

    const [newTarget] = await db
      .insert(targets)
      .values({
        orgId: orgId,
        baseUrl: baseUrl,
        verified: false,
        verifyToken: verifyToken,
      })
      .returning();

    return NextResponse.json({ success: true, target: newTarget, verifyToken }, { status: 201 });
  } catch (error) {
    console.error("Error creating target:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
`;

fs.writeFileSync(path.join(apiDir, 'route.ts'), routeContent);

console.log('✅ Folder structure and files created successfully!');