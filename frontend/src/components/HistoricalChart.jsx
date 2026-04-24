import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function HistoricalChart({ data }) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (data && data.daily) {
      const formatted = data.daily.time.map((date, idx) => ({
        date: new Date(date).toLocaleDateString(),
        maxTemp: data.daily.temperature_2m_max?.[idx],
        minTemp: data.daily.temperature_2m_min?.[idx],
        avgTemp: data.daily.temperature_2m_mean?.[idx],
      }));
      setChartData(formatted);
    }
  }, [data]);

  if (!chartData.length) return null;

  return (
    <div className="chart-container">
      <div className="card-title">Temperature Trend</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd4" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#7a7870" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#7a7870" }}
            label={{
              value: "Temperature (°C)",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e0ddd4",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="maxTemp"
            stroke="#f44336"
            name="Max Temp"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="avgTemp"
            stroke="#2196f3"
            name="Avg Temp"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="minTemp"
            stroke="#4caf50"
            name="Min Temp"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
