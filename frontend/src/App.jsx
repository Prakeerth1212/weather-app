import { useState, useCallback } from "react";
import CurrentWeather from "./components/CurrentWeather";
import Forecast from "./components/Forecast";
import QueryHistory from "./components/QueryHistory";
import HistoricalForm from "./components/HistoricalForm";
import MapEmbed from "./components/MapEmbed";
import AirQuality from "./components/AirQuality";
import WeatherAlerts from "./components/WeatherAlerts";
import TravelTips from "./components/TravelTips";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "https://weather-backend.onrender.com");

export default function App() {
  const [tab, setTab] = useState("weather");
  const [locationInput, setLocationInput] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [queries, setQueries] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [unit, setUnit] = useState("C");
  const [alerts, setAlerts] = useState([]);
  const [airQuality, setAirQuality] = useState(null);

  const convertTemp = (celsius) => {
    if (unit === "F") return Math.round((celsius * 9) / 5 + 32);
    return Math.round(celsius);
  };

  const fetchWeather = useCallback(async (loc) => {
    if (!loc.trim()) return;
    setLoading(true);
    setError("");
    setWeatherData(null);
    setAlerts([]);

    try {
      const res = await fetch(
        `${API}/api/weather/current?location=${encodeURIComponent(loc)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch weather");
      setWeatherData(data);

      // Generate alerts
      const newAlerts = [];
      if (data.current.uv_index >= 8) {
        newAlerts.push({
          message: `Extreme UV Index of ${data.current.uv_index}! Use sunscreen.`,
        });
      }
      if (data.current.precipitation > 10) {
        newAlerts.push({
          message: `Heavy rainfall expected (${data.current.precipitation}mm).`,
        });
      }
      if (data.current.wind_speed > 40) {
        newAlerts.push({
          message: `Strong winds (${data.current.wind_speed} km/h).`,
        });
      }
      setAlerts(newAlerts);

      // Mock air quality
      setAirQuality({ us_aqi: 42, pm2_5: 12, pm10: 25 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWithGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = `${pos.coords.latitude},${pos.coords.longitude}`;
        setLocationInput(loc);
        await fetchWeather(loc);
      },
      () => {
        setLoading(false);
        setError("Location permission denied.");
      },
    );
  };

  const loadQueries = useCallback(async () => {
    setQueriesLoading(true);
    try {
      const res = await fetch(`${API}/api/queries`);
      const data = await res.json();
      setQueries(data);
    } catch {
      setQueries([]);
    } finally {
      setQueriesLoading(false);
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") fetchWeather(locationInput);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">◈</span>
            <span className="brand-name">Stratus</span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${tab === "weather" ? "active" : ""}`}
              onClick={() => setTab("weather")}
            >
              Current
            </button>
            <button
              className={`nav-btn ${tab === "historical" ? "active" : ""}`}
              onClick={() => setTab("historical")}
            >
              Historical
            </button>
            <button
              className={`nav-btn ${tab === "history" ? "active" : ""}`}
              onClick={() => setTab("history")}
            >
              Query History
            </button>
          </nav>
          <div className="unit-toggle">
            <button
              className={`unit-btn ${unit === "C" ? "active" : ""}`}
              onClick={() => setUnit("C")}
            >
              °C
            </button>
            <button
              className={`unit-btn ${unit === "F" ? "active" : ""}`}
              onClick={() => setUnit("F")}
            >
              °F
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {tab === "weather" && (
          <>
            <div className="search-section">
              <h1 className="page-title">What's the weather like?</h1>
              <div className="search-row">
                <input
                  className="search-input"
                  type="text"
                  placeholder="e.g. London, New York, Tokyo"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="btn-primary"
                  onClick={() => fetchWeather(locationInput)}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : "Search"}
                </button>
                <button
                  className="btn-gps"
                  onClick={fetchWithGPS}
                  disabled={loading}
                >
                  ⌖ My Location
                </button>
              </div>
              {error && (
                <div className="error-banner">
                  <span className="error-icon">!</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            <WeatherAlerts alerts={alerts} />

            {weatherData && (
              <>
                <CurrentWeather
                  data={weatherData}
                  unit={unit}
                  convertTemp={convertTemp}
                />
                <Forecast
                  forecast={weatherData.forecast}
                  unit={unit}
                  convertTemp={convertTemp}
                />
                <AirQuality data={airQuality} />
                <MapEmbed
                  lat={weatherData.lat}
                  lon={weatherData.lon}
                  name={weatherData.location}
                />
                <TravelTips weatherData={weatherData} />
              </>
            )}

            {!weatherData && !loading && !error && (
              <div className="empty-state">
                <div className="empty-glyph">◌</div>
                <p>Search any location to see weather data</p>
              </div>
            )}
          </>
        )}

        {tab === "historical" && (
          <HistoricalForm api={API} onSaved={loadQueries} />
        )}
        {tab === "history" && (
          <QueryHistory
            api={API}
            queries={queries}
            loading={queriesLoading}
            onRefresh={loadQueries}
          />
        )}
      </main>
    </div>
  );
}
