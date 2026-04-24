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

function windDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv) {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}

export default function CurrentWeather({ data, unit, convertTemp }) {
  const { current, location } = data;
  const icon = WMO_ICONS[current.weather_code] ?? "🌡️";

  return (
    <div className="card">
      <div className="card-title">Current Conditions</div>
      <div className="current-weather-grid">
        <div className="current-main">
          <div className="current-temp">
            {convertTemp(current.temperature)}°{unit}
          </div>
          <div className="current-feels">
            Feels like {convertTemp(current.feels_like)}°{unit}
          </div>
          <div className="current-desc">{current.description}</div>
          <div className="current-location">{location}</div>
        </div>
        <div className="weather-icon-large">{icon}</div>
      </div>

      <div className="current-stats">
        <div className="stat">
          <span className="stat-label">Humidity</span>
          <span className="stat-value">{current.humidity}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Wind</span>
          <span className="stat-value">
            {Math.round(current.wind_speed)} km/h{" "}
            {windDir(current.wind_direction)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Precipitation</span>
          <span className="stat-value">{current.precipitation} mm</span>
        </div>
        <div className="stat">
          <span className="stat-label">UV Index</span>
          <span className="stat-value">
            {current.uv_index}{" "}
            <small
              style={{
                fontFamily: "var(--sans)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              {uvLabel(current.uv_index)}
            </small>
          </span>
        </div>
      </div>
    </div>
  );
}
