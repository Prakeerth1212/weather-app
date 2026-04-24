import { useState } from "react";

export default function HistoricalForm({ api, onSaved }) {
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [result, setResult]   = useState(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    setError("");
    setResult(null);

    if (!location.trim())    { setError("Please enter a location."); return; }
    if (!dateFrom || !dateTo) { setError("Please select both start and end dates."); return; }
    if (dateFrom > dateTo)   { setError("Start date must be before end date."); return; }
    if (dateTo > todayStr)   { setError("End date cannot be in the future."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${api}/api/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, date_from: dateFrom, date_to: dateTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setResult(data);
      onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="historical-section">
      <h2 className="form-title">Historical Weather Lookup</h2>
      <p className="form-sub">
        Query past temperature data for any location and date range. Results are saved to the database.
      </p>

      <div className="form-group" style={{ marginBottom: "16px" }}>
        <label className="form-label">Location</label>
        <input
          className="form-input"
          style={{ width: "100%" }}
          type="text"
          placeholder="e.g. New York, Paris, 560001"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Start Date</label>
          <input
            className="form-input"
            type="date"
            value={dateFrom}
            max={todayStr}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">End Date</label>
          <input
            className="form-input"
            type="date"
            value={dateTo}
            max={todayStr}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: "16px" }}>
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? <><span className="spinner" /> Fetching data…</> : "Fetch & Save"}
      </button>

      {result && (
        <div className="result-card">
          <h3>Saved — {result.location}</h3>
          <div className="result-stats">
            <div className="result-stat">
              <div className="result-stat-label">Avg Temp</div>
              <div className="result-stat-value">{result.avg_temp_c ?? "—"}°C</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-label">Min Temp</div>
              <div className="result-stat-value">{result.min_temp_c ?? "—"}°C</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-label">Max Temp</div>
              <div className="result-stat-value">{result.max_temp_c ?? "—"}°C</div>
            </div>
            <div className="result-stat">
              <div className="result-stat-label">Avg Humidity</div>
              <div className="result-stat-value">{result.avg_humidity ?? "—"}%</div>
            </div>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>
            Record ID #{result.id} saved. View in Query History tab.
          </p>
        </div>
      )}
    </div>
  );
}
