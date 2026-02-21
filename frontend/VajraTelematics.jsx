import { useState, useEffect, useCallback, useRef } from "react";

// ─── Simulated Data Layer ──────────────────────────────────────────────────────
const BASE = { lat: 12.9716, lng: 77.5946 };
const simulateLocation = () => ({
  latitude: BASE.lat + (Math.random() * 0.004 - 0.002),
  longitude: BASE.lng + (Math.random() * 0.004 - 0.002),
});

const PLACES = [
  "Indiranagar, Bengaluru",
  "Koramangala 5th Block",
  "HSR Layout Sector 2",
  "Bellandur, Bengaluru",
  "Whitefield Main Road",
];

const EV_STATIONS = [
  { name: "TATA Power EV Hub", dist: "1.2 km", slots: 4, lat: 12.973, lng: 77.596 },
  { name: "Ather Grid Point", dist: "2.8 km", slots: 2, lat: 12.970, lng: 77.591 },
  { name: "BESCOM EV Station", dist: "3.5 km", slots: 6, lat: 12.968, lng: 77.599 },
];

const PARKING = [
  { name: "Forum Mall Parking", dist: "0.8 km", slots: 12 },
  { name: "Phoenix MarketCity P3", dist: "1.4 km", slots: 28 },
  { name: "Smart City Lot 7", dist: "2.1 km", slots: 5 },
];

// ─── Tiny SVG Icons ────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, color = "currentColor", viewBox = "0 0 24 24", fill = "none" }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

// ─── Sparkline Component ───────────────────────────────────────────────────────
function Sparkline({ data, color = "#00e5ff", height = 40, width = 120 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

// ─── Animated Ring ─────────────────────────────────────────────────────────────
function Ring({ value, max, color, label, size = 80 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: 14, fontWeight: 700, fill: "#fff", fontFamily: "inherit" }}>{value}</text>
      </svg>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function Badge({ label, active, color }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      letterSpacing: 0.5, border: `1px solid ${active ? color : "rgba(255,255,255,0.15)"}`,
      color: active ? color : "rgba(255,255,255,0.4)",
      background: active ? `${color}18` : "transparent",
      transition: "all 0.3s"
    }}>{label}</span>
  );
}

