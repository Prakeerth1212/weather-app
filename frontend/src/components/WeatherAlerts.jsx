export default function WeatherAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: "20px" }}>
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "10px",
            background: "#fee",
            borderLeft: "4px solid #b84040",
            color: "#b84040",
          }}
        >
          ⚠️ {alert.message}
        </div>
      ))}
    </div>
  );
}
