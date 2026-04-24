import { useState } from "react";

export default function QueryHistory({ api, queries, loading, onRefresh }) {
  const [editId, setEditId] = useState(null);
  const [editLoc, setEditLoc] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [exportFmt, setExportFmt] = useState("json");

  const startEdit = (row) => {
    setEditId(row.id);
    setEditLoc(row.location);
    setEditSummary(row.summary || "");
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const res = await fetch(`${api}/api/queries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: editLoc, summary: editSummary }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditId(null);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`${api}/api/queries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleteId(null);
    }
  };

  const escapeXml = (str) => {
    if (!str) return "";
    return str.replace(/[<>&'"]/g, function (c) {
      if (c === "<") return "&lt;";
      if (c === ">") return "&gt;";
      if (c === "&") return "&amp;";
      if (c === "'") return "&apos;";
      if (c === '"') return "&quot;";
      return c;
    });
  };

  const handleExport = async () => {
    if (exportFmt === "pdf") {
      // Generate PDF using browser print
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Weather Queries Export</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { color: #2d5a3d; }
            </style>
          </head>
          <body>
            <h1>Stratus Weather - Query History Export</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Location</th>
                  <th>Date From</th>
                  <th>Date To</th>
                  <th>Avg Temp (°C)</th>
                  <th>Min Temp</th>
                  <th>Max Temp</th>
                  <th>Humidity</th>
                </tr>
              </thead>
              <tbody>
                ${queries
                  .map(
                    (q) => `
                  <tr>
                    <td>${q.id}</td>
                    <td>${escapeXml(q.location)}</td>
                    <td>${q.date_from}</td>
                    <td>${q.date_to}</td>
                    <td>${q.avg_temp_c || "—"}</td>
                    <td>${q.min_temp_c || "—"}</td>
                    <td>${q.max_temp_c || "—"}</td>
                    <td>${q.avg_humidity || "—"}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else if (exportFmt === "xml") {
      // Generate XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<queries>\n';
      queries.forEach((q) => {
        xml += `  <query>\n`;
        xml += `    <id>${q.id}</id>\n`;
        xml += `    <location>${escapeXml(q.location)}</location>\n`;
        xml += `    <date_from>${q.date_from}</date_from>\n`;
        xml += `    <date_to>${q.date_to}</date_to>\n`;
        xml += `    <avg_temp_c>${q.avg_temp_c || ""}</avg_temp_c>\n`;
        xml += `    <min_temp_c>${q.min_temp_c || ""}</min_temp_c>\n`;
        xml += `    <max_temp_c>${q.max_temp_c || ""}</max_temp_c>\n`;
        xml += `    <avg_humidity>${q.avg_humidity || ""}</avg_humidity>\n`;
        xml += `  </query>\n`;
      });
      xml += "</queries>";

      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "weather_queries.xml";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.open(`${api}/api/export?format=${exportFmt}`, "_blank");
    }
  };

  return (
    <div>
      <div className="history-header">
        <h2 className="history-title">Query History</h2>
        <div className="history-actions">
          <button className="btn-secondary" onClick={onRefresh}>
            ↻ Refresh
          </button>
          <select
            className="export-select"
            value={exportFmt}
            onChange={(e) => setExportFmt(e.target.value)}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="markdown">Markdown</option>
            <option value="xml">XML</option>
            <option value="pdf">PDF</option>
          </select>
          <button className="btn-secondary" onClick={handleExport}>
            ⬇ Export
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="queries-table-wrap">
          <table className="queries-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Location</th>
                <th>Date Range</th>
                <th>Avg °C</th>
                <th>Min / Max</th>
                <th>Humidity</th>
                <th>Summary</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="loading-row">
                  <td colSpan={8}>Loading…</td>
                </tr>
              )}
              {!loading && queries.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={8}>
                    No queries yet. Use the Historical tab to fetch and save
                    weather data.
                  </td>
                </tr>
              )}
              {!loading &&
                queries.map((row) => (
                  <tr key={row.id}>
                    <td className="mono" style={{ color: "var(--text-muted)" }}>
                      {row.id}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="edit-input"
                          value={editLoc}
                          onChange={(e) => setEditLoc(e.target.value)}
                        />
                      ) : (
                        <span style={{ fontSize: "13px" }}>{row.location}</span>
                      )}
                    </td>
                    <td
                      className="mono"
                      style={{ fontSize: "12px", whiteSpace: "nowrap" }}
                    >
                      {row.date_from} → {row.date_to}
                    </td>
                    <td className="mono">{row.avg_temp_c ?? "—"}</td>
                    <td className="mono" style={{ fontSize: "12px" }}>
                      {row.min_temp_c ?? "—"} / {row.max_temp_c ?? "—"}
                    </td>
                    <td className="mono">
                      {row.avg_humidity != null ? `${row.avg_humidity}%` : "—"}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <input
                          className="edit-input"
                          value={editSummary}
                          onChange={(e) => setEditSummary(e.target.value)}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {row.summary || "—"}
                        </span>
                      )}
                    </td>
                    <td>
                      {editId === row.id ? (
                        <div className="row-actions">
                          <button
                            className="btn-save"
                            onClick={() => saveEdit(row.id)}
                            disabled={saving}
                          >
                            Save
                          </button>
                          <button className="btn-cancel" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="row-actions">
                          <button
                            className="btn-edit"
                            onClick={() => startEdit(row)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(row.id)}
                            disabled={deleteId === row.id}
                          >
                            {deleteId === row.id ? "…" : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginTop: "10px",
        }}
      >
        {queries.length} record{queries.length !== 1 ? "s" : ""} · Export
        downloads all records
      </p>
    </div>
  );
}
