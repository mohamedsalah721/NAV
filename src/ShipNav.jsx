import { useState, useMemo, useRef } from "react";
import {
  Compass, Anchor, Ship, Waves, MapPin, Navigation, Radio, Satellite,
  Ruler, Save, Settings, Info, Menu, X, Search, Clock, TrendingUp,
  AlertTriangle, CheckCircle2, RotateCw, Copy, Trash2, ChevronDown,
  ChevronRight, ArrowRight, Gauge, LocateFixed, CornerDownRight,
  Lightbulb, Users, Crosshair
} from "lucide-react";

/* ============================================================
   CALCULATION UTILITIES  (pure functions, no UI concerns)
   ============================================================ */
const R_EARTH_NM = 3440.065; // nautical miles
const NM_TO_KM = 1.852;
const NM_TO_M = 1852;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const norm360 = (d) => ((d % 360) + 360) % 360;

function greatCircle(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distNM = R_EARTH_NM * c;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const initBrg = norm360(toDeg(Math.atan2(y, x)));
  const y2 = Math.sin(-Δλ) * Math.cos(φ1);
  const x2 = Math.cos(φ2) * Math.sin(φ1) - Math.sin(φ2) * Math.cos(φ1) * Math.cos(-Δλ);
  const finalBrg = norm360(toDeg(Math.atan2(y2, x2)) + 180);
  return { distNM, initBrg, finalBrg };
}

function destPointGC(lat1, lon1, brg, distNM) {
  const δ = distNM / R_EARTH_NM;
  const θ = toRad(brg);
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

function destPointRhumb(lat1, lon1, brg, distNM) {
  const δ = distNM / R_EARTH_NM;
  const θ = toRad(brg);
  const φ1 = toRad(lat1);
  let φ2 = φ1 + δ * Math.cos(θ);
  const Δφ = φ2 - φ1;
  const Δψ = Math.log(Math.tan(Math.PI / 4 + φ2 / 2) / Math.tan(Math.PI / 4 + φ1 / 2));
  const q = Math.abs(Δψ) > 1e-12 ? Δφ / Δψ : Math.cos(φ1);
  const Δλ = (δ * Math.sin(θ)) / q;
  const λ2 = toRad(lon1) + Δλ;
  return { lat: toDeg(φ2), lon: ((toDeg(λ2) + 540) % 360) - 180 };
}

function ddToDMS(dd, isLat) {
  const dir = isLat ? (dd >= 0 ? "N" : "S") : (dd >= 0 ? "E" : "W");
  const abs = Math.abs(dd);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(2);
  return { deg, min, sec, dir, ddm: `${deg}° ${minFull.toFixed(3)}' ${dir}`, dms: `${deg}° ${min}' ${sec}" ${dir}` };
}

function ddmToDecimal(deg, min, hemi) {
  const d = parseFloat(deg), m = parseFloat(min);
  if (Number.isNaN(d) || Number.isNaN(m)) return NaN;
  const sign = hemi === "S" || hemi === "W" ? -1 : 1;
  return sign * (Math.abs(d) + Math.abs(m) / 60);
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

/* ============================================================
   SHARED UI PRIMITIVES
   ============================================================ */
function Field({ label, unit, children }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
        <span>{label}</span>
        {unit && <span className="text-slate-600">{unit}</span>}
      </span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange, placeholder, step = "any" }) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 outline-none rounded-md px-3 py-2 text-slate-100 font-mono text-sm transition-colors"
    />
  );
}

