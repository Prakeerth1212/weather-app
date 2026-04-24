const WMO_ICONS = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "❄️",
  80: "🌦️",
  81: "🌦️",
  82: "⛈️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

function formatDay(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function Forecast({ forecast, unit, convertTemp }) {
  return (
    <div className="card">
      <div className="card-title">5-Day Forecast</div>
      <div className="forecast-row">
        {forecast.map((day) => (
          <div className="forecast-day" key={day.date}>
            <div className="forecast-date">{formatDay(day.date)}</div>
            <div className="forecast-icon">
              {WMO_ICONS[day.weather_code] ?? "🌡️"}
            </div>
            <div className="forecast-desc">{day.description}</div>
            <div className="forecast-temps">
              <span className="temp-max">
                {convertTemp(day.temp_max)}°{unit}
              </span>
              <span className="temp-min">
                {convertTemp(day.temp_min)}°{unit}
              </span>
            </div>
            {day.precipitation > 0 && (
              <div
                style={{ fontSize: "11px", color: "#4a7fc1", marginTop: "4px" }}
              >
                💧 {day.precipitation}mm
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