// ─── Map Placeholder (Leaflet would be external) ──────────────────────────────
function MapView({ lat, lng, route, evSpots, parking }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;

    // Dark map background
    ctx.fillStyle = "#0f1923";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
    for (let i = 0; i < H; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

    // Simulated road lines
    const roads = [
      [[0.1, 0.5], [0.9, 0.5]], [[0.5, 0.1], [0.5, 0.9]],
      [[0.1, 0.3], [0.9, 0.7]], [[0.2, 0.1], [0.7, 0.9]],
      [[0.3, 0.2], [0.8, 0.6]],
    ];
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 8;
    roads.forEach(([[x1, y1], [x2, y2]]) => {
      ctx.beginPath(); ctx.moveTo(x1 * W, y1 * H); ctx.lineTo(x2 * W, y2 * H); ctx.stroke();
    });

    const toXY = (la, lo) => {
      const x = ((lo - (lng - 0.01)) / 0.02) * W;
      const y = ((lat + 0.01 - la) / 0.02) * H;
      return [x, y];
    };

    // Route trail
    if (route.length > 1) {
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "rgba(0,229,255,0)");
      grad.addColorStop(1, "rgba(0,229,255,0.8)");
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      route.forEach(([la, lo], i) => {
        const [x, y] = toXY(la, lo);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // EV Spots
    evSpots.forEach(ev => {
      const [x, y] = toXY(ev.lat, ev.lng);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,230,118,0.2)";
      ctx.fill();
      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚡", x, y + 3);
    });

    // Vehicle marker
    const [vx, vy] = toXY(lat, lng);
    // Pulse ring
    ctx.beginPath();
    ctx.arc(vx, vy, 20, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,229,255,0.08)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(vx, vy, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,229,255,0.15)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(vx, vy, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#00e5ff";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Coordinates
    ctx.fillStyle = "rgba(0,229,255,0.7)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${lat.toFixed(5)}°N  ${lng.toFixed(5)}°E`, 8, H - 10);

  }, [lat, lng, route, evSpots]);

  return (
    <canvas ref={canvasRef} width={800} height={380}
      style={{ width: "100%", height: "100%", borderRadius: 4, display: "block" }} />
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [route, setRoute] = useState([]);
  const [place, setPlace] = useState("Fetching location...");
  const [immobilized, setImmobilized] = useState(false);
  const [speedHistory, setSpeedHistory] = useState([]);
  const [voltHistory, setVoltHistory] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const [tab, setTab] = useState("overview");

  const tick = useCallback(() => {
    const loc = simulateLocation();
    const speed = Math.floor(Math.random() * 80 + 10);
    const voltage = +(12.1 + Math.random() * 0.8).toFixed(2);
    const signal = Math.floor(Math.random() * 2) + 3;

    const vehicle = {
      ...loc,
      ignition: true,
      speed,
      voltage,
      signal,
      operator: "Airtel 4G",
      odometer: 28471 + Math.floor(Math.random() * 3),
      fuel: Math.floor(Math.random() * 20 + 60),
      engine_temp: Math.floor(Math.random() * 10 + 85),
    };

    setData(vehicle);
    setRoute(prev => {
      const next = [...prev, [loc.latitude, loc.longitude]];
      return next.slice(-40);
    });
    setSpeedHistory(h => [...h.slice(-30), speed]);
    setVoltHistory(h => [...h.slice(-30), voltage]);
    setPlace(PLACES[Math.floor(Math.random() * PLACES.length)]);
    setLastUpdate(new Date());

    if (speed > 75) setAlertMsg("⚠ Speed limit exceeded — 80 km/h zone");
    else if (voltage < 12.2) setAlertMsg("⚠ Low battery voltage detected");
    else setAlertMsg(null);
  }, []);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, [tick]);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;900&family=JetBrains+Mono:wght@400;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #080d14;
      --surface: #0d1520;
      --surface2: #111d2e;
      --border: rgba(0,229,255,0.1);
      --accent: #00e5ff;
      --accent2: #7c4dff;
      --green: #00e676;
      --amber: #ffab00;
      --red: #ff1744;
      --text: #e8edf5;
      --muted: rgba(232,237,245,0.45);
      --font: 'Exo 2', sans-serif;
      --mono: 'JetBrains Mono', monospace;
    }

    body { background: var(--bg); color: var(--text); font-family: var(--font); }

    .app {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto auto 1fr;
      background: radial-gradient(ellipse at 20% 0%, #071a2e 0%, transparent 60%),
                  radial-gradient(ellipse at 80% 100%, #0d0d2b 0%, transparent 60%),
                  var(--bg);
    }

    /* ── Header ── */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 28px;
      border-bottom: 1px solid var(--border);
      background: rgba(13,21,32,0.9);
      backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 100;
    }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-mark {
      width: 36px; height: 36px; border-radius: 8px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    .logo-text { font-size: 18px; font-weight: 900; letter-spacing: -0.5px; }
    .logo-sub { font-size: 10px; color: var(--muted); letter-spacing: 3px; text-transform: uppercase; }

    .header-right { display: flex; align-items: center; gap: 16px; }
    .live-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--green);
      box-shadow: 0 0 8px var(--green);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }

    .timestamp { font-size: 11px; font-family: var(--mono); color: var(--muted); }

    /* ── Alert Banner ── */
    .alert {
      padding: 10px 28px;
      background: rgba(255,23,68,0.12);
      border-bottom: 1px solid rgba(255,23,68,0.3);
      font-size: 13px; font-weight: 600; color: #ff6b8a;
      display: flex; align-items: center; gap: 8px;
      animation: slideIn 0.3s ease;
    }
    @keyframes slideIn { from{transform:translateY(-10px);opacity:0} to{transform:none;opacity:1} }

    /* ── Nav Tabs ── */
    .nav { display: flex; gap: 4px; padding: 16px 28px 0; border-bottom: 1px solid var(--border); }
    .nav-btn {
      padding: 8px 18px; border: none; border-radius: 6px 6px 0 0;
      background: transparent; color: var(--muted); cursor: pointer;
      font-family: var(--font); font-size: 13px; font-weight: 600;
      letter-spacing: 0.3px; border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .nav-btn:hover { color: var(--text); background: rgba(255,255,255,0.04); }
    .nav-btn.active {
      color: var(--accent); border-bottom-color: var(--accent);
      background: rgba(0,229,255,0.06);
    }

    /* ── Main Grid ── */
    .main { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }

    /* ── Cards ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      opacity: 0.4;
    }
    .card-title {
      font-size: 10px; font-weight: 700; letter-spacing: 2px;
      text-transform: uppercase; color: var(--muted); margin-bottom: 16px;
      display: flex; align-items: center; gap: 8px;
    }
    .card-title::before {
      content: ''; width: 3px; height: 12px; border-radius: 2px;
      background: var(--accent);
    }

    /* ── Grid Layouts ── */
    .grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media(max-width:900px) {
      .grid-4 { grid-template-columns: repeat(2,1fr); }
      .grid-3 { grid-template-columns: 1fr 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      .header { padding: 12px 16px; }
      .main { padding: 16px; }
      .nav { padding: 12px 16px 0; }
    }
    @media(max-width:500px) {
      .grid-4 { grid-template-columns: 1fr 1fr; }
      .grid-3 { grid-template-columns: 1fr; }
    }

    /* ── Stat Tiles ── */
    .stat-tile {
      background: var(--surface2);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 16px;
      display: flex; flex-direction: column; gap: 6px;
      transition: border-color 0.3s;
    }
    .stat-tile:hover { border-color: rgba(0,229,255,0.2); }
    .stat-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1.5px; }
    .stat-value { font-size: 26px; font-weight: 700; line-height: 1; font-family: var(--mono); }
    .stat-unit { font-size: 12px; color: var(--muted); margin-left: 2px; }
    .stat-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

    /* ── Map Card ── */
    .map-card { padding: 0; overflow: hidden; }
    .map-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
    }
    .map-body { height: 380px; }
    .location-pill {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-family: var(--mono);
      color: var(--accent); background: rgba(0,229,255,0.08);
      border: 1px solid rgba(0,229,255,0.2);
      border-radius: 20px; padding: 4px 12px;
    }

    /* ── Immobilizer ── */
    .immo-btn {
      width: 100%; padding: 14px;
      border: 1px solid; border-radius: 8px;
      cursor: pointer; font-family: var(--font);
      font-size: 14px; font-weight: 700; letter-spacing: 0.5px;
      transition: all 0.25s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .immo-btn.active {
      background: rgba(255,23,68,0.12); border-color: var(--red); color: var(--red);
    }
    .immo-btn.active:hover { background: rgba(255,23,68,0.22); }
    .immo-btn.inactive {
      background: rgba(0,230,118,0.1); border-color: var(--green); color: var(--green);
    }
    .immo-btn.inactive:hover { background: rgba(0,230,118,0.2); }

    /* ── EV / Parking List ── */
    .list-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .list-item:last-child { border-bottom: none; }
    .list-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }
    .list-name { font-size: 13px; font-weight: 600; }
    .list-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .list-badge {
      font-size: 11px; font-family: var(--mono);
      padding: 2px 8px; border-radius: 10px;
      border: 1px solid; font-weight: 600;
    }

    /* ── Insurance Card ── */
    .ins-card {
      background: linear-gradient(135deg, rgba(124,77,255,0.15), rgba(0,229,255,0.08));
      border: 1px solid rgba(124,77,255,0.25);
    }
    .ins-card::before { background: linear-gradient(90deg, transparent, var(--accent2), transparent); }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
  `;

  const fmtTime = d => d ? d.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--";

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-mark">⚡</div>
            <div>
              <div className="logo-text">VAJRA</div>
              <div className="logo-sub">Telematics Platform</div>
            </div>
          </div>
          <div className="header-right">
            <div className="live-dot" />
            <span className="timestamp">LIVE · {fmtTime(lastUpdate)}</span>
            <Badge label="VH-2847-KA" active={true} color="var(--accent)" />
            <Badge label="INSURANCE ACTIVE" active={true} color="var(--green)" />
          </div>
        </header>

        {/* Alert */}
        {alertMsg && <div className="alert">⚠ {alertMsg}</div>}

        {/* Nav */}
        <div className="nav">
          {["overview","map","diagnostics","services"].map(t => (
            <button key={t} className={`nav-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="main">

          {/* ── OVERVIEW TAB ── */}
          {tab === "overview" && (
            <>
              {/* KPI Row */}
              <div className="grid-4">
                {[
                  { label: "Speed", value: data?.speed ?? "--", unit: "km/h", color: data?.speed > 70 ? "var(--red)" : "var(--accent)", sub: "Current" },
                  { label: "Voltage", value: data?.voltage ?? "--", unit: "V", color: "var(--green)", sub: "Battery" },
                  { label: "Engine Temp", value: data?.engine_temp ?? "--", unit: "°C", color: data?.engine_temp > 90 ? "var(--amber)" : "var(--text)", sub: "Normal range" },
                  { label: "Odometer", value: data?.odometer?.toLocaleString("en-IN") ?? "--", unit: "km", color: "var(--text)", sub: "Total driven" },
                ].map(s => (
                  <div className="stat-tile" key={s.label}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-value" style={{ color: s.color }}>
                      {s.value}<span className="stat-unit">{s.unit}</span>
                    </div>
                    <div className="stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid-2">
                <div className="card">
                  <div className="card-title">Speed History</div>
                  <Sparkline data={speedHistory} color="#00e5ff" width={320} height={50} />
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                    Last {speedHistory.length} readings · Avg {speedHistory.length ? Math.round(speedHistory.reduce((a,b)=>a+b,0)/speedHistory.length) : 0} km/h
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Voltage Trend</div>
                  <Sparkline data={voltHistory} color="#00e676" width={320} height={50} />
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                    Last {voltHistory.length} readings · Min {voltHistory.length ? Math.min(...voltHistory).toFixed(2) : "--"} V
                  </div>
                </div>
              </div>

              {/* Status + Rings */}
              <div className="grid-2">
                <div className="card">
                  <div className="card-title">Vehicle Status</div>
                  <div style={{ display: "flex", justifyContent: "space-around", padding: "12px 0" }}>
                    <Ring value={data?.speed ?? 0} max={120} color="var(--accent)" label="Speed" />
                    <Ring value={data?.fuel ?? 0} max={100} color="var(--green)" label="Fuel %" />
                    <Ring value={data?.signal ?? 0} max={5} color="var(--accent2)" label="Signal" />
                  </div>
                  <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Badge label={`Ignition ${data?.ignition ? "ON" : "OFF"}`} active={data?.ignition} color="var(--green)" />
                    <Badge label={`Immobilizer ${immobilized ? "ACTIVE" : "OFF"}`} active={immobilized} color="var(--red)" />
                    <Badge label={`${data?.operator ?? "—"}`} active={true} color="var(--accent2)" />
                  </div>
                </div>

                <div className="card ins-card">
                  <div className="card-title">Insurance & Compliance</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                    {[
                      { label: "Policy Status", value: "Active", color: "var(--green)" },
                      { label: "Valid Until", value: "Mar 15, 2026", color: "var(--text)" },
                      { label: "Policy No.", value: "INS-KA-8847-24", color: "var(--muted)" },
                      { label: "Vehicle Class", value: "Commercial · Cat B", color: "var(--accent)" },
                      { label: "PUC Status", value: "Valid · Exp Sep 2025", color: "var(--green)" },
                    ].map(r => (
                      <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--muted)" }}>{r.label}</span>
                        <span style={{ color: r.color, fontWeight: 600, fontFamily: "var(--mono)", fontSize: 12 }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Immobilizer */}
              <div className="card">
                <div className="card-title">Remote Vehicle Control</div>
                <div style={{ maxWidth: 360 }}>
                  <button
                    className={`immo-btn ${immobilized ? "active" : "inactive"}`}
                    onClick={() => setImmobilized(v => !v)}
                  >
                    <span>{immobilized ? "🔴" : "🟢"}</span>
                    {immobilized ? "Release Vehicle — Tap to Unlock" : "Immobilize Vehicle — Tap to Lock"}
                  </button>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                    This will send a remote command to the vehicle's ECU. Confirm before activating.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ── MAP TAB ── */}
          {tab === "map" && data && (
            <>
              <div className="card map-card">
                <div className="map-header">
                  <div className="card-title" style={{ margin: 0 }}>Live GPS Tracking</div>
                  <div className="location-pill">
                    📍 {place}
                  </div>
                </div>
                <div className="map-body">
                  <MapView
                    lat={data.latitude} lng={data.longitude}
                    route={route} evSpots={EV_STATIONS} parking={PARKING}
                  />
                </div>
              </div>

              <div className="grid-2">
                {/* EV Stations */}
                <div className="card">
                  <div className="card-title">⚡ Nearby EV Stations</div>
                  {EV_STATIONS.map((ev, i) => (
                    <div className="list-item" key={i}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="list-icon" style={{ background: "rgba(0,230,118,0.12)", color: "var(--green)" }}>⚡</div>
                        <div>
                          <div className="list-name">{ev.name}</div>
                          <div className="list-sub">{ev.dist} away</div>
                        </div>
                      </div>
                      <span className="list-badge" style={{ color: "var(--green)", borderColor: "rgba(0,230,118,0.3)" }}>
                        {ev.slots} slots
                      </span>
                    </div>
                  ))}
                </div>

                {/* Parking */}
                <div className="card">
                  <div className="card-title">🅿 Nearby Parking</div>
                  {PARKING.map((p, i) => (
                    <div className="list-item" key={i}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div className="list-icon" style={{ background: "rgba(0,229,255,0.1)", color: "var(--accent)" }}>🅿</div>
                        <div>
                          <div className="list-name">{p.name}</div>
                          <div className="list-sub">{p.dist} away</div>
                        </div>
                      </div>
                      <span className="list-badge" style={{ color: "var(--accent)", borderColor: "rgba(0,229,255,0.25)" }}>
                        {p.slots} open
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── DIAGNOSTICS TAB ── */}
          {tab === "diagnostics" && data && (
            <>
              <div className="grid-3">
                {[
                  { label: "Battery Voltage", value: `${data.voltage} V`, status: data.voltage > 12.3 ? "Optimal" : "Low", ok: data.voltage > 12.3 },
                  { label: "Engine Temp", value: `${data.engine_temp} °C`, status: data.engine_temp < 95 ? "Normal" : "High", ok: data.engine_temp < 95 },
                  { label: "GPS Signal", value: `${data.signal}/5`, status: data.signal >= 3 ? "Strong" : "Weak", ok: data.signal >= 3 },
                  { label: "Network", value: data.operator, status: "Connected", ok: true },
                  { label: "Ignition", value: data.ignition ? "ON" : "OFF", status: data.ignition ? "Running" : "Off", ok: data.ignition },
                  { label: "Immobilizer", value: immobilized ? "Armed" : "Disarmed", status: immobilized ? "Vehicle locked" : "Vehicle free", ok: !immobilized },
                ].map(d => (
                  <div className="stat-tile" key={d.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div className="stat-label">{d.label}</div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "2px 6px",
                        borderRadius: 4, background: d.ok ? "rgba(0,230,118,0.12)" : "rgba(255,23,68,0.12)",
                        color: d.ok ? "var(--green)" : "var(--red)", border: `1px solid ${d.ok ? "rgba(0,230,118,0.2)" : "rgba(255,23,68,0.2)"}`,
                        textTransform: "uppercase"
                      }}>{d.ok ? "OK" : "WARN"}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--mono)", marginTop: 6 }}>{d.value}</div>
                    <div className="stat-sub">{d.status}</div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-title">DTC Event Log</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: "2" }}>
                  {[
                    { time: "09:42:17", code: "P0128", msg: "Coolant below threshold — resolved", ok: true },
                    { time: "08:15:03", code: "B0100", msg: "Airbag system check passed", ok: true },
                    { time: "Yesterday", code: "P0562", msg: "System voltage low — check alternator", ok: false },
                  ].map((e, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 16, padding: "8px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "center"
                    }}>
                      <span style={{ color: "var(--muted)", width: 72, flexShrink: 0 }}>{e.time}</span>
                      <span style={{
                        color: e.ok ? "var(--green)" : "var(--amber)", fontWeight: 600,
                        background: e.ok ? "rgba(0,230,118,0.08)" : "rgba(255,171,0,0.08)",
                        padding: "1px 6px", borderRadius: 4, fontSize: 11,
                        border: `1px solid ${e.ok ? "rgba(0,230,118,0.2)" : "rgba(255,171,0,0.2)"}`,
                        flexShrink: 0
                      }}>{e.code}</span>
                      <span style={{ color: "var(--text)" }}>{e.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── SERVICES TAB ── */}
          {tab === "services" && (
            <div className="grid-2">
              {[
                { icon: "🔧", title: "Service Due", desc: "Next service at 30,000 km", detail: "Oil · Filters · Brake check", color: "var(--amber)" },
                { icon: "📋", title: "Trip Reports", desc: "Generate detailed trip analytics", detail: "Export PDF or CSV", color: "var(--accent)" },
                { icon: "🔔", title: "Alerts & Geofence", desc: "Configure zones and notifications", detail: "3 active zones", color: "var(--accent2)" },
                { icon: "📡", title: "Device Info", desc: "Vajra GT-400 v2.3.1", detail: "IMEI: 35884210XXXXXXX", color: "var(--green)" },
              ].map((s, i) => (
                <div key={i} className="card" style={{ cursor: "pointer", transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,229,255,0.3)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 6 }}>{s.desc}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{s.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", padding: "12px 0 4px", fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: 1 }}>
            VAJRA TELEMATICS · KA-09 FLEET MGMT · v2.3.1
          </div>
        </div>
      </div>
    </>
  );
}
