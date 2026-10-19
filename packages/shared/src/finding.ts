import { z } from "zod";
import { createHash } from "node:crypto";

export const FindingSource = z.enum(["nuclei", "zap", "passive", "qa-agent", "semgrep", "gitleaks"]);
export const FindingSeverity = z.enum(["info", "low", "medium", "high", "critical"]);
export const FindingVerdict = z.enum(["true_positive", "false_positive", "needs_review"]);
export const FindingStatus = z.enum(["open", "fixed", "accepted", "regressed"]);

export const FindingSchema = z.object({
  source: FindingSource,
  title: z.string().min(1, "Title is required"),
  cwe: z.string().optional(),
  severity: FindingSeverity,
  url: z.string().optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
  fingerprint: z.string().optional(),
});

export type Finding = z.infer<typeof FindingSchema>;

export function generateFingerprint(finding: Partial<Finding>): string {
  const cwe = finding.cwe || "UNKNOWN";
  const title = finding.title || "UNKNOWN";
  
  let pathname = "/";
  if (finding.url) {
    try {
      pathname = new URL(finding.url).pathname;
    } catch {
      pathname = finding.url;
    }
  }
  
  const rawString = `${cwe}|${title}|${pathname}`;
  return createHash("sha256").update(rawString).digest("hex");
}

export function normalizeNucleiFinding(raw: any): Finding {
  const url = raw.host || raw.matched;
  const baseFinding = {
    source: "nuclei" as const,
    title: raw.info?.name || "Unknown Nuclei Finding",
    cwe: raw.info?.tags?.find((t: string) => t.toLowerCase().startsWith("cwe-"))?.toUpperCase().replace("CWE-", "CWE-") || undefined,
    severity: (raw.info?.severity || "info").toLowerCase(),
    url: url,
    evidence: {
      template: raw.template,
      matched: raw.matched,
      extracted: raw.extracted_results || raw["extracted-results"],
      curl_command: raw["curl-command"],
    },
  };

  return {
    ...baseFinding,
    fingerprint: generateFingerprint(baseFinding),
  };
}