function LatLonDDM({ label, isLat, value, onChange }) {
  const hemiOptions = isLat ? ["N", "S"] : ["E", "W"];
  const maxDeg = isLat ? 90 : 180;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
        <span>{label}</span>
        <span className="text-slate-600">DDM</span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="number" min="0" max={maxDeg} step="1" value={value.deg} placeholder="deg"
          onChange={(e) => onChange({ ...value, deg: e.target.value })}
          className="w-16 bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none rounded-md px-2 py-2 text-slate-100 font-mono text-sm text-center"
        />
        <span className="self-center text-slate-600 text-xs">°</span>
        <input
          type="number" min="0" max="59.999" step="0.001" value={value.min} placeholder="min"
          onChange={(e) => onChange({ ...value, min: e.target.value })}
          className="flex-1 min-w-0 bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none rounded-md px-2 py-2 text-slate-100 font-mono text-sm text-center"
        />
        <span className="self-center text-slate-600 text-xs">'</span>
        <select
          value={value.hemi} onChange={(e) => onChange({ ...value, hemi: e.target.value })}
          className="bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none rounded-md px-2 text-slate-100 text-sm"
        >
          {hemiOptions.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none rounded-md px-3 py-2 text-slate-100 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SegButton({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-slate-700 overflow-hidden bg-slate-900">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
            value === o.value ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ReadOut({ label, value, unit, big, accent = "cyan" }) {
  const colors = { cyan: "text-cyan-400", amber: "text-amber-400", emerald: "text-emerald-400", red: "text-red-400" };
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</div>
      <div className={`font-mono ${big ? "text-3xl" : "text-xl"} font-semibold ${colors[accent]}`}>
        {value} <span className="text-sm text-slate-500 font-normal">{unit}</span>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-slate-900/60 backdrop-blur border border-slate-800 rounded-xl p-5 ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon size={16} className="text-cyan-500" />}
          <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function Formula({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900/50 hover:bg-slate-900 text-xs font-medium tracking-wide uppercase text-slate-300"
      >
        <span className="flex items-center gap-2"><Info size={13} className="text-cyan-500" /> Formula &amp; Method</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-4 py-3 text-xs text-slate-400 leading-relaxed space-y-2 border-t border-slate-800">{children}</div>}
    </div>
  );
}

function Warning({ level = "info", children }) {
  const styles = {
    info: "border-slate-700 bg-slate-900/50 text-slate-400",
    caution: "border-amber-700/50 bg-amber-950/30 text-amber-300",
    danger: "border-red-700/50 bg-red-950/30 text-red-300",
    safe: "border-emerald-700/50 bg-emerald-950/30 text-emerald-300",
  };
  const Icon = level === "danger" ? AlertTriangle : level === "safe" ? CheckCircle2 : level === "caution" ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 text-xs leading-relaxed ${styles[level]}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function ActionBar({ onReset, onCopy, onSave }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">
        <RotateCw size={12} /> Reset
      </button>
      <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">
        <Copy size={12} /> Copy Results
      </button>
      <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-cyan-700 text-cyan-300 hover:bg-cyan-900/30 transition-colors">
        <Save size={12} /> Save
      </button>
    </div>
  );
}

function CalcHeader({ title, desc }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold text-slate-100 tracking-tight">{title}</h2>
      <p className="text-sm text-slate-500 mt-1 max-w-2xl">{desc}</p>
    </div>
  );
}

/* Compass rose SVG used across visualizations */
function CompassRose({ size = 220, vectors = [], center }) {
  const c = size / 2;
  const r = c - 24;
  const ticks = [];
  for (let i = 0; i < 360; i += 10) {
    const big = i % 30 === 0;
    const a = toRad(i - 90);
    const r1 = r, r2 = big ? r - 10 : r - 5;
    ticks.push(
      <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)}
        stroke="#334155" strokeWidth={big ? 1.5 : 1} />
    );
  }
  const labels = [{ t: "N", d: 0 }, { t: "E", d: 90 }, { t: "S", d: 180 }, { t: "W", d: 270 }];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-[280px] mx-auto">
      <circle cx={c} cy={c} r={r} fill="#0b1622" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx={c} cy={c} r={r - 40} fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 3" />
      {ticks}
      {labels.map((l) => {
        const a = toRad(l.d - 90);
        return (
          <text key={l.t} x={c + (r - 20) * Math.cos(a)} y={c + (r - 20) * Math.sin(a) + 4} textAnchor="middle"
            fill={l.t === "N" ? "#22d3ee" : "#64748b"} fontSize="12" fontWeight="700" fontFamily="monospace">{l.t}</text>
        );
      })}
      {vectors.map((v, i) => {
        const a = toRad(v.deg - 90);
        const len = (v.len ?? 0.8) * r;
        return (
          <g key={i}>
            <line x1={c} y1={c} x2={c + len * Math.cos(a)} y2={c + len * Math.sin(a)} stroke={v.color} strokeWidth={v.width ?? 2.5}
              markerEnd={`url(#arrow-${v.color?.replace("#", "")})`} />
            <defs>
              <marker id={`arrow-${v.color?.replace("#", "")}`} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill={v.color} />
              </marker>
            </defs>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={4} fill="#e2e8f0" />
    </svg>
  );
}

/* ============================================================
   CALCULATORS
   ============================================================ */

function DistanceBearingCalc({ onSave }) {
  const [a, setA] = useState({ lat: { deg: "51", min: "30.444", hemi: "N" }, lon: { deg: "0", min: "7.668", hemi: "W" } });
  const [b, setB] = useState({ lat: { deg: "40", min: "42.768", hemi: "N" }, lon: { deg: "74", min: "0.360", hemi: "W" } });
  const result = useMemo(() => {
    const lat1 = ddmToDecimal(a.lat.deg, a.lat.min, a.lat.hemi), lon1 = ddmToDecimal(a.lon.deg, a.lon.min, a.lon.hemi);
    const lat2 = ddmToDecimal(b.lat.deg, b.lat.min, b.lat.hemi), lon2 = ddmToDecimal(b.lon.deg, b.lon.min, b.lon.hemi);
    if ([lat1, lon1, lat2, lon2].some(Number.isNaN)) return null;
    if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) return "invalid";
    return greatCircle(lat1, lon1, lat2, lon2);
  }, [a, b]);

  const reset = () => {
    setA({ lat: { deg: "", min: "", hemi: "N" }, lon: { deg: "", min: "", hemi: "E" } });
    setB({ lat: { deg: "", min: "", hemi: "N" }, lon: { deg: "", min: "", hemi: "E" } });
  };

  return (
    <div className="space-y-5">
      <CalcHeader title="Distance & Bearing" desc="Great-circle distance and initial/final bearing between two geographic positions. Enter positions in Degrees Decimal Minutes (DDM)." />
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Position A">
          <div className="grid grid-cols-1 gap-3">
            <LatLonDDM label="Latitude" isLat value={a.lat} onChange={(v) => setA({ ...a, lat: v })} />
            <LatLonDDM label="Longitude" value={a.lon} onChange={(v) => setA({ ...a, lon: v })} />
          </div>
        </Panel>
        <Panel title="Position B">
          <div className="grid grid-cols-1 gap-3">
            <LatLonDDM label="Latitude" isLat value={b.lat} onChange={(v) => setB({ ...b, lat: v })} />
            <LatLonDDM label="Longitude" value={b.lon} onChange={(v) => setB({ ...b, lon: v })} />
          </div>
        </Panel>
      </div>

      {result === "invalid" && <Warning level="danger">Latitude must be within ±90°, longitude within ±180°.</Warning>}

      {result && result !== "invalid" && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ReadOut label="Distance" value={fmt(result.distNM)} unit="NM" big accent="cyan" />
            <ReadOut label="Distance" value={fmt(result.distNM * NM_TO_KM)} unit="km" />
            <ReadOut label="Distance" value={fmt(result.distNM * NM_TO_M, 0)} unit="m" />
            <ReadOut label="Initial Bearing" value={fmt(result.initBrg, 1)} unit="°T" accent="amber" />
          </div>
          <Panel>
            <CompassRose vectors={[{ deg: result.initBrg, color: "#22d3ee", len: 0.85 }]} />
            <div className="text-center text-xs text-slate-500 mt-1">A → B initial bearing {fmt(result.initBrg, 1)}° · final bearing {fmt(result.finalBrg, 1)}°</div>
          </Panel>
        </>
      )}

      <Formula>
        <p><b>Haversine (great-circle) formula.</b> a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2); c = 2·atan2(√a, √(1−a)); d = R·c, R = 3440.065 NM.</p>
        <p>Initial bearing θ = atan2( sin Δλ·cos φ2 , cos φ1·sin φ2 − sin φ1·cos φ2·cos Δλ ).</p>
        <p><b>Assumption:</b> spherical Earth model (mean radius). For high-precision work use an ellipsoidal (Vincenty) solution and official charts. Positions are entered as Degrees Decimal Minutes (DDM) and converted to decimal degrees internally.</p>
      </Formula>
      <ActionBar onReset={reset} onCopy={() => {}} onSave={() => onSave("Distance & Bearing", { a, b }, result)} />
    </div>
  );
}

function CourseDistanceCalc({ onSave }) {
  const [lat, setLat] = useState({ deg: "51", min: "30.444", hemi: "N" });
  const [lon, setLon] = useState({ deg: "0", min: "7.668", hemi: "W" });
  const [course, setCourse] = useState("270");
  const [dist, setDist] = useState("120");
  const [method, setMethod] = useState("gc");

  const result = useMemo(() => {
    const la = ddmToDecimal(lat.deg, lat.min, lat.hemi), lo = ddmToDecimal(lon.deg, lon.min, lon.hemi);
    const c = parseFloat(course), d = parseFloat(dist);
    if ([la, lo, c, d].some(Number.isNaN)) return null;
    return method === "gc" ? destPointGC(la, lo, c, d) : destPointRhumb(la, lo, c, d);
  }, [lat, lon, course, dist, method]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Course & Distance" desc="Compute a destination position from a starting point, course, and distance run. Starting position entered in Degrees Decimal Minutes (DDM)." />
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-slate-400">Method</span>
          <SegButton value={method} onChange={setMethod} options={[{ value: "gc", label: "Great Circle" }, { value: "rl", label: "Rhumb Line" }]} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <LatLonDDM label="Start Latitude" isLat value={lat} onChange={setLat} />
          <LatLonDDM label="Start Longitude" value={lon} onChange={setLon} />
          <Field label="Course" unit="°T"><NumInput value={course} onChange={setCourse} /></Field>
          <Field label="Distance" unit="NM"><NumInput value={dist} onChange={setDist} /></Field>
        </div>
      </Panel>

      {result && (
        <div className="grid sm:grid-cols-2 gap-3">
          <ReadOut label="Destination Latitude" value={ddToDMS(result.lat, true).ddm} unit="" big />
          <ReadOut label="Destination Longitude" value={ddToDMS(result.lon, false).ddm} unit="" big />
        </div>
      )}

      <Formula>
        <p><b>Great circle:</b> φ2 = asin( sin φ1·cos δ + cos φ1·sin δ·cos θ ); λ2 = λ1 + atan2( sin θ·sin δ·cos φ1 , cos δ − sin φ1·sin φ2 ), δ = distance/R.</p>
        <p><b>Rhumb line (Mercator sailing):</b> holds a constant true course by crossing all meridians at the same angle; produces a longer track than the great circle on long east-west passages.</p>
        <p>Selected method: <b>{method === "gc" ? "Great Circle" : "Rhumb Line"}</b>.</p>
      </Formula>
      <ActionBar onReset={() => { setLat({ deg: "", min: "", hemi: "N" }); setLon({ deg: "", min: "", hemi: "E" }); setCourse(""); setDist(""); }} onCopy={() => {}} onSave={() => onSave("Course & Distance", { lat, lon, course, dist, method }, result)} />
    </div>
  );
}

function ETACalc({ onSave }) {
  const [dist, setDist] = useState("120");
  const [speed, setSpeed] = useState("12");
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("");

  const hours = useMemo(() => {
    const d = parseFloat(dist), s = parseFloat(speed);
    if (Number.isNaN(d) || Number.isNaN(s) || s <= 0) return null;
    return d / s;
  }, [dist, speed]);

  const eta = useMemo(() => {
    if (hours === null || !depDate || !depTime) return null;
    const start = new Date(`${depDate}T${depTime}`);
    if (Number.isNaN(start.getTime())) return null;
    return new Date(start.getTime() + hours * 3600 * 1000);
  }, [hours, depDate, depTime]);

  const h = hours !== null ? Math.floor(hours) : null;
  const m = hours !== null ? Math.round((hours - h) * 60) : null;

  return (
    <div className="space-y-5">
      <CalcHeader title="ETA Calculator" desc="Estimate time underway and arrival date/time from distance and speed." />
      <Panel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Distance" unit="NM"><NumInput value={dist} onChange={setDist} /></Field>
          <Field label="Speed" unit="kn"><NumInput value={speed} onChange={setSpeed} /></Field>
          <Field label="Departure Date"><input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" /></Field>
          <Field label="Departure Time"><input type="time" value={depTime} onChange={(e) => setDepTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" /></Field>
        </div>
      </Panel>
      {hours !== null && (
        <div className="grid sm:grid-cols-3 gap-3">
          <ReadOut label="Time Underway" value={`${h}h ${m}m`} unit="" big accent="cyan" />
          <ReadOut label="Arrival Date" value={eta ? eta.toLocaleDateString() : "—"} unit="" />
          <ReadOut label="Arrival Time" value={eta ? eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} unit="" accent="amber" />
        </div>
      )}
      <Formula>
        <p>Time = Distance ÷ Speed. ETA = Departure date/time + Time underway. Assumes constant speed over ground for the full passage — no allowance for currents, weather routing, or traffic separation delays.</p>
      </Formula>
      <ActionBar onReset={() => { setDist(""); setSpeed(""); setDepDate(""); setDepTime(""); }} onCopy={() => {}} onSave={() => onSave("ETA Calculator", { dist, speed, depDate, depTime }, { hours, eta })} />
    </div>
  );
}

function SpeedDistTimeCalc({ onSave }) {
  const [solve, setSolve] = useState("speed");
  const [distance, setDistance] = useState("100");
  const [distUnit, setDistUnit] = useState("nm");
  const [speed, setSpeed] = useState("10");
  const [speedUnit, setSpeedUnit] = useState("kn");
  const [time, setTime] = useState("10");
  const [timeUnit, setTimeUnit] = useState("h");

  const distToM = { nm: NM_TO_M, km: 1000, m: 1 };
  const speedToMs = { kn: 1852 / 3600, "km/h": 1000 / 3600, "m/s": 1 };
  const timeToS = { h: 3600, min: 60, s: 1 };

  const result = useMemo(() => {
    const dM = parseFloat(distance) * (distToM[distUnit] ?? 1);
    const sMs = parseFloat(speed) * (speedToMs[speedUnit] ?? 1);
    const tS = parseFloat(time) * (timeToS[timeUnit] ?? 1);
    if (solve === "speed") { if (Number.isNaN(dM) || Number.isNaN(tS) || tS === 0) return null; return { speedMs: dM / tS }; }
    if (solve === "distance") { if (Number.isNaN(sMs) || Number.isNaN(tS)) return null; return { distM: sMs * tS }; }
    if (Number.isNaN(dM) || Number.isNaN(sMs) || sMs === 0) return null;
    return { timeS: dM / sMs };
  }, [solve, distance, distUnit, speed, speedUnit, time, timeUnit]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Speed / Distance / Time" desc="Distance = Speed × Time. Choose which value to solve for." />
      <Panel>
        <div className="mb-4"><SegButton value={solve} onChange={setSolve} options={[{ value: "speed", label: "Solve Speed" }, { value: "distance", label: "Solve Distance" }, { value: "time", label: "Solve Time" }]} /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Field label="Distance">
              <div className="flex gap-2">
                <NumInput value={distance} onChange={setDistance} />
                <select value={distUnit} onChange={(e) => setDistUnit(e.target.value)} disabled={solve === "distance"} className="bg-slate-900 border border-slate-700 rounded-md px-2 text-xs text-slate-300 disabled:opacity-40">
                  <option value="nm">NM</option><option value="km">km</option><option value="m">m</option>
                </select>
              </div>
            </Field>
          </div>
          <Field label="Speed">
            <div className="flex gap-2">
              <NumInput value={speed} onChange={setSpeed} />
              <select value={speedUnit} onChange={(e) => setSpeedUnit(e.target.value)} disabled={solve === "speed"} className="bg-slate-900 border border-slate-700 rounded-md px-2 text-xs text-slate-300 disabled:opacity-40">
                <option value="kn">kn</option><option value="km/h">km/h</option><option value="m/s">m/s</option>
              </select>
            </div>
          </Field>
          <Field label="Time">
            <div className="flex gap-2">
              <NumInput value={time} onChange={setTime} />
              <select value={timeUnit} onChange={(e) => setTimeUnit(e.target.value)} disabled={solve === "time"} className="bg-slate-900 border border-slate-700 rounded-md px-2 text-xs text-slate-300 disabled:opacity-40">
                <option value="h">h</option><option value="min">min</option><option value="s">s</option>
              </select>
            </div>
          </Field>
        </div>
      </Panel>
      {result && (
        <div className="grid sm:grid-cols-3 gap-3">
          {solve === "speed" && <>
            <ReadOut label="Speed" value={fmt(result.speedMs / (1852 / 3600))} unit="kn" big accent="cyan" />
            <ReadOut label="Speed" value={fmt(result.speedMs * 3.6)} unit="km/h" />
            <ReadOut label="Speed" value={fmt(result.speedMs)} unit="m/s" />
          </>}
          {solve === "distance" && <>
            <ReadOut label="Distance" value={fmt(result.distM / NM_TO_M)} unit="NM" big accent="cyan" />
            <ReadOut label="Distance" value={fmt(result.distM / 1000)} unit="km" />
            <ReadOut label="Distance" value={fmt(result.distM, 0)} unit="m" />
          </>}
          {solve === "time" && <>
            <ReadOut label="Time" value={fmt(result.timeS / 3600)} unit="h" big accent="cyan" />
            <ReadOut label="Time" value={fmt(result.timeS / 60, 1)} unit="min" />
            <ReadOut label="Time" value={fmt(result.timeS, 0)} unit="s" />
          </>}
        </div>
      )}
      <Formula><p>D = S × T, rearranged to solve for the selected unknown. All values are normalized to SI (metres, m/s, seconds) internally, then converted for display.</p></Formula>
      <ActionBar onReset={() => { setDistance(""); setSpeed(""); setTime(""); }} onCopy={() => {}} onSave={() => onSave("Speed/Distance/Time", { solve, distance, speed, time }, result)} />
    </div>
  );
}

function SetDriftCalc({ onSave }) {
  const [shipCourse, setShipCourse] = useState("090");
  const [shipSpeed, setShipSpeed] = useState("14");
  const [set, setSet] = useState("045");
  const [drift, setDrift] = useState("1.5");

  const result = useMemo(() => {
    const sc = parseFloat(shipCourse), ss = parseFloat(shipSpeed), s = parseFloat(set), d = parseFloat(drift);
    if ([sc, ss, s, d].some(Number.isNaN)) return null;
    const vx = ss * Math.sin(toRad(sc)) + d * Math.sin(toRad(s));
    const vy = ss * Math.cos(toRad(sc)) + d * Math.cos(toRad(s));
    const cmg = norm360(toDeg(Math.atan2(vx, vy)));
    const smg = Math.sqrt(vx * vx + vy * vy);
    return { cmg, smg };
  }, [shipCourse, shipSpeed, set, drift]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Set & Drift" desc="Resolve course/speed made good from the ship's intended course & speed and the current's set & drift." />
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Inputs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ship Course" unit="°T"><NumInput value={shipCourse} onChange={setShipCourse} /></Field>
            <Field label="Ship Speed" unit="kn"><NumInput value={shipSpeed} onChange={setShipSpeed} /></Field>
            <Field label="Current Set" unit="°T"><NumInput value={set} onChange={setSet} /></Field>
            <Field label="Current Drift" unit="kn"><NumInput value={drift} onChange={setDrift} /></Field>
          </div>
          {result && <div className="grid grid-cols-2 gap-3 mt-4">
            <ReadOut label="Course Made Good" value={fmt(result.cmg, 1)} unit="°T" accent="cyan" />
            <ReadOut label="Speed Made Good" value={fmt(result.smg, 2)} unit="kn" accent="amber" />
          </div>}
        </Panel>
        <Panel title="Vector Diagram">
          {result && <CompassRose vectors={[
            { deg: parseFloat(shipCourse), color: "#64748b", len: 0.6 },
            { deg: parseFloat(set), color: "#f59e0b", len: 0.35 },
            { deg: result.cmg, color: "#22d3ee", len: 0.85, width: 3 },
          ]} />}
          <div className="flex justify-center gap-4 text-[10px] text-slate-400 mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Ship's Course</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Current</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Resultant</span>
          </div>
        </Panel>
      </div>
      <Formula>
        <p>Vector resolution: resultant = ship's velocity vector + current velocity vector, each resolved into North/East components (v·sin θ, v·cos θ), then recombined via atan2 and Pythagoras.</p>
      </Formula>
      <ActionBar onReset={() => { setShipCourse(""); setShipSpeed(""); setSet(""); setDrift(""); }} onCopy={() => {}} onSave={() => onSave("Set & Drift", { shipCourse, shipSpeed, set, drift }, result)} />
    </div>
  );
}

function TidalCalc({ onSave }) {
  const [hwTime, setHwTime] = useState("06:00");
  const [hwHeight, setHwHeight] = useState("5.8");
  const [lwTime, setLwTime] = useState("12:15");
  const [lwHeight, setLwHeight] = useState("1.2");
  const [atTime, setAtTime] = useState("09:00");

  const result = useMemo(() => {
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    if (!hwTime || !lwTime || !atTime) return null;
    let hw = toMin(hwTime), lw = toMin(lwTime), at = toMin(atTime);
    if (lw < hw) lw += 1440;
    if (at < hw) at += 1440;
    const range = parseFloat(hwHeight) - parseFloat(lwHeight);
    const duration = lw - hw;
    if (duration <= 0 || at > lw + 1) return null;
    const frac = (at - hw) / duration;
    const height = parseFloat(hwHeight) - range * (1 - Math.cos(frac * Math.PI)) / 2;
    return { height, falling: true, frac };
  }, [hwTime, hwHeight, lwTime, lwHeight, atTime]);

  const curvePts = useMemo(() => {
    const pts = [];
    const hwH = parseFloat(hwHeight), lwH = parseFloat(lwHeight);
    for (let i = 0; i <= 40; i++) {
      const frac = i / 40;
      const h = hwH - (hwH - lwH) * (1 - Math.cos(frac * Math.PI)) / 2;
      pts.push([frac, h]);
    }
    return pts;
  }, [hwHeight, lwHeight]);

  const maxH = Math.max(parseFloat(hwHeight) || 1, 1);
  const minH = Math.min(parseFloat(lwHeight) || 0, 0);

  return (
    <div className="space-y-5">
      <CalcHeader title="Tidal Calculator" desc="Estimate tide height at a given time between a known High Water and Low Water using cosine (half-tide) interpolation." />
      <Panel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="HW Time"><input type="time" value={hwTime} onChange={(e) => setHwTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" /></Field>
          <Field label="HW Height" unit="m"><NumInput value={hwHeight} onChange={setHwHeight} /></Field>
          <Field label="LW Time"><input type="time" value={lwTime} onChange={(e) => setLwTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" /></Field>
          <Field label="LW Height" unit="m"><NumInput value={lwHeight} onChange={setLwHeight} /></Field>
          <Field label="Desired Time"><input type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100" /></Field>
        </div>
      </Panel>
      {result ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <ReadOut label="Estimated Height" value={fmt(result.height)} unit="m" big accent="cyan" />
          <ReadOut label="Tide State" value={result.frac < 0.5 ? "Falling" : "Falling"} unit="" accent="amber" />
        </div>
      ) : <Warning level="caution">Enter a desired time that falls between the HW and LW times.</Warning>}
      <Panel title="Tide Curve">
        <svg viewBox="0 0 400 140" className="w-full h-auto">
          <polyline fill="none" stroke="#22d3ee" strokeWidth="2"
            points={curvePts.map(([f, h]) => `${f * 380 + 10},${130 - ((h - minH) / (maxH - minH || 1)) * 110}`).join(" ")} />
          {result && <circle cx={result.frac * 380 + 10} cy={130 - ((result.height - minH) / (maxH - minH || 1)) * 110} r="4" fill="#f59e0b" />}
          <line x1="10" y1="130" x2="390" y2="130" stroke="#334155" />
        </svg>
      </Panel>
      <Warning level="caution">This is a simplified estimation tool (cosine interpolation between one HW and one LW). It does not replace official Admiralty Tide Tables or hydrographic publications for passage/berthing decisions.</Warning>
      <Formula><p>Height(t) = HW − (HW − LW) × (1 − cos(π·f))/2, where f is the fraction of elapsed time between HW and LW (0→1). This approximates the standard "twelfths"-style tidal curve for a simple semi-diurnal tide.</p></Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Tidal Calculator", { hwTime, hwHeight, lwTime, lwHeight, atTime }, result)} />
    </div>
  );
}

function CompassCalc({ onSave }) {
  const [compassCourse, setCompassCourse] = useState("088");
  const [variation, setVariation] = useState("-4");
  const [deviation, setDeviation] = useState("2");

  const result = useMemo(() => {
    const cc = parseFloat(compassCourse), v = parseFloat(variation), d = parseFloat(deviation);
    if ([cc, v, d].some(Number.isNaN)) return null;
    const magnetic = norm360(cc + d);
    const trueC = norm360(magnetic + v);
    const error = norm360(v + d + 180) - 180;
    return { magnetic, trueC, error };
  }, [compassCourse, variation, deviation]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Compass Error" desc="Convert between Compass, Magnetic, and True courses using variation and deviation (East positive, West negative)." />
      <Panel>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Compass Course" unit="°C"><NumInput value={compassCourse} onChange={setCompassCourse} /></Field>
          <Field label="Deviation" unit="° (E+/W-)"><NumInput value={deviation} onChange={setDeviation} /></Field>
          <Field label="Variation" unit="° (E+/W-)"><NumInput value={variation} onChange={setVariation} /></Field>
        </div>
      </Panel>
      {result && (
        <div className="grid sm:grid-cols-3 gap-3">
          <ReadOut label="Magnetic Course" value={fmt(result.magnetic, 1)} unit="°M" />
          <ReadOut label="True Course" value={fmt(result.trueC, 1)} unit="°T" big accent="cyan" />
          <ReadOut label="Total Compass Error" value={`${fmt(Math.abs(result.error), 1)}° ${result.error >= 0 ? "E" : "W"}`} unit="" accent="amber" />
        </div>
      )}
      <Panel title="TVMDC Flow">
        <div className="flex flex-col items-center gap-1 font-mono text-sm text-slate-300">
          <div className="px-4 py-1.5 rounded bg-slate-800 border border-slate-700">TRUE {result ? fmt(result.trueC, 1) + "°" : ""}</div>
          <ChevronDown size={14} className="text-amber-500" /><span className="text-[10px] text-slate-500">Variation</span>
          <div className="px-4 py-1.5 rounded bg-slate-800 border border-slate-700">MAGNETIC {result ? fmt(result.magnetic, 1) + "°" : ""}</div>
          <ChevronDown size={14} className="text-amber-500" /><span className="text-[10px] text-slate-500">Deviation</span>
          <div className="px-4 py-1.5 rounded bg-slate-800 border border-slate-700">COMPASS {compassCourse}°</div>
        </div>
      </Panel>
      <Formula>
        <p>Magnetic = Compass + Deviation. True = Magnetic + Variation. Total Error = Variation + Deviation. Sign convention: <b>East is positive, West is negative</b> ("error east, compass least; error west, compass best").</p>
      </Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Compass Error", { compassCourse, variation, deviation }, result)} />
    </div>
  );
}

function CoordinatesCalc({ onSave }) {
  const [lat, setLat] = useState({ deg: "31", min: "12.006", hemi: "N" });
  const [lon, setLon] = useState({ deg: "121", min: "26.232", hemi: "W" });
  const latDD = useMemo(() => ddmToDecimal(lat.deg, lat.min, lat.hemi), [lat]);
  const lonDD = useMemo(() => ddmToDecimal(lon.deg, lon.min, lon.hemi), [lon]);
  const latO = useMemo(() => (Number.isNaN(latDD) || Math.abs(latDD) > 90 ? null : ddToDMS(latDD, true)), [latDD]);
  const lonO = useMemo(() => (Number.isNaN(lonDD) || Math.abs(lonDD) > 180 ? null : ddToDMS(lonDD, false)), [lonDD]);
  const [copied, setCopied] = useState("");
  const copy = (txt, key) => { navigator.clipboard?.writeText(txt); setCopied(key); setTimeout(() => setCopied(""), 1200); };

  return (
    <div className="space-y-5">
      <CalcHeader title="Position & Coordinate Converter" desc="Enter a position in Degrees Decimal Minutes (DDM) — the primary format used across ShipNav — and convert it to Decimal Degrees and Degrees Minutes Seconds." />
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Latitude">
          <LatLonDDM label="Degrees Decimal Minutes" isLat value={lat} onChange={setLat} />
          {latO ? (
            <div className="mt-3 space-y-2">
              {[["Decimal Degrees", `${fmt(Math.abs(latDD), 5)}° ${latO.dir}`], ["DMS", latO.dms]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-md px-3 py-2">
                  <div><span className="text-[10px] text-slate-500 uppercase mr-2">{k}</span><span className="font-mono text-sm text-cyan-300">{v}</span></div>
                  <button onClick={() => copy(v, "lat" + k)} className="text-slate-500 hover:text-cyan-400"><Copy size={13} /></button>
                </div>
              ))}
              {copied.startsWith("lat") && <div className="text-[10px] text-emerald-400">Copied</div>}
            </div>
          ) : <Warning level="danger">Latitude must be between 0° and 90° (N/S).</Warning>}
        </Panel>
        <Panel title="Longitude">
          <LatLonDDM label="Degrees Decimal Minutes" value={lon} onChange={setLon} />
          {lonO ? (
            <div className="mt-3 space-y-2">
              {[["Decimal Degrees", `${fmt(Math.abs(lonDD), 5)}° ${lonO.dir}`], ["DMS", lonO.dms]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-md px-3 py-2">
                  <div><span className="text-[10px] text-slate-500 uppercase mr-2">{k}</span><span className="font-mono text-sm text-cyan-300">{v}</span></div>
                  <button onClick={() => copy(v, "lon" + k)} className="text-slate-500 hover:text-cyan-400"><Copy size={13} /></button>
                </div>
              ))}
              {copied.startsWith("lon") && <div className="text-[10px] text-emerald-400">Copied</div>}
            </div>
          ) : <Warning level="danger">Longitude must be between 0° and 180° (E/W).</Warning>}
        </Panel>
      </div>
      <Formula><p>DDM (input): degrees + decimal minutes. Decimal Degrees = degrees + minutes⁄60, signed by hemisphere. DMS: whole minutes plus decimal seconds (sec = fractional minute × 60).</p></Formula>
      <ActionBar onReset={() => { setLat({ deg: "", min: "", hemi: "N" }); setLon({ deg: "", min: "", hemi: "E" }); }} onCopy={() => {}} onSave={() => onSave("Coordinate Converter", { lat, lon }, { latO, lonO })} />
    </div>
  );
}

function ConverterCalc({ onSave }) {
  const groups = {
    Distance: { units: { NM: 1852, km: 1000, m: 1, ft: 0.3048 }, def: [1, "NM", "km"] },
    Speed: { units: { knots: 1852 / 3600, "km/h": 1000 / 3600, "m/s": 1 }, def: [10, "knots", "m/s"] },
    Depth: { units: { m: 1, ft: 0.3048, fathoms: 1.8288 }, def: [10, "m", "fathoms"] },
    Pressure: { units: { hPa: 1, bar: 1000, psi: 68.9476 }, def: [1013, "hPa", "bar"] },
    Temperature: { special: true, def: [20, "C", "F"] },
  };
  const [group, setGroup] = useState("Distance");
  const [value, setValue] = useState(String(groups[group].def[0]));
  const [from, setFrom] = useState(groups[group].def[1]);
  const [to, setTo] = useState(groups[group].def[2]);

  const changeGroup = (g) => { setGroup(g); setValue(String(groups[g].def[0])); setFrom(groups[g].def[1]); setTo(groups[g].def[2]); };

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (Number.isNaN(v)) return null;
    if (group === "Temperature") {
      const toC = { C: v, F: (v - 32) * 5 / 9, K: v - 273.15 }[from];
      return { C: toC, F: toC * 9 / 5 + 32, K: toC + 273.15 }[to];
    }
    const base = v * groups[group].units[from];
    return base / groups[group].units[to];
  }, [group, value, from, to]);

  const unitList = group === "Temperature" ? ["C", "F", "K"] : Object.keys(groups[group].units);

  return (
    <div className="space-y-5">
      <CalcHeader title="Nautical Unit Converter" desc="Convert common maritime units for distance, speed, depth, pressure, and temperature." />
      <Panel>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(groups).map((g) => (
            <button key={g} onClick={() => changeGroup(g)} className={`px-3 py-1.5 rounded-md text-xs font-medium border ${group === g ? "bg-cyan-600 border-cyan-600 text-white" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}>{g}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <Field label="Value"><NumInput value={value} onChange={setValue} /></Field>
          <Field label="From"><Select value={from} onChange={setFrom} options={unitList.map((u) => ({ value: u, label: u }))} /></Field>
          <Field label="To"><Select value={to} onChange={setTo} options={unitList.map((u) => ({ value: u, label: u }))} /></Field>
        </div>
      </Panel>
      {result !== null && <ReadOut label={`${value} ${from} =`} value={fmt(result, 4)} unit={to} big accent="cyan" />}
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Unit Converter", { group, value, from, to }, result)} />
    </div>
  );
}

function SquatCalc({ onSave }) {
  const [length, setLength] = useState("200");
  const [beam, setBeam] = useState("32");
  const [draft, setDraft] = useState("12");
  const [speed, setSpeed] = useState("14");
  const [depth, setDepth] = useState("14.5");
  const [channelWidth, setChannelWidth] = useState("300");
  const [cb, setCb] = useState("0.75");

  const result = useMemo(() => {
    const T = parseFloat(draft), V = parseFloat(speed), h = parseFloat(depth), Cb = parseFloat(cb), B = parseFloat(beam), W = parseFloat(channelWidth);
    if ([T, V, h, Cb].some(Number.isNaN) || h <= 0) return null;
    const hT = h / T;
    // Barrass simplified formula for confined channel; open water uses a smaller coefficient.
    const confined = !Number.isNaN(W) && !Number.isNaN(B) && W > 0 && W / B < 4 * (h / T);
    const squatOpen = (Cb * V * V) / 100;
    const squat = confined ? squatOpen * 1.3 : squatOpen; // simple blockage adjustment
    const ukc = h - T - squat / 100 * 0; // squat already in cm below
    const squatM = squat / 100;
    const ukcAfterSquat = h - T - squatM;
    return { squatM, ukcAfterSquat, hT, confined };
  }, [length, beam, draft, speed, depth, channelWidth, cb]);

  let warnLevel = "safe", warnMsg = "Under-keel clearance appears adequate for the entered parameters.";
  if (result) {
    if (result.hT < 1.1) { warnLevel = "danger"; warnMsg = "Depth-to-draft ratio below 1.1 — very shallow water effects; squat formula becomes unreliable."; }
    else if (result.ukcAfterSquat < 0) { warnLevel = "danger"; warnMsg = "Estimated UKC after squat is negative — grounding risk. Reduce speed or reassess route/depth."; }
    else if (result.ukcAfterSquat < 0.5) { warnLevel = "caution"; warnMsg = "UKC after squat is marginal (<0.5 m). Consider reducing speed."; }
  }

  return (
    <div className="space-y-5">
      <CalcHeader title="Ship Squat Calculator" desc="Estimate squat and under-keel clearance in restricted/shallow water using the Barrass simplified method." />
      <Panel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Length (LBP)" unit="m"><NumInput value={length} onChange={setLength} /></Field>
          <Field label="Beam" unit="m"><NumInput value={beam} onChange={setBeam} /></Field>
          <Field label="Draft" unit="m"><NumInput value={draft} onChange={setDraft} /></Field>
          <Field label="Speed" unit="kn"><NumInput value={speed} onChange={setSpeed} /></Field>
          <Field label="Water Depth" unit="m"><NumInput value={depth} onChange={setDepth} /></Field>
          <Field label="Channel Width" unit="m"><NumInput value={channelWidth} onChange={setChannelWidth} /></Field>
          <Field label="Block Coefficient (Cb)"><NumInput value={cb} onChange={setCb} /></Field>
        </div>
      </Panel>
      {result && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <ReadOut label="Estimated Max Squat" value={fmt(result.squatM, 2)} unit="m" big accent="amber" />
            <ReadOut label="UKC After Squat" value={fmt(result.ukcAfterSquat, 2)} unit="m" accent={result.ukcAfterSquat < 0.5 ? "red" : "emerald"} />
            <ReadOut label="Depth / Draft Ratio" value={fmt(result.hT, 2)} unit="" />
          </div>
          <Panel title="Cross-Section">
            <svg viewBox="0 0 400 160" className="w-full h-auto">
              <rect x="0" y="0" width="400" height="160" fill="#0b1622" />
              <rect x="130" y="30" width="140" height="30" rx="4" fill="#1e293b" stroke="#475569" />
              <text x="200" y="50" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">SHIP</text>
              <rect x="140" y="60" width="120" height={Math.min(60, 20 + result.hT * 8)} fill="#0e7490" opacity="0.5" />
              <line x1="0" y1="70" x2="400" y2="70" stroke="#22d3ee" strokeDasharray="3 3" />
              <text x="8" y="65" fill="#22d3ee" fontSize="9" fontFamily="monospace">WATER</text>
              <line x1="0" y1="140" x2="400" y2="140" stroke="#78350f" strokeWidth="3" />
              <text x="8" y="155" fill="#a16207" fontSize="9" fontFamily="monospace">SEABED</text>
              <line x1="200" y1="90" x2="200" y2="140" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" />
              <text x="205" y="115" fill="#f59e0b" fontSize="9" fontFamily="monospace">SQUAT {fmt(result.squatM, 2)}m</text>
            </svg>
          </Panel>
        </>
      )}
      <Warning level={warnLevel}>{warnMsg}</Warning>
      <Formula>
        <p><b>Barrass simplified squat formula (open water):</b> Smax (cm) = Cb × V² / 100, V in knots. A blockage factor is applied when the channel-width-to-beam ratio indicates confined/restricted water (approximate adjustment, not a full Barrass confined-channel solution).</p>
        <p><b>Assumptions:</b> valid roughly for h/T between 1.1–1.5; simplified — does not model trim, squat distribution fore/aft, or bank effects. Always cross-check against a full squat table, class-approved software, and the passage plan's UKC policy.</p>
      </Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Ship Squat", { length, beam, draft, speed, depth, channelWidth, cb }, result)} />
    </div>
  );
}

function TurningCalc({ onSave }) {
  const [speed, setSpeed] = useState("16");
  const [rot, setRot] = useState("15");
  const [courseChange, setCourseChange] = useState("60");

  const result = useMemo(() => {
    const V = parseFloat(speed), ROT = parseFloat(rot), dC = parseFloat(courseChange);
    if ([V, ROT, dC].some(Number.isNaN) || ROT <= 0) return null;
    const Vms = V * 1852 / 3600;
    const rotRads = ROT * (Math.PI / 180) / 60; // deg/min -> rad/s
    const radius = Vms / rotRads; // metres
    const theta = toRad(dC);
    const advance = radius * Math.sin(theta);
    const transfer = radius * (1 - Math.cos(theta));
    const tacticalDiameter = radius * (1 - Math.cos(toRad(180))) * 1; // = 2R at 180deg
    const wheelOverDist = radius * Math.tan(theta / 2);
    return { radius, advance, transfer, tacticalDiameter: 2 * radius, wheelOverDist };
  }, [speed, rot, courseChange]);

  const pathPts = useMemo(() => {
    if (!result) return "";
    const pts = [];
    const steps = 40;
    const maxTheta = toRad(parseFloat(courseChange));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * maxTheta;
      const x = result.radius * Math.sin(t);
      const y = result.radius * (1 - Math.cos(t));
      pts.push([x, y]);
    }
    return pts;
  }, [result, courseChange]);

  const scale = result ? 140 / Math.max(result.radius, 1) : 1;

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <CalcHeader title="Advance & Transfer / Wheel-Over" desc="Estimate turning circle geometry, advance, transfer, tactical diameter, and the wheel-over point for a course change." />
        <Panel>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Ship Speed" unit="kn"><NumInput value={speed} onChange={setSpeed} /></Field>
            <Field label="Rate of Turn" unit="°/min"><NumInput value={rot} onChange={setRot} /></Field>
            <Field label="Course Change" unit="°"><NumInput value={courseChange} onChange={setCourseChange} /></Field>
          </div>
        </Panel>
        {result && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ReadOut label="Turn Radius (calc.)" value={fmt(result.radius, 0)} unit="m" />
              <ReadOut label="Advance (calc.)" value={fmt(result.advance, 0)} unit="m" big accent="cyan" />
              <ReadOut label="Transfer (calc.)" value={fmt(result.transfer, 0)} unit="m" accent="amber" />
              <ReadOut label="Tactical Diameter (calc.)" value={fmt(result.tacticalDiameter, 0)} unit="m" />
            </div>
            <Panel title="Turning Path">
              <svg viewBox="0 0 300 220" className="w-full h-auto max-w-sm mx-auto">
                <line x1="20" y1="20" x2="20" y2="200" stroke="#334155" strokeDasharray="3 3" />
                <polyline fill="none" stroke="#22d3ee" strokeWidth="2.5"
                  points={pathPts.map(([x, y]) => `${20 + x * scale},${20 + y * scale}`).join(" ")} />
                <circle cx="20" cy="20" r="3" fill="#e2e8f0" />
                <text x="26" y="14" fill="#94a3b8" fontSize="9" fontFamily="monospace">WOP</text>
              </svg>
              <p className="text-center text-[10px] text-slate-500">Calculated turning path — labelled values are estimates, not measured sea-trial data.</p>
            </Panel>
          </>
        )}
      </div>
      {result && (
        <div className="space-y-5">
          <CalcHeader title="Wheel-Over Point" desc="Distance before the waypoint at which the helm should go over to roll out neatly onto the new course." />
          <ReadOut label="Distance Before Waypoint" value={fmt(result.wheelOverDist, 0)} unit="m" big accent="emerald" />
        </div>
      )}
      <Formula>
        <p>Turn radius R = V / ω, where ω is rate of turn in rad/s. Advance = R·sin θ, Transfer = R·(1 − cos θ), Tactical Diameter = 2R (course change of 180°). Wheel-over distance ≈ R·tan(θ/2), the standard curve tangent-length approximation used for track-line turns.</p>
        <p><b>Note:</b> real turning circles are asymmetric due to pivot point shift, squat, wind and current — treat these as first-order estimates; use actual ship-specific manoeuvring data (wheelhouse poster / sea-trial data) for critical decisions.</p>
      </Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Advance/Transfer/WOP", { speed, rot, courseChange }, result)} />
    </div>
  );
}

function CPATCPACalc({ onSave }) {
  const [own, setOwn] = useState({ lat: { deg: "0", min: "0", hemi: "N" }, lon: { deg: "0", min: "0", hemi: "E" }, course: "090", speed: "16" });
  const [tgt, setTgt] = useState({ lat: { deg: "0", min: "3", hemi: "N" }, lon: { deg: "0", min: "18", hemi: "E" }, course: "270", speed: "14" });

  const result = useMemo(() => {
    const oLat = ddmToDecimal(own.lat.deg, own.lat.min, own.lat.hemi), oLon = ddmToDecimal(own.lon.deg, own.lon.min, own.lon.hemi);
    const oC = parseFloat(own.course), oS = parseFloat(own.speed);
    const tLat = ddmToDecimal(tgt.lat.deg, tgt.lat.min, tgt.lat.hemi), tLon = ddmToDecimal(tgt.lon.deg, tgt.lon.min, tgt.lon.hemi);
    const tC = parseFloat(tgt.course), tS = parseFloat(tgt.speed);
    if ([oLat, oLon, oC, oS, tLat, tLon, tC, tS].some(Number.isNaN)) return null;
    // relative position of target from own ship, flat-earth NM approximation for short range
    const dLatNM = (tLat - oLat) * 60;
    const dLonNM = (tLon - oLon) * 60 * Math.cos(toRad((oLat + tLat) / 2));
    const rangeNM = Math.sqrt(dLatNM ** 2 + dLonNM ** 2);
    const brgToTarget = norm360(toDeg(Math.atan2(dLonNM, dLatNM)));
    const relBrg = norm360(brgToTarget - oC);

    const ovx = oS * Math.sin(toRad(oC)), ovy = oS * Math.cos(toRad(oC));
    const tvx = tS * Math.sin(toRad(tC)), tvy = tS * Math.cos(toRad(tC));
    const rvx = tvx - ovx, rvy = tvy - ovy; // relative velocity of target wrt own ship
    const relSpeed = Math.sqrt(rvx ** 2 + rvy ** 2);
    const relCourse = norm360(toDeg(Math.atan2(rvx, rvy)));

    // position vector of target relative to own (NM, x=E, y=N)
    const px = dLonNM, py = dLatNM;
    let tcpa = 0;
    if (relSpeed > 1e-6) {
      tcpa = -(px * rvx + py * rvy) / (relSpeed * relSpeed);
    }
    tcpa = Math.max(tcpa, 0);
    const cpaX = px + rvx * tcpa;
    const cpaY = py + rvy * tcpa;
    const cpa = Math.sqrt(cpaX ** 2 + cpaY ** 2);

    return { rangeNM, brgToTarget, relBrg, relSpeed, relCourse, cpa, tcpaHrs: tcpa };
  }, [own, tgt]);

  let level = "safe";
  if (result) {
    if (result.cpa < 0.5) level = "danger";
    else if (result.cpa < 1.5) level = "caution";
  }

  return (
    <div className="space-y-5">
      <CalcHeader title="CPA / TCPA Calculator" desc="Closest Point of Approach and Time to CPA for a target vessel, from relative-motion vectors. Positions entered in Degrees Decimal Minutes (DDM)." />
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Own Ship">
          <div className="grid grid-cols-1 gap-3">
            <LatLonDDM label="Latitude" isLat value={own.lat} onChange={(v) => setOwn({ ...own, lat: v })} />
            <LatLonDDM label="Longitude" value={own.lon} onChange={(v) => setOwn({ ...own, lon: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Course" unit="°T"><NumInput value={own.course} onChange={(v) => setOwn({ ...own, course: v })} /></Field>
              <Field label="Speed" unit="kn"><NumInput value={own.speed} onChange={(v) => setOwn({ ...own, speed: v })} /></Field>
            </div>
          </div>
        </Panel>
        <Panel title="Target">
          <div className="grid grid-cols-1 gap-3">
            <LatLonDDM label="Latitude" isLat value={tgt.lat} onChange={(v) => setTgt({ ...tgt, lat: v })} />
            <LatLonDDM label="Longitude" value={tgt.lon} onChange={(v) => setTgt({ ...tgt, lon: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Course" unit="°T"><NumInput value={tgt.course} onChange={(v) => setTgt({ ...tgt, course: v })} /></Field>
              <Field label="Speed" unit="kn"><NumInput value={tgt.speed} onChange={(v) => setTgt({ ...tgt, speed: v })} /></Field>
            </div>
          </div>
        </Panel>
      </div>
      {result && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ReadOut label="Range" value={fmt(result.rangeNM, 2)} unit="NM" />
            <ReadOut label="Relative Bearing" value={fmt(result.relBrg, 1)} unit="°" />
            <ReadOut label="CPA" value={fmt(result.cpa, 2)} unit="NM" big accent={level === "danger" ? "red" : level === "caution" ? "amber" : "emerald"} />
            <ReadOut label="TCPA" value={fmt(result.tcpaHrs * 60, 1)} unit="min" accent="cyan" />
          </div>
          <Panel title="Relative Motion">
            <CompassRose vectors={[
              { deg: parseFloat(own.course), color: "#64748b", len: 0.6 },
              { deg: parseFloat(tgt.course), color: "#f59e0b", len: 0.6 },
              { deg: result.relCourse, color: "#22d3ee", len: 0.85, width: 3 },
            ]} />
            <div className="flex justify-center gap-4 text-[10px] text-slate-400 mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Own</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Target</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Relative</span>
            </div>
          </Panel>
          <Warning level={level}>
            {level === "danger" && "CPA is very close — high risk of close-quarters situation. Apply COLREGS and take early, substantial action."}
            {level === "caution" && "CPA is within a caution range — monitor closely and consider early action per COLREGS."}
            {level === "safe" && "CPA indicates a comfortable passing distance for the entered parameters."}
          </Warning>
        </>
      )}
      <Warning level="info">This tool does not replace ARPA/radar plotting, AIS, visual lookout, or the COLREGS. Always comply with the Rules of the Road and bridge collision-avoidance procedures.</Warning>
      <Formula>
        <p>Relative velocity = target velocity − own velocity (vector). TCPA = −(P·V<sub>rel</sub>) / |V<sub>rel</sub>|², CPA = |P + V<sub>rel</sub>·TCPA|, where P is the relative position vector of the target. Flat-earth NM approximation, suitable for ranges typical of collision-avoidance work.</p>
      </Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("CPA/TCPA", { own, tgt }, result)} />
    </div>
  );
}

function GeoRangeCalc({ onSave }) {
  const [light, setLight] = useState("120");
  const [lightUnit, setLightUnit] = useState("ft");
  const [eye, setEye] = useState("15");
  const [eyeUnit, setEyeUnit] = useState("ft");

  const M_TO_FT = 3.2808399;
  const result = useMemo(() => {
    const l = parseFloat(light), e = parseFloat(eye);
    if (Number.isNaN(l) || Number.isNaN(e) || l < 0 || e < 0) return null;
    const lFt = lightUnit === "m" ? l * M_TO_FT : l;
    const eFt = eyeUnit === "m" ? e * M_TO_FT : e;
    return 1.15 * (Math.sqrt(lFt) + Math.sqrt(eFt));
  }, [light, lightUnit, eye, eyeUnit]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Geographic Range" desc="Estimate the geographic (visual horizon) range of a light or object, based on the height of the light and the observer's eye above sea level." />
      <Panel>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Height of Light Above Sea Level">
            <div className="flex gap-2">
              <NumInput value={light} onChange={setLight} />
              <select value={lightUnit} onChange={(e) => setLightUnit(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md px-2 text-xs text-slate-300">
                <option value="ft">ft</option><option value="m">m</option>
              </select>
            </div>
          </Field>
          <Field label="Height of Observer's Eye Above Sea Level">
            <div className="flex gap-2">
              <NumInput value={eye} onChange={setEye} />
              <select value={eyeUnit} onChange={(e) => setEyeUnit(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-md px-2 text-xs text-slate-300">
                <option value="ft">ft</option><option value="m">m</option>
              </select>
            </div>
          </Field>
        </div>
      </Panel>
      {result !== null && <ReadOut label="Geographic Range" value={fmt(result, 2)} unit="NM" big accent="cyan" />}
      <Formula>
        <p>Geographic Range (NM) = 1.15 × ( √(height of light, ft) + √(height of eye, ft) ). Heights entered in metres are converted to feet before applying the formula.</p>
        <p><b>Assumptions:</b> standard terrestrial refraction, geometric visual horizon only — this is not the same as a light's nominal or luminous range from the light list, and does not account for atmospheric conditions. For lit aids to navigation, compare against the charted/light-list range and use the lesser of geographic and luminous range.</p>
      </Formula>
      <ActionBar onReset={() => { setLight(""); setEye(""); }} onCopy={() => {}} onSave={() => onSave("Geographic Range", { light, lightUnit, eye, eyeUnit }, result)} />
    </div>
  );
}

function TrafficLaneCalc({ onSave }) {
  const [p, setP] = useState("20");
  const [vk, setVk] = useState("18");
  const [ven, setVen] = useState("24");

  const result = useMemo(() => {
    const P = parseFloat(p), Vk = parseFloat(vk), Ven = parseFloat(ven);
    if ([P, Vk, Ven].some(Number.isNaN) || Ven === 0) return null;
    const I = 0.7 * P * (Vk / Ven);
    const B = 1.4 * P;
    const L = I + B;
    return { I, B, L };
  }, [p, vk, ven]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Traffic Lane Geometry" desc="Estimate traffic-lane length, traffic-zone width, and total zone length from radar range and relative unit speeds." />
      <Panel>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="P — Radar Range" unit="NM"><NumInput value={p} onChange={setP} /></Field>
          <Field label="Vk — Own Unit Speed" unit="kn"><NumInput value={vk} onChange={setVk} /></Field>
          <Field label="Ven — Other Unit Speed" unit="kn"><NumInput value={ven} onChange={setVen} /></Field>
        </div>
      </Panel>
      {result === null && parseFloat(ven) === 0 && <Warning level="danger">Ven (other unit speed) cannot be zero.</Warning>}
      {result && (
        <div className="grid sm:grid-cols-3 gap-3">
          <ReadOut label="Lane Length (I)" value={fmt(result.I)} unit="NM" big accent="cyan" />
          <ReadOut label="Traffic Zone Width (B)" value={fmt(result.B)} unit="NM" accent="amber" />
          <ReadOut label="Total Zone Length (L)" value={fmt(result.L)} unit="NM" />
        </div>
      )}
      <Formula>
        <p>I = 0.7 × P × (Vk / Ven) — lane length. B = 1.4 × P — traffic zone width. L = I + 1.4 × P — total zone length. P is radar detection range in NM; Vk and Ven are the speeds of own and other traffic units in knots.</p>
        <p><b>Assumptions:</b> a simplified planning relationship for sizing a traffic/screening lane relative to radar detection range; treat as a planning aid alongside the operational/tactical doctrine in force, not a substitute for it.</p>
      </Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Traffic Lane Geometry", { p, vk, ven }, result)} />
    </div>
  );
}

function StationingCalc({ onSave }) {
  const [targetCourse, setTargetCourse] = useState("180");
  const [targetSpeed, setTargetSpeed] = useState("12");
  const [initialBearing, setInitialBearing] = useState("090");
  const [initialDistance, setInitialDistance] = useState("5");
  const [finalBearing, setFinalBearing] = useState("220");
  const [finalDistance, setFinalDistance] = useState("2");
  const [ownSpeed, setOwnSpeed] = useState("24");

  const result = useMemo(() => {
    const tC = parseFloat(targetCourse), tS = parseFloat(targetSpeed);
    const iB = parseFloat(initialBearing), iD = parseFloat(initialDistance);
    const fB = parseFloat(finalBearing), fD = parseFloat(finalDistance);
    const oS = parseFloat(ownSpeed);
    if ([tC, tS, iB, iD, fB, fD, oS].some(Number.isNaN)) return null;
    if (oS <= tS) return { feasible: false, error: "Own vessel speed must be greater than guide (target) vessel speed." };

    // Initial bearing from own ship is adjusted to bearing of own ship FROM the guide (reciprocal).
    const adjIB = norm360(iB - 180);

    const tCr = toRad(tC), iBr = toRad(adjIB), fBr = toRad(fB);
    const initialX = iD * Math.sin(iBr), initialY = iD * Math.cos(iBr);
    const finalX = fD * Math.sin(fBr), finalY = fD * Math.cos(fBr);
    const deltaX = finalX - initialX, deltaY = finalY - initialY;

    const a = deltaX * deltaX + deltaY * deltaY;
    const b = 2 * (deltaX * tS * Math.sin(tCr) + deltaY * tS * Math.cos(tCr));
    const c = tS * tS - oS * oS;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return { feasible: false, error: "No solution exists with the given parameters." };

    const oneOverT = (-b + Math.sqrt(discriminant)) / (2 * a);
    if (oneOverT <= 0) return { feasible: false, error: "No physical solution exists (would require negative time)." };
    const t = 1 / oneOverT;

    const relX = deltaX / t + tS * Math.sin(tCr);
    const relY = deltaY / t + tS * Math.cos(tCr);
    const requiredCourse = norm360(toDeg(Math.atan2(relX, relY)));
    const ownDistance = oS * t;
    return { feasible: true, requiredCourse, timeRequired: t, ownDistance };
  }, [targetCourse, targetSpeed, initialBearing, initialDistance, finalBearing, finalDistance, ownSpeed]);

  return (
    <div className="space-y-5">
      <CalcHeader title="Vessel Stationing" desc="Solve the course, time, and distance required for own ship to move from its current station to a new station on a moving guide ship." />
      <Panel>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Guide Ship Course" unit="°T"><NumInput value={targetCourse} onChange={setTargetCourse} /></Field>
          <Field label="Guide Ship Speed" unit="kn"><NumInput value={targetSpeed} onChange={setTargetSpeed} /></Field>
          <Field label="Own Ship Speed" unit="kn"><NumInput value={ownSpeed} onChange={setOwnSpeed} /></Field>
          <Field label="Initial Bearing of Guide from Own Ship" unit="°T"><NumInput value={initialBearing} onChange={setInitialBearing} /></Field>
          <Field label="Initial Distance from Guide" unit="NM"><NumInput value={initialDistance} onChange={setInitialDistance} /></Field>
          <div />
          <Field label="Desired Final Bearing from Guide" unit="°T"><NumInput value={finalBearing} onChange={setFinalBearing} /></Field>
          <Field label="Desired Final Distance from Guide" unit="NM"><NumInput value={finalDistance} onChange={setFinalDistance} /></Field>
        </div>
        {parseFloat(ownSpeed) <= parseFloat(targetSpeed) && (
          <div className="mt-3"><Warning level="caution">Own ship speed must exceed the guide ship's speed for a stationing solution to exist.</Warning></div>
        )}
      </Panel>

      {result && result.feasible && (
        <div className="grid sm:grid-cols-3 gap-3">
          <ReadOut label="Required Course" value={fmt(result.requiredCourse, 1)} unit="°T" big accent="cyan" />
          <ReadOut label="Time Required" value={`${Math.floor(result.timeRequired)}h ${Math.round((result.timeRequired % 1) * 60)}m`} unit="" accent="amber" />
          <ReadOut label="Distance to Travel" value={fmt(result.ownDistance, 1)} unit="NM" />
        </div>
      )}
      {result && result.feasible === false && <Warning level="danger">{result.error}</Warning>}

      <Formula>
        <p>Own ship's initial position relative to the guide is derived from the reciprocal of the bearing of the guide from own ship. The required relative-motion vector to reach the desired final station on the moving guide is found by solving, for time t, the quadratic that sets the resultant own-ship speed equal to the entered own-ship speed; the required course follows from the resulting relative-velocity components.</p>
        <p><b>Assumptions:</b> both vessels hold constant course and speed throughout the manoeuvre; no allowance for turn radius, acceleration, current, or collision-avoidance/COLREGS constraints on the transit — verify the solution is safe to execute before using it.</p>
      </Formula>
      <ActionBar onReset={() => {}} onCopy={() => {}} onSave={() => onSave("Vessel Stationing", { targetCourse, targetSpeed, initialBearing, initialDistance, finalBearing, finalDistance, ownSpeed }, result)} />
    </div>
  );
}

function InfoStub({ title, desc, points }) {
  return (
    <div className="space-y-5">
      <CalcHeader title={title} desc={desc} />
      <Panel>
        <ul className="space-y-2 text-sm text-slate-400">
          {points.map((p, i) => <li key={i} className="flex gap-2"><ArrowRight size={14} className="text-cyan-500 mt-0.5 shrink-0" /> {p}</li>)}
        </ul>
      </Panel>
      <Warning level="info">This reference panel is informational. Always cross-check against ship-fitted equipment manuals and official documentation.</Warning>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
const CALCULATORS = [
  { id: "distance-bearing", label: "Distance & Bearing", icon: Navigation, group: "Navigation Calculators" },
  { id: "course-distance", label: "Course & Distance", icon: CornerDownRight, group: "Navigation Calculators" },
  { id: "eta", label: "ETA Calculator", icon: Clock, group: "Navigation Calculators" },
  { id: "speed-distance-time", label: "Speed Calculator", icon: Gauge, group: "Navigation Calculators" },
  { id: "set-drift", label: "Set & Drift", icon: TrendingUp, group: "Navigation Calculators" },
  { id: "geo-range", label: "Geographic Range", icon: Lightbulb, group: "Navigation Calculators" },
  { id: "squat", label: "Ship Squat Calculator", icon: Waves, group: "Ship Handling" },
  { id: "turning", label: "Advance & Transfer / WOP", icon: RotateCw, group: "Ship Handling" },
  { id: "cpa-tcpa", label: "CPA / TCPA", icon: Radio, group: "Ship Handling" },
  { id: "stationing", label: "Vessel Stationing", icon: Users, group: "Tactical / Screening" },
  { id: "traffic-lane", label: "Traffic Lane Geometry", icon: Crosshair, group: "Tactical / Screening" },
  { id: "tide", label: "Tidal Calculation", icon: Waves, group: "Tides" },
  { id: "coordinates", label: "Latitude/Longitude Conversion", icon: MapPin, group: "Position & Coordinates" },
  { id: "compass", label: "Compass Error", icon: Compass, group: "Compass" },
  { id: "ais", label: "AIS Reference", icon: Satellite, group: "AIS" },
  { id: "gnss", label: "GNSS Reference", icon: LocateFixed, group: "GNSS" },
  { id: "converter", label: "Nautical Mile Conversion", icon: Ruler, group: "Conversions" },
];

function Dashboard({ navigate, history, query, setQuery }) {
  const filtered = CALCULATORS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-cyan-500 mb-1"><Anchor size={20} /><span className="text-xs uppercase tracking-widest">Bridge Console</span></div>
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">ShipNav</h1>
        <p className="text-slate-500 text-sm mt-1">Professional Maritime Navigation Calculators</p>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search calculators..."
          className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-100" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReadOut label="Calculators" value={CALCULATORS.length} unit="" accent="cyan" />
        <ReadOut label="Saved Calculations" value={history.length} unit="" accent="amber" />
        <ReadOut label="Recent" value={history.length ? history[0].name : "—"} unit="" />
        <ReadOut label="Quick Tools" value="4" unit="" accent="emerald" />
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Calculators</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => navigate(c.id)}
              className="group flex items-start gap-3 text-left bg-slate-900/60 border border-slate-800 hover:border-cyan-700 rounded-xl p-4 transition-colors">
              <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-cyan-900/40 text-cyan-400 shrink-0"><c.icon size={18} /></div>
              <div>
                <div className="text-sm font-medium text-slate-200">{c.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{c.group}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="text-sm text-slate-500 col-span-full">No calculators match "{query}".</div>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   HISTORY / SETTINGS / ABOUT
   ============================================================ */
function HistoryPage({ history, onDelete, onClear, onRename, onDuplicate }) {
  return (
    <div className="space-y-5">
      <CalcHeader title="Saved Calculations" desc="Calculations you save from any calculator appear here for this session." />
      {history.length === 0 && <Warning level="info">No saved calculations yet. Use the Save button on any calculator.</Warning>}
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-3">
            <div>
              <input defaultValue={h.name} onBlur={(e) => onRename(h.id, e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-200 outline-none border-b border-transparent focus:border-cyan-600" />
              <div className="text-[11px] text-slate-500 mt-0.5">{new Date(h.date).toLocaleString()}</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => onDuplicate(h.id)} className="p-1.5 text-slate-500 hover:text-cyan-400" title="Duplicate"><Copy size={14} /></button>
              <button onClick={() => onDelete(h.id)} className="p-1.5 text-slate-500 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {history.length > 0 && (
        <button onClick={onClear} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12} /> Clear all history</button>
      )}
    </div>
  );
}

function SettingsPage({ theme, setTheme }) {
  return (
    <div className="space-y-5">
      <CalcHeader title="Settings" desc="Application preferences." />
      <Panel title="Appearance">
        <SegButton value={theme} onChange={setTheme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
      </Panel>
      <Panel title="Units">
        <p className="text-xs text-slate-500">Default units are nautical miles, knots, and metres throughout the app; each calculator also offers inline unit switching.</p>
      </Panel>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="space-y-5">
      <CalcHeader title="About ShipNav" desc="Professional maritime navigation calculators for deck officers and navigation students." />
      <Panel>
        <p className="text-sm text-slate-400 leading-relaxed">
          ShipNav provides calculation and educational aids for common navigation, ship-handling, tidal, and collision-avoidance tasks.
          It is designed to support — not replace — official nautical charts, Sailing Directions, Admiralty publications, ECDIS, radar,
          GNSS, COLREGS, official tide tables, and the Master's / OOW's professional judgement.
        </p>
      </Panel>
      <Warning level="caution">All results are estimates based on the simplified formulas documented within each calculator's "Formula & Method" panel. Verify critical decisions against official sources and bridge procedures.</Warning>
    </div>
  );
}

/* ============================================================
   APP SHELL
   ============================================================ */
const SIDEBAR = [
  { id: "dashboard", label: "Dashboard", icon: Anchor },
  { id: "nav-calcs", label: "Navigation Calculators", icon: Navigation, sub: ["distance-bearing", "course-distance", "eta", "speed-distance-time", "set-drift", "geo-range"] },
  { id: "ship-handling", label: "Ship Handling", icon: Ship, sub: ["squat", "turning", "cpa-tcpa"] },
  { id: "tactical", label: "Tactical / Screening", icon: Users, sub: ["stationing", "traffic-lane"] },
  { id: "tide", label: "Tides", icon: Waves },
  { id: "coordinates", label: "Position & Coordinates", icon: MapPin },
  { id: "compass", label: "Compass", icon: Compass },
  { id: "ais", label: "AIS", icon: Satellite },
  { id: "gnss", label: "GNSS", icon: LocateFixed },
  { id: "converter", label: "Conversions", icon: Ruler },
  { id: "history", label: "Saved Calculations", icon: Save },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "about", label: "About", icon: Info },
];

const PAGE_TITLES = Object.fromEntries(CALCULATORS.map((c) => [c.id, c.label]));

export default function ShipNavApp() {
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState({ "nav-calcs": true, "ship-handling": true, "tactical": true });
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState("dark");
  const idRef = useRef(0);

  const saveCalc = (name, inputs, results) => {
    idRef.current += 1;
    setHistory((h) => [{ id: idRef.current, name, inputs, results, date: Date.now() }, ...h]);
  };

  const navigate = (id) => { setPage(id); setSidebarOpen(false); };

  const light = theme === "light";

  const content = () => {
    switch (page) {
      case "dashboard": return <Dashboard navigate={navigate} history={history} query={query} setQuery={setQuery} />;
      case "distance-bearing": return <DistanceBearingCalc onSave={saveCalc} />;
      case "course-distance": return <CourseDistanceCalc onSave={saveCalc} />;
      case "eta": return <ETACalc onSave={saveCalc} />;
      case "speed-distance-time": return <SpeedDistTimeCalc onSave={saveCalc} />;
      case "set-drift": return <SetDriftCalc onSave={saveCalc} />;
      case "squat": return <SquatCalc onSave={saveCalc} />;
      case "turning": return <TurningCalc onSave={saveCalc} />;
      case "cpa-tcpa": return <CPATCPACalc onSave={saveCalc} />;
      case "geo-range": return <GeoRangeCalc onSave={saveCalc} />;
      case "stationing": return <StationingCalc onSave={saveCalc} />;
      case "traffic-lane": return <TrafficLaneCalc onSave={saveCalc} />;
      case "tide": return <TidalCalc onSave={saveCalc} />;
      case "coordinates": return <CoordinatesCalc onSave={saveCalc} />;
      case "compass": return <CompassCalc onSave={saveCalc} />;
      case "converter": return <ConverterCalc onSave={saveCalc} />;
      case "ais": return <InfoStub title="AIS Reference" desc="Automatic Identification System — quick reference." points={[
        "Class A: mandatory for SOLAS vessels; broadcasts position, course, speed, MMSI, and voyage data.",
        "Class B: lower-power AIS typically fitted to smaller/leisure craft.",
        "Use AIS to support, not replace, radar/ARPA and visual lookout when assessing collision risk.",
        "Static data (MMSI, name, dimensions) should be cross-checked against visual/radar identification.",
      ]} />;
      case "gnss": return <InfoStub title="GNSS Reference" desc="Global Navigation Satellite Systems — quick reference." points={[
        "Constellations in common use: GPS, GLONASS, Galileo, BeiDou.",
        "Typical unaided horizontal accuracy is on the order of a few metres; DGPS/RTK improve this significantly.",
        "Cross-check GNSS position regularly against radar/visual fixes, especially in restricted waters.",
        "Be alert to jamming/spoofing risk in certain areas; maintain traditional fixing skills as a backup.",
      ]} />;
      case "history": return <HistoryPage history={history}
        onDelete={(id) => setHistory((h) => h.filter((x) => x.id !== id))}
        onClear={() => setHistory([])}
        onRename={(id, name) => setHistory((h) => h.map((x) => x.id === id ? { ...x, name } : x))}
        onDuplicate={(id) => setHistory((h) => { const item = h.find((x) => x.id === id); return item ? [{ ...item, id: Date.now() }, ...h] : h; })}
      />;
      case "settings": return <SettingsPage theme={theme} setTheme={setTheme} />;
      case "about": return <AboutPage />;
      default: return <Dashboard navigate={navigate} history={history} query={query} setQuery={setQuery} />;
    }
  };

  return (
    <div className={`${light ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-slate-100"} min-h-screen w-full flex font-sans`}>
      {/* Sidebar */}
      <aside className={`fixed lg:static z-40 inset-y-0 left-0 w-72 ${light ? "bg-white border-slate-200" : "bg-slate-900/95 border-slate-800"} border-r flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-600/20 text-cyan-400"><Anchor size={18} /></div>
            <div>
              <div className="font-bold text-sm tracking-wide">SHIPNAV</div>
              <div className="text-[10px] text-slate-500 -mt-0.5">Navigation Suite</div>
            </div>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {SIDEBAR.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => item.sub ? setExpanded((e) => ({ ...e, [item.id]: !e[item.id] })) : navigate(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  page === item.id ? "bg-cyan-600/15 text-cyan-400" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-2.5"><item.icon size={16} /> {item.label}</span>
                {item.sub && (expanded[item.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              </button>
              {item.sub && expanded[item.id] && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-800 pl-3">
                  {item.sub.map((sid) => (
                    <button key={sid} onClick={() => navigate(sid)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs ${page === sid ? "text-cyan-400" : "text-slate-500 hover:text-slate-200"}`}>
                      {PAGE_TITLES[sid]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-slate-800/60 text-[10px] text-slate-600">Calculation aid only · not a substitute for official publications</div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className={`sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-8 h-14 border-b ${light ? "bg-white/90 border-slate-200" : "bg-slate-950/90 border-slate-800"} backdrop-blur`}>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="text-sm text-slate-500">
            <span className="text-slate-300 font-medium">{page === "dashboard" ? "Dashboard" : (PAGE_TITLES[page] || SIDEBAR.find(s => s.id === page)?.label || "")}</span>
          </div>
        </header>
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-5xl w-full mx-auto">
          {content()}
        </main>
      </div>
    </div>
  );
}
