export default function AirQuality({ data }) {
  if (!data) return null;

  return (
    <div className="card">
      <div className="card-title">Air Quality</div>
      <div>
        <div style={{ fontSize: "48px", fontWeight: "700" }}>
          {data.us_aqi || "—"}
        </div>
        <div>PM2.5: {data.pm2_5 || "—"} µg/m³</div>
        <div>PM10: {data.pm10 || "—"} µg/m³</div>
      </div>
    </div>
  );
}
