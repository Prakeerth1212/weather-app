export default function TravelTips({ weatherData }) {
  if (!weatherData) return null;

  const wind = weatherData.current.wind_speed;
  const precip = weatherData.current.precipitation;
  let risk = "Low";

  if (wind > 40 || precip > 20) risk = "High";
  else if (wind > 25 || precip > 10) risk = "Moderate";

  return (
    <div className="card">
      <div className="card-title">✈️ Travel Tips</div>
      <div>
        Flight Disruption Risk: <strong>{risk}</strong>
      </div>
      {risk === "High" && (
        <div style={{ fontSize: "12px", marginTop: "8px" }}>
          Check with airline before departure
        </div>
      )}
    </div>
  );
}
