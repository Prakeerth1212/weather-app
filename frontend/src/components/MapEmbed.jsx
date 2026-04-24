export default function MapEmbed({ lat, lon, name }) {
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.3}%2C${lat - 0.2}%2C${lon + 0.3}%2C${lat + 0.2}&layer=mapnik&marker=${lat}%2C${lon}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Map</div>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none" }}
        >
          Open in OpenStreetMap ↗
        </a>
      </div>
      <div className="map-container">
        <iframe
          title={`Map of ${name}`}
          src={url}
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}
