from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
import sqlite3
import json
import csv
import io
import os
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel

app = FastAPI(title="Weather App API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
DB_PATH = "weather.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS weather_queries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            date_from TEXT NOT NULL,
            date_to TEXT NOT NULL,
            avg_temp_c REAL,
            min_temp_c REAL,
            max_temp_c REAL,
            avg_humidity REAL,
            summary TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Models
class QueryCreate(BaseModel):
    location: str
    date_from: str
    date_to: str

class QueryUpdate(BaseModel):
    location: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    summary: Optional[str] = None

# Helper Functions
async def geocode(location: str) -> dict:
    """Convert location name or coordinates to lat/lon"""
    
    # Check if location is already coordinates (contains comma and both parts are numbers)
    if ',' in location:
        try:
            parts = location.split(',')
            lat = float(parts[0].strip())
            lon = float(parts[1].strip())
            return {
                "display_name": f"Coordinates {lat}, {lon}",
                "lat": lat,
                "lon": lon,
            }
        except:
            pass 
    
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": location, "count": 1, "format": "json"},
        )
        data = resp.json()
        
        if not data.get("results"):
            raise HTTPException(status_code=404, detail=f"Location '{location}' not found")
        
        result = data["results"][0]
        return {
            "display_name": f"{result['name']}, {result.get('admin1', '')}, {result['country']}".strip(", "),
            "lat": result["latitude"],
            "lon": result["longitude"],
        }

async def fetch_current_weather(lat: float, lon: float) -> dict:
    """Fetch current weather"""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index",
                "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,uv_index_max",
                "timezone": "auto",
                "forecast_days": 6,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Weather API unavailable")
        return resp.json()

async def fetch_historical_weather(lat: float, lon: float, date_from: str, date_to: str) -> dict:
    """Fetch historical weather"""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": lat,
                "longitude": lon,
                "start_date": date_from,
                "end_date": date_to,
                "daily": "temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean",
                "timezone": "auto",
            },
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Historical weather API unavailable")
        return resp.json()

