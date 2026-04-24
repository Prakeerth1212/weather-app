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
from pydantic import BaseModel, validator
import math

# Create FastAPI app
app = FastAPI(title="Weather App API", version="1.0.0")

# Configure CORS for Render deployment
ALLOWED_ORIGINS = [
    "https://weather-frontend.onrender.com",
    "https://weather-frontend.onrender.com/",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database configuration for Render (ephemeral storage)
# For production, consider using PostgreSQL via Render
DB_PATH = os.environ.get("DATABASE_PATH", "/tmp/weather.db")

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables"""
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS weather_queries (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            location    TEXT NOT NULL,
            lat         REAL NOT NULL,
            lon         REAL NOT NULL,
            date_from   TEXT NOT NULL,
            date_to     TEXT NOT NULL,
            avg_temp_c  REAL,
            min_temp_c  REAL,
            max_temp_c  REAL,
            avg_humidity REAL,
            summary     TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")

# Initialize database on startup
init_db()

# Pydantic Models
class QueryCreate(BaseModel):
    location: str
    date_from: str
    date_to: str

    @validator("date_from", "date_to")
    def validate_date(cls, v):
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be YYYY-MM-DD format")
        return v

    @validator("date_to")
    def validate_range(cls, v, values):
        if "date_from" in values:
            if v < values["date_from"]:
                raise ValueError("date_to must be after date_from")
            d_from = datetime.strptime(values["date_from"], "%Y-%m-%d").date()
            d_to = datetime.strptime(v, "%Y-%m-%d").date()
            if (d_to - d_from).days > 365:
                raise ValueError("Date range cannot exceed 1 year")
        return v

class QueryUpdate(BaseModel):
    location: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    summary: Optional[str] = None

# Helper Functions
async def geocode(location: str) -> dict:
    """Resolve any location string to lat/lon via Nominatim."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location, "format": "json", "limit": 1},
            headers={"User-Agent": "WeatherApp/1.0 (your-email@example.com)"},
        )
        data = resp.json()
        if not data:
            raise HTTPException(status_code=404, detail=f"Location '{location}' not found")
        return {
            "display_name": data[0]["display_name"],
            "lat": float(data[0]["lat"]),
            "lon": float(data[0]["lon"]),
        }

async def fetch_current_weather(lat: float, lon: float) -> dict:
    """Fetch current weather from Open-Meteo API"""
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
    """Fetch historical weather from Open-Meteo Archive API"""
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
    """Convert WMO weather code to description"""
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
    """Root endpoint"""
    return {
        "message": "Weather App API",
        "version": "1.0.0",
        "status": "running",
        "database": DB_PATH
    }

@app.get("/api/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "database": DB_PATH
    }

@app.get("/api/weather/current")
async def get_current_weather(location: str = Query(..., min_length=1)):
    """Get current weather for a location"""
    try:
        # Geocode location
        geo = await geocode(location)
        
        # Fetch weather data
        raw = await fetch_current_weather(geo["lat"], geo["lon"])
        cur = raw["current"]
        daily = raw["daily"]

        # Build forecast
        forecast = []
        for i in range(1, min(6, len(daily["time"]))):
            forecast.append({
                "date": daily["time"][i],
                "temp_max": daily["temperature_2m_max"][i],
                "temp_min": daily["temperature_2m_min"][i],
                "weather_code": daily["weather_code"][i],
                "description": wmo_description(daily["weather_code"][i]),
                "precipitation": daily["precipitation_sum"][i],
                "uv_index": daily["uv_index_max"][i] if "uv_index_max" in daily else 0,
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/queries", status_code=201)
async def create_query(body: QueryCreate):
    """Save a historical weather query"""
    try:
        # Geocode location
        geo = await geocode(body.location)
        
        # Validate dates
        today = date.today().isoformat()
        d_to = min(body.date_to, today)
        d_from = min(body.date_from, today)
        
        # Fetch historical weather
        hist = await fetch_historical_weather(geo["lat"], geo["lon"], d_from, d_to)
        daily = hist["daily"]
        
        # Calculate statistics
        temps_mean = [t for t in daily.get("temperature_2m_mean", []) if t is not None]
        temps_max = [t for t in daily.get("temperature_2m_max", []) if t is not None]
        temps_min = [t for t in daily.get("temperature_2m_min", []) if t is not None]
        humids = [h for h in daily.get("relative_humidity_2m_mean", []) if h is not None]
        
        avg_temp = round(sum(temps_mean) / len(temps_mean), 1) if temps_mean else None
        max_temp = round(max(temps_max), 1) if temps_max else None
        min_temp = round(min(temps_min), 1) if temps_min else None
        avg_hum = round(sum(humids) / len(humids), 1) if humids else None
        
        # Save to database
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/queries")
def read_queries(skip: int = 0, limit: int = 100):
    """Get all saved queries"""
    try:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM weather_queries ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, skip)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/queries/{query_id}")
def read_query(query_id: int):
    """Get a specific query by ID"""
    try:
        conn = get_db()
        row = conn.execute("SELECT * FROM weather_queries WHERE id=?", (query_id,)).fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Query not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/queries/{query_id}")
async def update_query(query_id: int, body: QueryUpdate):
    """Update a query"""
    try:
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
            datetime.strptime(body.date_from, "%Y-%m-%d")
            fields.append("date_from=?")
            vals.append(body.date_from)
        if body.date_to:
            datetime.strptime(body.date_to, "%Y-%m-%d")
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/queries/{query_id}", status_code=204)
def delete_query(query_id: int):
    """Delete a query"""
    try:
        conn = get_db()
        result = conn.execute("DELETE FROM weather_queries WHERE id=?", (query_id,))
        conn.commit()
        conn.close()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Query not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export")
def export_queries(format: str = Query("json", regex="^(json|csv|markdown)$")):
    """Export queries in various formats"""
    try:
        conn = get_db()
        rows = [dict(r) for r in conn.execute("SELECT * FROM weather_queries ORDER BY created_at DESC").fetchall()]
        conn.close()

        if format == "json":
            content = json.dumps(rows, indent=2)
            return StreamingResponse(
                io.StringIO(content),
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=weather_queries.json"}
            )
        
        elif format == "csv":
            buf = io.StringIO()
            if rows:
                writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            buf.seek(0)
            return StreamingResponse(
                buf,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=weather_queries.csv"}
            )
        
        elif format == "markdown":
            if not rows:
                md = "# Weather Queries\n\nNo data yet.\n"
            else:
                keys = list(rows[0].keys())
                header = "| " + " | ".join(keys) + " |"
                sep = "| " + " | ".join(["---"] * len(keys)) + " |"
                body = "\n".join("| " + " | ".join(str(r.get(k, "")) for k in keys) + " |" for r in rows)
                md = f"# Weather Queries\n\n{header}\n{sep}\n{body}\n"
            return StreamingResponse(
                io.StringIO(md),
                media_type="text/markdown",
                headers={"Content-Disposition": "attachment; filename=weather_queries.md"}
            )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# For local development
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)