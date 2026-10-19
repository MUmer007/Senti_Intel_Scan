"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Shield, AlertTriangle, CheckCircle, ArrowLeft, Search, Filter, X, FileText, Globe, Hash } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

interface Scan {
  id: string;
  status: string;
  startedAt: Date | null;
  targetUrl: string | null;
  screenshot: string | null;
}

interface Finding {
  id: string;
  scanId: string;
  title: string;
  severity: string;
  url: string | null;
  status: string;
  evidence: any;
  cwe: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-gray-100 text-gray-800 border-gray-200",
};

const CHART_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#9ca3af",
};

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setScans(data.scans || []);
      setFindings(data.findings || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(30, 64, 175);
    doc.text("SentinelScan Vulnerability Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Findings: ${filteredFindings.length}`, 14, 36);

    const tableColumn = ["Severity", "Title", "Target URL", "Status"];
    const tableRows = filteredFindings.map((finding: Finding) => [
      finding.severity.toUpperCase(),
      finding.title,
      finding.url || "N/A",
      finding.status.toUpperCase()
    ]);

    const didParseCell = (data: any) => {
      if (data.section === 'body' && data.column.index === 0) {
        const severity = (data.cell.raw[0] || '').toString().toLowerCase();
        if (severity === 'critical') data.cell.styles.textColor = [220, 38, 38];
        if (severity === 'high') data.cell.styles.textColor = [234, 88, 12];
        if (severity === 'medium') data.cell.styles.textColor = [202, 138, 4];
        if (severity === 'low') data.cell.styles.textColor = [37, 99, 235];
        if (severity === 'info') data.cell.styles.textColor = [100, 116, 139];
      }
    };

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      didParseCell: didParseCell,
    });

    doc.save(`SentinelScan-Report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const chartData = Object.keys(SEVERITY_COLORS).map(sev => ({
    name: sev.charAt(0).toUpperCase() + sev.slice(1),
    value: findings.filter(f => f.severity?.toLowerCase() === sev).length,
    color: CHART_COLORS[sev]
  })).filter(d => d.value > 0);

  const filteredFindings = findings.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.url?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === "all" || f.severity?.toLowerCase() === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const criticalCount = findings.filter(f => ["critical", "high"].includes(f.severity?.toLowerCase())).length;
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "done": return "text-green-600 bg-green-50";
      case "scanning": return "text-blue-600 bg-blue-50 animate-pulse";
      case "failed": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  if (loading && scans.length === 0) {
    return <div className="flex min-h-screen items-center justify-center"><RefreshCw className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
                {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-200 rounded-full transition">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Security Dashboard</h1>
              <p className="text-slate-500">Overview of your scans and vulnerability findings.</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={exportToPDF} 
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
            >
              📄 Export PDF Report
            </button>
            <button 
              onClick={fetchData} 
              disabled={loading} 
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </button>
          </div>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2"><Shield className="h-6 w-6 text-blue-600" /></div>
              <div><p className="text-sm font-medium text-slate-500">Total Scans</p><p className="text-2xl font-bold text-slate-900">{scans.length}</p></div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2"><AlertTriangle className="h-6 w-6 text-purple-600" /></div>
              <div><p className="text-sm font-medium text-slate-500">Total Findings</p><p className="text-2xl font-bold text-slate-900">{findings.length}</p></div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <div><p className="text-sm font-medium text-slate-500">High / Critical</p><p className="text-2xl font-bold text-red-600">{criticalCount}</p></div>
            </div>
          </div>
        </div>

        {/* Severity Pie Chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Findings by Severity</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Findings Table */}
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Findings</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search findings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none">
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Target URL</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredFindings.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No findings match your filters.</td></tr>
                ) : (
                  filteredFindings.map((finding) => (
                    <tr key={finding.id} onClick={() => setSelectedFinding(finding)} className="hover:bg-blue-50/50 transition cursor-pointer group">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${SEVERITY_COLORS[finding.severity?.toLowerCase() || "info"]}`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-blue-700 transition">{finding.title}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs truncate max-w-xs">{finding.url || "N/A"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${getStatusColor(finding.status)}`}>
                          {finding.status === "open" && <AlertTriangle className="h-3 w-3" />}
                          {finding.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Modal */}
        {selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedFinding(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${SEVERITY_COLORS[selectedFinding.severity?.toLowerCase() || "info"]}`}>
                    {selectedFinding.severity}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900">{selectedFinding.title}</h3>
                </div>
                <button onClick={() => setSelectedFinding(null)} className="p-2 hover:bg-slate-100 rounded-full transition">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {selectedFinding.cwe && (
                  <div className="flex items-start gap-3">
                    <Hash className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">CWE Classification</p>
                      <p className="text-sm text-slate-600">{selectedFinding.cwe}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Affected Target</p>
                    <p className="text-sm text-slate-600 font-mono break-all">{selectedFinding.url || "N/A"}</p>
                  </div>
                </div>

                {/* Screenshot Preview */}
                {scans.find(s => s.id === selectedFinding.scanId)?.screenshot && (
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 text-slate-400 mt-0.5 flex items-center justify-center">📸</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 mb-2">Target Screenshot</p>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                        <img src={`data:image/jpeg;base64,${scans.find(s => s.id === selectedFinding.scanId)?.screenshot}`} alt="Target Screenshot" className="w-full h-auto max-h-96 object-contain" />
                      </div>
                    </div>
                  </div>
                )}

                {selectedFinding.evidence && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 mb-2">Evidence / Extracted Results</p>
                      <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono">
                        {typeof selectedFinding.evidence === 'string' ? selectedFinding.evidence : JSON.stringify(selectedFinding.evidence, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end">
                <button onClick={() => setSelectedFinding(null)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}