def wmo_description(code: int) -> str:
    codes = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Icing fog", 51: "Light drizzle", 53: "Moderate drizzle",
        55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
        80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Heavy thunderstorm",
    }
    return codes.get(code, "Unknown")

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Weather App API", "status": "running"}

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/weather/current")
async def get_current_weather(location: str = Query(..., min_length=1)):
    try:
        geo = await geocode(location)
        raw = await fetch_current_weather(geo["lat"], geo["lon"])
        cur = raw["current"]
        daily = raw["daily"]

        forecast = []
        for i in range(1, min(6, len(daily["time"]))):
            forecast.append({
                "date": daily["time"][i],
                "temp_max": daily["temperature_2m_max"][i],
                "temp_min": daily["temperature_2m_min"][i],
                "weather_code": daily["weather_code"][i],
                "description": wmo_description(daily["weather_code"][i]),
                "precipitation": daily["precipitation_sum"][i],
                "uv_index": daily.get("uv_index_max", [0])[i] if "uv_index_max" in daily else 0,
            })

        return {
            "location": geo["display_name"],
            "lat": geo["lat"],
            "lon": geo["lon"],
            "current": {
                "temperature": cur["temperature_2m"],
                "feels_like": cur["apparent_temperature"],
                "humidity": cur["relative_humidity_2m"],
                "wind_speed": cur["wind_speed_10m"],
                "wind_direction": cur["wind_direction_10m"],
                "weather_code": cur["weather_code"],
                "description": wmo_description(cur["weather_code"]),
                "precipitation": cur["precipitation"],
                "uv_index": cur.get("uv_index", 0),
                "time": cur["time"],
            },
            "forecast": forecast,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/queries", status_code=201)
async def create_query(body: QueryCreate):
    try:
        geo = await geocode(body.location)
        hist = await fetch_historical_weather(geo["lat"], geo["lon"], body.date_from, body.date_to)
        daily = hist["daily"]
        
        temps_mean = [t for t in daily.get("temperature_2m_mean", []) if t is not None]
        temps_max = [t for t in daily.get("temperature_2m_max", []) if t is not None]
        temps_min = [t for t in daily.get("temperature_2m_min", []) if t is not None]
        humids = [h for h in daily.get("relative_humidity_2m_mean", []) if h is not None]
        
        avg_temp = round(sum(temps_mean) / len(temps_mean), 1) if temps_mean else None
        max_temp = round(max(temps_max), 1) if temps_max else None
        min_temp = round(min(temps_min), 1) if temps_min else None
        avg_hum = round(sum(humids) / len(humids), 1) if humids else None
        
        conn = get_db()
        cur = conn.execute(
            """INSERT INTO weather_queries (location, lat, lon, date_from, date_to,
               avg_temp_c, min_temp_c, max_temp_c, avg_humidity, summary)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (geo["display_name"], geo["lat"], geo["lon"],
             body.date_from, body.date_to,
             avg_temp, min_temp, max_temp, avg_hum,
             f"Weather data for {geo['display_name']} from {body.date_from} to {body.date_to}"),
        )
        row_id = cur.lastrowid
        conn.commit()
        conn.close()
        
        return {
            "id": row_id,
            "location": geo["display_name"],
            "avg_temp_c": avg_temp,
            "min_temp_c": min_temp,
            "max_temp_c": max_temp,
            "avg_humidity": avg_hum
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/queries")
def read_queries(skip: int = 0, limit: int = 50):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM weather_queries ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, skip)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/queries/{query_id}")
def read_query(query_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM weather_queries WHERE id=?", (query_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Query not found")
    return dict(row)

@app.put("/api/queries/{query_id}")
async def update_query(query_id: int, body: QueryUpdate):
    conn = get_db()
    row = conn.execute("SELECT * FROM weather_queries WHERE id=?", (query_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Query not found")

    fields, vals = [], []
    if body.location:
        geo = await geocode(body.location)
        fields += ["location=?", "lat=?", "lon=?"]
        vals += [geo["display_name"], geo["lat"], geo["lon"]]
    if body.date_from:
        fields.append("date_from=?")
        vals.append(body.date_from)
    if body.date_to:
        fields.append("date_to=?")
        vals.append(body.date_to)
    if body.summary is not None:
        fields.append("summary=?")
        vals.append(body.summary)

    if fields:
        fields.append("updated_at=datetime('now')")
        conn.execute(f"UPDATE weather_queries SET {','.join(fields)} WHERE id=?", vals + [query_id])
        conn.commit()

    updated = conn.execute("SELECT * FROM weather_queries WHERE id=?", (query_id,)).fetchone()
    conn.close()
    return dict(updated)

@app.delete("/api/queries/{query_id}", status_code=204)
def delete_query(query_id: int):
    conn = get_db()
    result = conn.execute("DELETE FROM weather_queries WHERE id=?", (query_id,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Query not found")

@app.get("/api/export")
def export_queries(format: str = Query("json", pattern="^(json|csv|markdown)$")):
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM weather_queries ORDER BY created_at DESC").fetchall()]
    conn.close()

    if format == "json":
        content = json.dumps(rows, indent=2)
        return StreamingResponse(io.StringIO(content), media_type="application/json",
                                 headers={"Content-Disposition": "attachment; filename=weather_queries.json"})
    elif format == "csv":
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        buf.seek(0)
        return StreamingResponse(buf, media_type="text/csv",
                                 headers={"Content-Disposition": "attachment; filename=weather_queries.csv"})
    elif format == "markdown":
        if not rows:
            md = "# Weather Queries\n\nNo data yet.\n"
        else:
            keys = list(rows[0].keys())
            header = "| " + " | ".join(keys) + " |"
            sep = "| " + " | ".join(["---"] * len(keys)) + " |"
            body = "\n".join("| " + " | ".join(str(r.get(k, "")) for k in keys) + " |" for r in rows)
            md = f"# Weather Queries\n\n{header}\n{sep}\n{body}\n"
        return StreamingResponse(io.StringIO(md), media_type="text/markdown",
                                 headers={"Content-Disposition": "attachment; filename=weather_queries.md"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
