"use client";

import { useState, useEffect } from "react";
import { Shield, Zap, Target, Search, AlertTriangle } from "lucide-react";

interface Target {
  id: string;
  baseUrl: string;
  verified: boolean;
  verifyToken: string;
}

export default function Home() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [scanType, setScanType] = useState<"quick" | "vulnerability" | "full">("vulnerability");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchTargets = async () => {
    const res = await fetch("/api/targets");
    const data = await res.json();
    setTargets(data.targets || []);
  };

  useEffect(() => { fetchTargets(); }, []);

  const addTarget = async () => {
    if (!newUrl) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ Target added! Verify token: ${data.verifyToken}`);
        setNewUrl("");
        fetchTargets();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (e) {
      setMessage("❌ Failed to add target");
    } finally {
      setLoading(false);
    }
  };

  const startScan = async () => {
    if (!selectedTargetId) {
      setMessage("❌ Please select a verified target first");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/scans/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: selectedTargetId, scanType }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`🚀 ${scanType} scan queued! ID: ${data.scanId}`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (e) {
      setMessage("❌ Failed to start scan");
    } finally {
      setLoading(false);
    }
  };

  const verifiedTargets = targets.filter(t => t.verified);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 pt-12">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-medium">SentinelScan v1.0</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Enterprise Vulnerability Scanner
          </h1>
          <p className="text-slate-300 text-lg">
            Powered by Nuclei • Real-time scans • Professional dashboard
          </p>
        </div>

        {/* Add Target */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" />
            Add New Target
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400"
            />
            <button
              onClick={addTarget}
              disabled={loading || !newUrl}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition"
            >
              Add Target
            </button>
          </div>
        </div>

        {/* Start Scan */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Start Scan
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Verified Target</label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="" className="bg-slate-800">-- Choose a target --</option>
                {verifiedTargets.map(t => (
                  <option key={t.id} value={t.id} className="bg-slate-800">
                    {t.baseUrl}
                  </option>
                ))}
              </select>
              {verifiedTargets.length === 0 && (
                <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  No verified targets. Add a target and verify it in the database first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Scan Profile</label>
              <select
                value={scanType}
                onChange={(e) => setScanType(e.target.value as any)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="quick" className="bg-slate-800">⚡ Quick Scan - Technologies only (30-60s)</option>
                <option value="vulnerability" className="bg-slate-800">🛡️ Vulnerability Scan - XSS, SQLi, SSRF (3-5 min)</option>
                <option value="full" className="bg-slate-800">🔥 Full Scan - All 11,000+ templates (10-15 min)</option>
              </select>
            </div>

            <button
              onClick={startScan}
              disabled={loading || !selectedTargetId}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-semibold text-lg transition disabled:opacity-50"
            >
              {loading ? "Starting..." : "🚀 Launch Scan"}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
            <p className="text-sm font-mono">{message}</p>
          </div>
        )}

        {/* Quick Links */}
        <div className="flex justify-center gap-4 pt-4">
          <a href="/dashboard" className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 rounded-lg font-medium transition flex items-center gap-2">
            <Search className="h-4 w-4" />
            View Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
