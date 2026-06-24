import { useState, useEffect, useCallback } from "react";
import Login from "./Login.jsx";
import SteuerView from "./Steuer.jsx";
import KalkulatorView from "./Kalkulator.jsx";
import { usePush } from "./usePush.js";
import RechnungenView from "./Rechnungen.jsx";
import SupportMailView from "./SupportMail.jsx";
import ReturnsView from "./Returns.jsx";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Package, ShoppingCart, TrendingUp, Users, Settings, BarChart2,
  FileText, DollarSign, AlertTriangle, Plus, Edit2, Trash2, X,
  Check, Search, Printer, Home, Archive, Receipt, RefreshCw, Upload, Eye, Bell, BellOff, Smartphone, Calculator, Landmark, Megaphone, ClipboardList, Clock, Truck, Mail, Send
} from "lucide-react";

// ── Supabase ──────────────────────────────────────────────────────────
// ✏️ Supabase Zugangsdaten

// ── Farben ────────────────────────────────────────────────────────────
const C = {
  bg:"#050505", panel:"#090909", card:"#10100f", card2:"#151513",
  bdr:"#2a2925", red:"#ff304f", grn:"#38d970", ylw:"#f8b938",
  blu:"#5aa7ff", txt:"#f4f1e8", muted:"#a09a8c", dim:"#5a554c",
  ink:"#0b0b0a", line:"#37342d"
};

function GlobalChromeStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      html, body, #root { min-height: 100%; margin: 0; background: ${C.bg}; }
      body { font-family: "Barlow", sans-serif; }
      button, input, select, textarea { outline: none; }
      button { font: inherit; }
      input::placeholder, textarea::placeholder { color: #6d675d; }
      ::selection { background: ${C.red}; color: white; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: #080807; }
      ::-webkit-scrollbar-thumb { background: #28251f; border: 2px solid #080807; border-radius: 8px; }
      .dof-shell {
        background:
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(180deg, rgba(255,255,255,0.018) 1px, transparent 1px),
          ${C.bg};
        background-size: 56px 56px, 56px 56px, auto;
      }
      .dof-card-hover { transition: border-color .16s ease, transform .16s ease, background .16s ease; }
      .dof-card-hover:hover { border-color: #4b473d; transform: translateY(-1px); }
      .dof-nav-btn:hover { background: rgba(255,255,255,0.045) !important; color: ${C.txt} !important; }
      .dof-control:focus { border-color: ${C.red} !important; box-shadow: 0 0 0 3px rgba(255,48,79,.14); }
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
  );
}

// ── Supabase Storage Hook ─────────────────────────────────────────────
// Speichert Daten in Supabase → überall verfügbar, immer aktuell
function useDB(key, init) {
  const [val, setVal]   = useState(init);
  const [ready, setRdy] = useState(false);

  // Daten beim Start laden
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/data?key=${encodeURIComponent(key)}`);
        if (res.status === 401) {
          localStorage.removeItem("dof_auth");
          window.dispatchEvent(new Event("dof_auth_expired"));
          setRdy(true);
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (data.value !== null && data.value !== undefined) setVal(data.value);
      } catch (e) {
        console.warn("Data load error:", e);
      }
      setRdy(true);
    })();
  }, [key]);

  // Speichern (optimistic: State sofort, DB asynchron)
  const save = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      fetch("/api/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: next }),
      }).then(res => {
        if (!res.ok) console.warn("Data save error:", res.status);
      }).catch(e => console.warn("Data save error:", e));
      return next;
    });
  }, [key]);

  return [val, save, ready];
}

// ── Helpers ───────────────────────────────────────────────────────────
const fmt = n => `${parseFloat(n || 0).toFixed(2).replace(".", ",")} €`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const tod = () => new Date().toISOString().slice(0, 10);
const MON = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];


// ── Mobile Detection ──────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

const INIT_PRODUCTS = [
  { id:"p1", name:"DOF Performance Training T-Shirt", category:"Trainings-T-Shirt", color:"Schwarz", material:"Polyester", sizes:{S:0,M:0,L:0,XL:0,XXL:0}, buyPrice:8.5, sellPrice:29.99, status:"planned" },
  { id:"p2", name:"DOF Oversized T-Shirt", category:"Oversized T-Shirt", color:"Schwarz", material:"100% Baumwolle", sizes:{S:0,M:0,L:0,XL:0,XXL:0}, buyPrice:9.0, sellPrice:34.99, status:"planned" }
];

// ── PDF / Druck ───────────────────────────────────────────────────────
// Schreibt HTML in den #dof-print-overlay außerhalb von React
// @media print zeigt nur diesen Container an
function printReport({ sales, expenses, mo, yr }) {
  const ms = sales.filter(s => { const d=new Date(s.date); return d.getMonth()===mo && d.getFullYear()===yr && s.status!=="cancelled"; });
  const me = expenses.filter(e => { const d=new Date(e.date); return d.getMonth()===mo && d.getFullYear()===yr; });
  const rev   = ms.reduce((a,s)=>a+s.total,0);
  const gP    = ms.reduce((a,s)=>a+s.profit,0);
  const totE  = me.reduce((a,e)=>a+e.amount,0);
  const net   = gP - totE;

  const overlay = document.getElementById("dof-print-overlay");
  overlay.innerHTML = `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:3px;margin-bottom:2px">DOF – DISCIPLINE OVER FEELINGS</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;color:#666;margin-bottom:24px;letter-spacing:2px">MONATSBERICHT ${MON[mo].toUpperCase()} ${yr} · DOFCLOUDS.DE</div>
    <div class="kpi-grid">
      <div class="kpi-box"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Umsatz</div><div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700">${fmt(rev)}</div></div>
      <div class="kpi-box"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Rohgewinn</div><div class="profit" style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700">${fmt(gP)}</div></div>
      <div class="kpi-box"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Ausgaben</div><div class="loss" style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700">${fmt(totE)}</div></div>
      <div class="kpi-box"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Nettogewinn</div><div class="${net>=0?"profit":"loss"}" style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700">${fmt(net)}</div></div>
    </div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#666;border-bottom:2px solid #111;padding-bottom:5px;margin-bottom:10px">Verkäufe (${ms.length})</div>
    <table>
      <thead><tr><th>Datum</th><th>Produkt</th><th>Gr.</th><th>Menge</th><th>Betrag</th><th>Gewinn</th><th>Zahlung</th><th>Kunde</th></tr></thead>
      <tbody>${ms.map(s=>`<tr><td>${s.date}</td><td>${s.productName.split(" ").slice(0,4).join(" ")}</td><td>${s.size}</td><td>${s.quantity}</td><td>${fmt(s.total)}</td><td class="profit">${fmt(s.profit)}</td><td>${s.payment}</td><td>${s.customerName||"–"}</td></tr>`).join("")}
      ${ms.length===0?`<tr><td colspan="8" style="text-align:center;color:#999;padding:14px">Keine Verkäufe</td></tr>`:""}</tbody>
    </table>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#666;border-bottom:2px solid #111;padding-bottom:5px;margin-bottom:10px">Ausgaben (${me.length})</div>
    <table>
      <thead><tr><th>Datum</th><th>Kategorie</th><th>Betrag</th><th>Notiz</th></tr></thead>
      <tbody>${me.map(e=>`<tr><td>${e.date}</td><td>${e.category}</td><td class="loss">${fmt(e.amount)}</td><td>${e.note||"–"}</td></tr>`).join("")}
      ${me.length===0?`<tr><td colspan="4" style="text-align:center;color:#999;padding:14px">Keine Ausgaben</td></tr>`:""}</tbody>
    </table>
    <div style="margin-top:30px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px">Erstellt am ${new Date().toLocaleDateString("de-DE")} · DOFClothes Business Dashboard · dofclothes.de</div>
  `;
  overlay.style.display = "block";
  window.print();
  // Nach dem Drucken wieder verstecken
  setTimeout(() => { overlay.style.display = "none"; overlay.innerHTML = ""; }, 1000);
}

// ── Primitive Komponenten ─────────────────────────────────────────────
const Card = ({ children, style, id }) => {
  const isMobile = useIsMobile();
  return <div id={id} className="dof-card-hover" style={{
    background:`linear-gradient(180deg, ${C.card}, #0c0c0b)`,
    border:`1px solid ${C.bdr}`,
    borderRadius:8,
    padding:isMobile?"14px 14px":"18px 20px",
    boxShadow:"0 16px 42px rgba(0,0,0,.24)",
    ...style
  }}>{children}</div>;
};

const Btn = ({ children, onClick, variant="primary", style, sm, disabled }) => {
  const V = {
    primary:{ background:`linear-gradient(180deg, ${C.red}, #b90d27)`, color:"#fff", border:"1px solid #ff5a70" },
    ghost:  { background:"#11100e", color:C.txt, border:`1px solid ${C.line}` },
    danger: { background:"#21070d", color:"#ff6b81", border:"1px solid #4d1220" },
    success:{ background:"#071a0d", color:C.grn, border:"1px solid #17472a" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...V[variant], borderRadius:6, padding:sm?"6px 11px":"9px 15px",
      fontFamily:"Barlow", fontWeight:700, fontSize:sm?12:13,
      display:"flex", alignItems:"center", gap:6, opacity:disabled?.5:1,
      cursor:disabled?"default":"pointer", minHeight:sm?30:36, whiteSpace:"nowrap",
      boxShadow:variant==="primary"?"0 10px 22px rgba(255,48,79,.18)":"none",
      ...style
    }}>
      {children}
    </button>
  );
};

const Fld = ({ label, value, onChange, type="text", options, placeholder, style }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4, ...style }}>
    {label && <label style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1px" }}>{label}</label>}
    {options
      ? <select className="dof-control" value={value} onChange={e=>onChange(e.target.value)} style={{ background:C.card2, border:`1px solid ${C.line}`, color:C.txt, borderRadius:6, padding:"9px 10px", fontFamily:"Barlow", fontSize:13, minHeight:38 }}>
          {options.map(o=><option key={typeof o==="object"?o.value:o} value={typeof o==="object"?o.value:o}>{typeof o==="object"?o.label:o}</option>)}
        </select>
      : <input className="dof-control" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{ background:C.card2, border:`1px solid ${C.line}`, color:C.txt, borderRadius:6, padding:"9px 10px", fontFamily:"Barlow", fontSize:13, minHeight:38 }}/>
    }
  </div>
);

const Badge = ({ children, color=C.muted }) => (
  <span style={{ background:color+"18", color, border:`1px solid ${color}55`, borderRadius:4, padding:"3px 7px", fontSize:10, fontFamily:"Barlow Condensed", fontWeight:700, letterSpacing:"0.6px", whiteSpace:"nowrap" }}>
    {children}
  </span>
);

const Modal = ({ title, onClose, children, width=560 }) => {
  const isMobile = useIsMobile();
  return (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(8px)", display:"flex", alignItems:isMobile?"flex-start":"center", justifyContent:"center", zIndex:999, padding:isMobile?"10px":"0", paddingTop:isMobile?"calc(env(safe-area-inset-top, 0px) + 10px)":"0" }}>
    <div style={{ background:`linear-gradient(180deg, #12110f, ${C.panel})`, border:`1px solid ${C.line}`, borderRadius:8, width:isMobile?"100%":width, maxWidth:isMobile?"100%":"96vw", maxHeight:isMobile?"calc(100vh - 20px)":"90vh", overflowY:"auto", boxShadow:"0 26px 80px rgba(0,0,0,.55)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"15px 18px", borderBottom:`1px solid ${C.line}` }}>
        <h3 style={{ fontFamily:"Barlow Condensed", fontSize:18, fontWeight:700, color:C.txt, textTransform:"uppercase", letterSpacing:"0.7px" }}>{title}</h3>
        <button onClick={onClose} style={{ color:C.muted, cursor:"pointer" }}><X size={17}/></button>
      </div>
      <div style={{ padding:isMobile?"14px":"18px" }}>{children}</div>
    </div>
  </div>
  );
};

const SH = ({ children }) => (
  <div style={{ fontFamily:"Barlow Condensed", fontSize:11, fontWeight:700, color:C.txt, textTransform:"uppercase", letterSpacing:"1.4px", marginBottom:12, paddingBottom:9, borderBottom:`1px solid ${C.line}`, display:"flex", alignItems:"center", gap:8 }}>
    <span style={{width:6,height:6,background:C.red,borderRadius:2,display:"inline-block"}}/>
    {children}
  </div>
);

const Stat = ({ label, value, Icon, color=C.red, sub }) => (
  <Card style={{position:"relative",overflow:"hidden",minHeight:118}}>
    <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:color}}/>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12, gap:10 }}>
      <span style={{ fontFamily:"Barlow Condensed", fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1px" }}>{label}</span>
      <div style={{ background:color+"18", border:`1px solid ${color}3d`, borderRadius:6, padding:6, flexShrink:0 }}><Icon size={15} color={color}/></div>
    </div>
    <div style={{ fontFamily:"Barlow Condensed", fontSize:28, fontWeight:700, color:C.txt, lineHeight:1, wordBreak:"break-word" }}>{value}</div>
    {sub && <div style={{ fontFamily:"Barlow", fontSize:11, color:C.muted, marginTop:7 }}>{sub}</div>}
  </Card>
);

const TP = { active:C.grn, sold_out:C.red, planned:C.ylw };
const TL = { active:"Aktiv", sold_out:"Ausverkauft", planned:"Geplant" };

function ConfirmModal({ text, onYes, onNo }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100 }}>
      <div style={{ background:C.panel, border:`1px solid ${C.bdr}`, borderRadius:10, padding:"22px 24px", width:340 }}>
        <p style={{ fontFamily:"Barlow", fontSize:14, color:C.txt, marginBottom:20 }}>{text}</p>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <Btn variant="ghost" onClick={onNo}>Abbrechen</Btn>
          <Btn variant="danger" onClick={onYes}><Trash2 size={13}/> Löschen</Btn>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (text, onYes) => setState({ text, onYes });
  const node = state ? (
    <ConfirmModal text={state.text} onYes={() => { state.onYes(); setState(null); }} onNo={() => setState(null)}/>
  ) : null;
  return [ask, node];
}

// ════════════════════════════════════════════════════════════════════
// VIEWS
// ════════════════════════════════════════════════════════════════════

function DashView({ products, sales, expenses, settings }) {
  const isMobile = useIsMobile();
  const now   = new Date();
  const valid = sales.filter(s => s.status !== "cancelled");
  const rev   = valid.reduce((a,s) => a+s.total, 0);
  const prof  = valid.reduce((a,s) => a+s.profit, 0);
  const mSal  = valid.filter(s => { const d=new Date(s.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
  const mRev  = mSal.reduce((a,s) => a+s.total, 0);
  const dRev  = valid.filter(s => s.date===tod()).reduce((a,s) => a+s.total, 0);
  const stock = products.reduce((a,p) => a+Object.values(p.sizes).reduce((x,y)=>x+y,0), 0);
  const low   = products.filter(p => { const t=Object.values(p.sizes).reduce((a,b)=>a+b,0); return t>0&&t<=settings.lowStockThreshold; });
  const pRev  = {}; valid.forEach(s => { pRev[s.productName]=(pRev[s.productName]||0)+s.total; });
  const top   = Object.entries(pRev).sort((a,b)=>b[1]-a[1])[0];
  const chart = Array.from({length:6},(_,i)=>{
    const d  = new Date(now.getFullYear(),now.getMonth()-5+i,1);
    const ms = valid.filter(s=>{const sd=new Date(s.date);return sd.getMonth()===d.getMonth()&&sd.getFullYear()===d.getFullYear();});
    return{name:MON[d.getMonth()],Umsatz:+ms.reduce((a,s)=>a+s.total,0).toFixed(2),Gewinn:+ms.reduce((a,s)=>a+s.profit,0).toFixed(2)};
  });
  const recent = [...sales].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  return (
    <div>
      <div style={{
        marginBottom:18,
        border:`1px solid ${C.line}`,
        borderRadius:8,
        padding:isMobile?"16px":"22px 24px",
        background:"linear-gradient(135deg, #151411 0%, #0b0b0a 58%, #19070c 100%)",
        boxShadow:"0 20px 60px rgba(0,0,0,.28)",
        display:"grid",
        gridTemplateColumns:isMobile?"1fr":"1.3fr .7fr",
        gap:16,
        alignItems:"end"
      }}>
        <div>
          <div style={{fontFamily:"Barlow Condensed",fontSize:11,fontWeight:700,color:C.red,letterSpacing:"2px",textTransform:"uppercase",marginBottom:8}}>Discipline over feelings</div>
          <h2 style={{fontFamily:"Bebas Neue",fontSize:isMobile?36:48,color:C.txt,letterSpacing:"3px",lineHeight:.95}}>DOF CONTROL</h2>
          <p style={{fontFamily:"Barlow",fontSize:13,color:C.muted,marginTop:8,maxWidth:560,lineHeight:1.55}}>Bestand, Umsatz, Versand und Aufgaben auf einen Blick. Keine Spielerei, nur die Zahlen und Aktionen, die gerade wichtig sind.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{border:`1px solid ${C.bdr}`,borderRadius:6,padding:"10px 12px",background:"rgba(255,255,255,.035)"}}>
            <div style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Heute</div>
            <div style={{fontFamily:"Barlow Condensed",fontSize:24,fontWeight:700,color:C.grn,lineHeight:1.1}}>{fmt(dRev)}</div>
          </div>
          <div style={{border:`1px solid ${C.bdr}`,borderRadius:6,padding:"10px 12px",background:"rgba(255,255,255,.035)"}}>
            <div style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Lager</div>
            <div style={{fontFamily:"Barlow Condensed",fontSize:24,fontWeight:700,color:C.txt,lineHeight:1.1}}>{stock} Stk</div>
          </div>
        </div>
      </div>
      {low.length>0&&<div style={{background:"#201803",border:`1px solid ${C.ylw}55`,borderRadius:7,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
        <AlertTriangle size={14} color={C.ylw}/>
        <span style={{fontFamily:"Barlow",fontSize:12,color:C.ylw}}>{low.length} Produkt{low.length>1?"e":""} mit niedrigem Bestand: {low.map(p=>p.name.split(" ").slice(0,3).join(" ")).join(", ")}</span>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:10,marginBottom:16}}>
        <Stat label="Gesamtumsatz"    value={fmt(rev)}         Icon={TrendingUp} color={C.grn}/>
        <Stat label="Monatsumsatz"    value={fmt(mRev)}        Icon={DollarSign} color={C.blu}/>
        <Stat label="Tagesumsatz"     value={fmt(dRev)}        Icon={Receipt}    color={C.red}/>
        <Stat label="Lagerbestand"    value={`${stock} Stk`}   Icon={Archive}    color={C.ylw} sub={`${products.length} Produkte`}/>
        <Stat label="Gewinnschätzung" value={fmt(prof)}        Icon={TrendingUp} color={C.grn} sub="aus Verkäufen"/>
        <Stat label="Top-Produkt"     value={top?top[0].split(" ").slice(0,3).join(" "):"–"} Icon={Package} color={C.red} sub={top?fmt(top[1]):""}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"3fr 2fr",gap:14}}>
        <Card>
          <SH>Umsatz & Gewinn — letzte 6 Monate</SH>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bdr}/>
              <XAxis dataKey="name" tick={{fill:C.muted,fontSize:10,fontFamily:"Barlow"}}/>
              <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"Barlow"}}/>
              <Tooltip contentStyle={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:5,fontFamily:"Barlow",fontSize:12}}/>
              <Legend wrapperStyle={{fontFamily:"Barlow",fontSize:11}}/>
              <Line type="monotone" dataKey="Umsatz" stroke={C.blu} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="Gewinn" stroke={C.grn} strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SH>Letzte Verkäufe</SH>
          {recent.length===0?<div style={{color:C.muted,fontFamily:"Barlow",fontSize:12,textAlign:"center",padding:"28px 0"}}>Noch keine Verkäufe</div>
          :<div>{recent.map(s=>(
            <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.bdr}`}}>
              <div>
                <div style={{fontFamily:"Barlow",fontSize:12,color:C.txt}}>{s.productName.split(" ").slice(0,3).join(" ")} ({s.size})</div>
                <div style={{fontFamily:"Barlow",fontSize:10,color:C.muted}}>{s.date} · {s.customerName||"Anonym"}</div>
              </div>
              <div style={{fontFamily:"Barlow Condensed",fontSize:14,fontWeight:700,color:C.grn}}>{fmt(s.total)}</div>
            </div>
          ))}</div>}
        </Card>
      </div>
    </div>
  );
}

function ProdView({ products, setProducts }) {
  const isMobile = useIsMobile();
  const [modal,setModal]=useState(null);const [eid,setEid]=useState(null);
  const [ask,confirmNode]=useConfirm();
  const E={name:"",category:"",color:"",material:"",sizes:{S:0,M:0,L:0,XL:0,XXL:0},buyPrice:"",sellPrice:"",status:"planned"};
  const [f,setF]=useState(E);
  const openAdd=()=>{setF(E);setModal("add");};
  const openEdit=p=>{setF({...p,buyPrice:String(p.buyPrice),sellPrice:String(p.sellPrice)});setEid(p.id);setModal("edit");};
  const save=()=>{const item={...f,buyPrice:parseFloat(f.buyPrice)||0,sellPrice:parseFloat(f.sellPrice)||0};if(modal==="add")setProducts(p=>[...p,{...item,id:uid()}]);else setProducts(p=>p.map(x=>x.id===eid?{...item,id:x.id}:x));setModal(null);};
  const del=id=>ask("Produkt wirklich löschen?",()=>setProducts(p=>p.filter(x=>x.id!==id)));
  return (
    <div>
      {confirmNode}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>PRODUKTE</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>{products.length} Produkte</p></div>
        <Btn onClick={openAdd}><Plus size={13}/> Neu</Btn>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {products.map(p=>{const ts=Object.values(p.sizes).reduce((a,b)=>a+b,0);return(
          <Card key={p.id} style={{display:"flex",alignItems:"center",gap:14,flexWrap:isMobile?"wrap":"nowrap"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,color:C.txt}}>{p.name}</span><Badge color={TP[p.status]}>{TL[p.status]}</Badge></div>
              <div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginBottom:7}}>{p.category} · {p.color} · {p.material}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{Object.entries(p.sizes).map(([sz,qty])=><span key={sz} style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:4,padding:"2px 7px",fontFamily:"Barlow Condensed",fontSize:10,color:qty===0?C.dim:C.txt}}>{sz}: {qty}</span>)}</div>
            </div>
            <div style={{textAlign:isMobile?"left":"right",minWidth:isMobile?110:130}}>
              <div style={{fontFamily:"Barlow Condensed",fontSize:12,color:C.muted}}>EK: {fmt(p.buyPrice)}</div>
              <div style={{fontFamily:"Barlow Condensed",fontSize:17,fontWeight:700,color:C.txt}}>{fmt(p.sellPrice)}</div>
              <div style={{fontFamily:"Barlow Condensed",fontSize:12,color:C.grn}}>+{fmt(p.sellPrice-p.buyPrice)}</div>
              <div style={{fontFamily:"Barlow",fontSize:10,color:C.muted,marginTop:3}}>Lager: {ts} Stk</div>
            </div>
            <div style={{display:"flex",gap:5}}>
              <Btn variant="ghost" sm onClick={()=>openEdit(p)}><Edit2 size={12}/></Btn>
              <Btn variant="danger" sm onClick={()=>del(p.id)}><Trash2 size={12}/></Btn>
            </div>
          </Card>
        );})}
        {products.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>Noch keine Produkte.</div>}
      </div>
      {modal&&<Modal title={modal==="add"?"Neues Produkt":"Produkt bearbeiten"} onClose={()=>setModal(null)} width={620}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
          <Fld label="Name" value={f.name} onChange={v=>setF(x=>({...x,name:v}))} style={{gridColumn:"1/-1"}}/>
          <Fld label="Kategorie" value={f.category} onChange={v=>setF(x=>({...x,category:v}))}/>
          <Fld label="Farbe" value={f.color} onChange={v=>setF(x=>({...x,color:v}))}/>
          <Fld label="Material" value={f.material} onChange={v=>setF(x=>({...x,material:v}))} style={{gridColumn:"1/-1"}}/>
          <Fld label="EK-Preis (€)" type="number" value={f.buyPrice} onChange={v=>setF(x=>({...x,buyPrice:v}))} placeholder="0.00"/>
          <Fld label="VK-Preis (€)" type="number" value={f.sellPrice} onChange={v=>setF(x=>({...x,sellPrice:v}))} placeholder="0.00"/>
          <Fld label="Status" value={f.status} onChange={v=>setF(x=>({...x,status:v}))} options={[{value:"planned",label:"Geplant"},{value:"active",label:"Aktiv"},{value:"sold_out",label:"Ausverkauft"}]} style={{gridColumn:"1/-1"}}/>
        </div>
        <div style={{marginTop:14,marginBottom:6}}>
          <div style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>Bestand pro Größe</div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(5,1fr)",gap:8}}>{["S","M","L","XL","XXL"].map(sz=><Fld key={sz} label={sz} type="number" value={f.sizes[sz]} onChange={v=>setF(x=>({...x,sizes:{...x.sizes,[sz]:parseInt(v)||0}}))}/>)}</div>
        </div>
        {f.buyPrice&&f.sellPrice&&<div style={{background:C.card2,borderRadius:6,padding:"9px 12px",marginBottom:14,fontFamily:"Barlow Condensed",fontSize:13,color:C.grn}}>Gewinn: {fmt(parseFloat(f.sellPrice)-parseFloat(f.buyPrice))} / Stück ({((parseFloat(f.sellPrice)-parseFloat(f.buyPrice))/parseFloat(f.sellPrice)*100).toFixed(1)}%)</div>}
        <div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}>
          <Btn variant="ghost" onClick={()=>setModal(null)}>Abbrechen</Btn>
          <Btn onClick={save}><Check size={13}/> Speichern</Btn>
        </div>
      </Modal>}
    </div>
  );
}

function LagerView({ products, setProducts, settings }) {
  const [rm,setRm]=useState(null);const [rf,setRf]=useState({S:0,M:0,L:0,XL:0,XXL:0});
  const doRestock=()=>{setProducts(prev=>prev.map(p=>{if(p.id!==rm.id)return p;const ns={...p.sizes};Object.keys(rf).forEach(sz=>{ns[sz]=(ns[sz]||0)+(parseInt(rf[sz])||0);});const ts=Object.values(ns).reduce((a,b)=>a+b,0);return{...p,sizes:ns,status:ts>0?"active":p.status};}));setRm(null);};
  return (
    <div>
      <div style={{marginBottom:22}}><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>LAGER</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>Niedrigbestand-Warnung bei ≤ {settings.lowStockThreshold} Stück</p></div>
      {products.map(p=>{const ts=Object.values(p.sizes).reduce((a,b)=>a+b,0);const low=ts>0&&ts<=settings.lowStockThreshold;return(
        <Card key={p.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,color:C.txt}}>{p.name}</span>{low&&<Badge color={C.ylw}>Niedrig</Badge>}{ts===0&&<Badge color={C.red}>Ausverkauft</Badge>}</div>
              <div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginTop:2}}>{p.category} · {p.color}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{textAlign:"right"}}><div style={{fontFamily:"Barlow Condensed",fontSize:22,fontWeight:700,color:low?C.ylw:C.txt}}>{ts}</div><div style={{fontFamily:"Barlow",fontSize:9,color:C.muted}}>Gesamt</div></div>
              <Btn variant="ghost" sm onClick={()=>{setRm(p);setRf({S:0,M:0,L:0,XL:0,XXL:0});}}><Plus size={12}/> Nachbestellen</Btn>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
            {["S","M","L","XL","XXL"].map(sz=>{const q=p.sizes[sz]||0;const lo=q>0&&q<=settings.lowStockThreshold;return(
              <div key={sz} style={{background:C.card2,borderRadius:6,padding:"9px",textAlign:"center",border:`1px solid ${lo?C.ylw+"55":C.bdr}`}}>
                <div style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,marginBottom:3}}>{sz}</div>
                <div style={{fontFamily:"Barlow Condensed",fontSize:20,fontWeight:700,color:q===0?C.dim:lo?C.ylw:C.txt}}>{q}</div>
              </div>
            );})}
          </div>
        </Card>
      );})}
      {products.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>Keine Produkte vorhanden.</div>}
      {rm&&<Modal title={`Nachbestellen: ${rm.name.split(" ").slice(0,4).join(" ")}`} onClose={()=>setRm(null)}>
        <div style={{marginBottom:10,fontFamily:"Barlow",fontSize:12,color:C.muted}}>Anzahl hinzufügen pro Größe:</div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>{["S","M","L","XL","XXL"].map(sz=><Fld key={sz} label={sz} type="number" value={rf[sz]} onChange={v=>setRf(x=>({...x,[sz]:parseInt(v)||0}))} style={{flex:1}}/>)}</div>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setRm(null)}>Abbrechen</Btn><Btn onClick={doRestock}><Check size={13}/> Einbuchen</Btn></div>
      </Modal>}
    </div>
  );
}

function SaleView({ products, setProducts, sales, setSales, customers, setCustomers }) {
  const isMobile = useIsMobile();
  const [f,setF]=useState({productId:"",size:"",quantity:"1",price:"",payment:"bar",customerName:""});
  const [ok,setOk]=useState(false);
  const sp=products.find(p=>p.id===f.productId)||null;
  const avSizes=sp?Object.entries(sp.sizes).filter(([,q])=>q>0).map(([s])=>s):[];
  const handleProduct=pid=>{const found=products.find(p=>p.id===pid);setF(x=>({...x,productId:pid,size:"",price:found?String(found.sellPrice):""}));};
  const can=f.productId&&f.size&&parseInt(f.quantity)>0&&parseFloat(f.price)>0;
  const submit=()=>{
    if(!can||!sp)return;
    const q=parseInt(f.quantity),p=parseFloat(f.price);
    const sale={id:uid(),productId:sp.id,productName:sp.name,size:f.size,quantity:q,price:p,total:q*p,profit:q*(p-sp.buyPrice),payment:f.payment,customerName:f.customerName.trim(),date:tod(),status:"paid",fulfillmentStatus:"open",trackingNumber:"",customerNote:""};
    setSales(prev=>[sale,...prev]);
    setProducts(prev=>prev.map(pr=>{if(pr.id!==sp.id)return pr;const ns={...pr.sizes,[f.size]:Math.max(0,(pr.sizes[f.size]||0)-q)};const ts=Object.values(ns).reduce((a,b)=>a+b,0);return{...pr,sizes:ns,status:ts===0?"sold_out":pr.status==="planned"?"active":pr.status};}));
    if(f.customerName.trim())setCustomers(prev=>{const ex=prev.find(c=>c.name.toLowerCase()===f.customerName.trim().toLowerCase());if(ex)return prev;return[...prev,{id:uid(),name:f.customerName.trim(),email:"",phone:"",notes:"",createdAt:tod()}];});
    setF({productId:"",size:"",quantity:"1",price:"",payment:"bar",customerName:""});
    setOk(true);setTimeout(()=>setOk(false),3000);
  };
  return (
    <div>
      <div style={{marginBottom:22}}><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>VERKAUF EINTRAGEN</h2></div>
      {ok&&<div style={{background:"#081a0e",border:`1px solid ${C.grn}44`,borderRadius:7,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}><Check size={14} color={C.grn}/><span style={{fontFamily:"Barlow",fontSize:12,color:C.grn}}>Verkauf gespeichert! Lagerbestand wurde aktualisiert.</span></div>}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,maxWidth:660}}>
        <Fld label="Produkt" value={f.productId} onChange={handleProduct} options={[{value:"",label:"– Produkt wählen –"},...products.map(p=>({value:p.id,label:p.name.length>38?p.name.slice(0,38)+"…":p.name}))]} style={{gridColumn:"1/-1"}}/>
        {sp&&<div style={{gridColumn:"1/-1",background:C.card2,borderRadius:6,padding:"9px 12px",display:"flex",gap:18,fontFamily:"Barlow Condensed",fontSize:13}}><span style={{color:C.muted}}>VK: <span style={{color:C.txt}}>{fmt(sp.sellPrice)}</span></span><span style={{color:C.muted}}>EK: <span style={{color:C.txt}}>{fmt(sp.buyPrice)}</span></span><span style={{color:C.muted}}>Gewinn/Stk: <span style={{color:C.grn}}>{fmt(sp.sellPrice-sp.buyPrice)}</span></span></div>}
        <Fld label="Größe" value={f.size} onChange={v=>setF(x=>({...x,size:v}))} options={[{value:"",label:"– Größe –"},...avSizes.map(s=>({value:s,label:`${s} (${sp?.sizes[s]} verfügbar)`}))]}/>
        <Fld label="Menge" type="number" value={f.quantity} onChange={v=>setF(x=>({...x,quantity:v}))}/>
        <Fld label="Verkaufspreis (€)" type="number" value={f.price} onChange={v=>setF(x=>({...x,price:v}))} placeholder="0.00"/>
        <Fld label="Zahlungsart" value={f.payment} onChange={v=>setF(x=>({...x,payment:v}))} options={[{value:"bar",label:"Bar"},{value:"paypal",label:"PayPal"},{value:"ueberweisung",label:"Überweisung"},{value:"klarna",label:"Klarna"},{value:"kreditkarte",label:"Kreditkarte"}]}/>
        <Fld label="Kundenname (optional)" value={f.customerName} onChange={v=>setF(x=>({...x,customerName:v}))} placeholder="Max Mustermann" style={{gridColumn:"1/-1"}}/>
        {f.price&&f.quantity&&<div style={{gridColumn:"1/-1",background:C.card2,borderRadius:7,padding:"12px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>Gesamtbetrag</span><span style={{fontFamily:"Barlow Condensed",fontSize:20,fontWeight:700,color:C.txt}}>{fmt((parseFloat(f.price)||0)*(parseInt(f.quantity)||0))}</span></div>
          {sp&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>Gewinn</span><span style={{fontFamily:"Barlow Condensed",fontSize:14,fontWeight:600,color:C.grn}}>{fmt((parseFloat(f.price)-sp.buyPrice)*(parseInt(f.quantity)||0))}</span></div>}
        </div>}
        <Btn onClick={submit} disabled={!can} style={{gridColumn:"1/-1"}}><Check size={13}/> Verkauf eintragen</Btn>
      </div>
    </div>
  );
}

function OrdersView({ sales, setSales }) {
  const [filter,setFilter]=useState("all");const [search,setSearch]=useState("");
  const [ask,confirmNode]=useConfirm();
  const SC={paid:C.grn,open:C.ylw,cancelled:C.red};const SL={paid:"Bezahlt",open:"Offen",cancelled:"Storniert"};
  const filtered=sales.filter(s=>filter==="all"||s.status===filter).filter(s=>!search||s.productName.toLowerCase().includes(search.toLowerCase())||(s.customerName||"").toLowerCase().includes(search.toLowerCase()));
  const del=id=>ask("Bestellung wirklich löschen?",()=>setSales(p=>p.filter(s=>s.id!==id)));
  const setSt=(id,st)=>setSales(p=>p.map(s=>s.id===id?{...s,status:st}:s));
  return (
    <div>
      {confirmNode}
      <div style={{marginBottom:22}}><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>BESTELLVERLAUF</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>{sales.length} Bestellungen</p></div>
      <div style={{display:"flex",gap:9,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:180}}><Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen…" style={{background:C.card,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"7px 10px 7px 29px",fontFamily:"Barlow",fontSize:12,width:"100%"}}/></div>
        {["all","paid","open","cancelled"].map(fv=><Btn key={fv} variant={filter===fv?"primary":"ghost"} sm onClick={()=>setFilter(fv)}>{fv==="all"?"Alle":SL[fv]}</Btn>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {filtered.length===0?<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>Keine Bestellungen gefunden</div>
        :filtered.map(s=>(
          <Card key={s.id} style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}><span style={{fontFamily:"Barlow Condensed",fontSize:14,fontWeight:700,color:C.txt}}>{s.productName.split(" ").slice(0,4).join(" ")} · Gr. {s.size}</span><Badge color={SC[s.status]}>{SL[s.status]}</Badge>{s.source==="shopify"&&<Badge color="#95bf47">Shopify ✓</Badge>}</div>
              <div style={{fontFamily:"Barlow",fontSize:11,color:C.muted}}>{s.date} · {s.quantity}x · {s.payment} · {s.customerName||"Anonym"}</div>
            </div>
            <div style={{textAlign:"right",minWidth:110}}><div style={{fontFamily:"Barlow Condensed",fontSize:17,fontWeight:700,color:C.txt}}>{fmt(s.total)}</div><div style={{fontFamily:"Barlow Condensed",fontSize:11,color:C.grn}}>+{fmt(s.profit)}</div></div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <select value={s.status} onChange={e=>setSt(s.id,e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"5px 7px",fontFamily:"Barlow",fontSize:11,cursor:"pointer"}}>
                <option value="paid">Bezahlt</option><option value="open">Offen</option><option value="cancelled">Storniert</option>
              </select>
              <Btn variant="danger" sm onClick={()=>del(s.id)}><Trash2 size={11}/></Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ShippingView({ sales, setSales }) {
  const isMobile=useIsMobile();
  const [filter,setFilter]=useState("open");const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null);const [edit,setEdit]=useState({key:"",trackingNumber:"",customerNote:""});
  const FS={open:{label:"Offen",color:C.ylw},packed:{label:"Gepackt",color:C.blu},shipped:{label:"Versendet",color:C.grn}};
  const valid=sales.filter(s=>s.status!=="cancelled");
  const groups=Object.values(valid.reduce((acc,s)=>{
    const key=s.source==="shopify"&&s.shopifyOrderNumber?`shopify_${s.shopifyOrderNumber}`:s.id;
    if(!acc[key]) acc[key]={key,ids:[],items:[],date:s.date,customerName:s.customerName||"Anonym",payment:s.payment,total:0,profit:0,source:s.source,shopifyOrderNumber:s.shopifyOrderNumber,fulfillmentStatus:s.fulfillmentStatus||"open",trackingNumber:s.trackingNumber||"",customerNote:s.customerNote||""};
    acc[key].ids.push(s.id);acc[key].items.push(s);acc[key].total+=s.total||0;acc[key].profit+=s.profit||0;
    if((s.fulfillmentStatus||"open")==="shipped") acc[key].fulfillmentStatus="shipped";
    else if((s.fulfillmentStatus||"open")==="packed"&&acc[key].fulfillmentStatus!=="shipped") acc[key].fulfillmentStatus="packed";
    if(s.trackingNumber) acc[key].trackingNumber=s.trackingNumber;
    if(s.customerNote) acc[key].customerNote=s.customerNote;
    return acc;
  },{})).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered=groups.filter(g=>(filter==="all"||g.fulfillmentStatus===filter)&&(!search||[g.customerName,g.shopifyOrderNumber,g.trackingNumber,...g.items.map(i=>i.productName)].join(" ").toLowerCase().includes(search.toLowerCase())));
  const count=st=>groups.filter(g=>g.fulfillmentStatus===st).length;
  const updateGroup=(g, patch)=>setSales(prev=>prev.map(s=>g.ids.includes(s.id)?{...s,...patch}:s));
  const pack=g=>updateGroup(g,{fulfillmentStatus:"packed",packedAt:tod(),updatedAt:new Date().toISOString()});
  const reopen=g=>updateGroup(g,{fulfillmentStatus:"open",shippedAt:"",updatedAt:new Date().toISOString()});
  const ship=g=>{setEdit({key:g.key,trackingNumber:g.trackingNumber||"",customerNote:g.customerNote||""});setModal(g);};
  const saveShip=()=>{const g=modal;updateGroup(g,{fulfillmentStatus:"shipped",trackingNumber:edit.trackingNumber.trim(),customerNote:edit.customerNote.trim(),shippedAt:tod(),updatedAt:new Date().toISOString()});setModal(null);};
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:22}}>
        <div><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>VERSAND</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>Packliste, Status, Tracking und Kundennotizen</p></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <Stat label="Offen" value={count("open")} Icon={Package} color={C.ylw}/>
        <Stat label="Gepackt" value={count("packed")} Icon={Archive} color={C.blu}/>
        <Stat label="Versendet" value={count("shipped")} Icon={Truck} color={C.grn}/>
        <Stat label="Bestellungen" value={groups.length} Icon={Receipt} color={C.red}/>
      </div>
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:isMobile?220:260}}><Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Kunde, Bestellung, Produkt oder Tracking suchen..." style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px 8px 29px",fontFamily:"Barlow",fontSize:12,width:"100%"}}/></div>
          {["all","open","packed","shipped"].map(x=><Btn key={x} variant={filter===x?"primary":"ghost"} sm onClick={()=>setFilter(x)}>{x==="all"?"Alle":FS[x].label}</Btn>)}
        </div>
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {filtered.map(g=><Card key={g.key}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.3fr 1.4fr 1fr auto",gap:14,alignItems:"center"}}>
            <div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:5}}><span style={{fontFamily:"Barlow Condensed",fontSize:17,fontWeight:700,color:C.txt}}>{g.source==="shopify"&&g.shopifyOrderNumber?`#${g.shopifyOrderNumber}`:"Manuelle Bestellung"}</span><Badge color={FS[g.fulfillmentStatus]?.color||C.muted}>{FS[g.fulfillmentStatus]?.label||"Offen"}</Badge>{g.source==="shopify"&&<Badge color="#95bf47">Shopify</Badge>}</div><div style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>{g.date} · {g.customerName} · {fmt(g.total)}</div></div>
            <div><div style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:5}}>Packliste</div>{g.items.map(i=><div key={i.id} style={{fontFamily:"Barlow",fontSize:12,color:C.txt,marginBottom:3}}>{i.quantity}x {i.productName.split(" ").slice(0,5).join(" ")} · Gr. {i.size}</div>)}</div>
            <div><div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginBottom:3}}>Tracking</div><div style={{fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,color:g.trackingNumber?C.txt:C.dim,wordBreak:"break-word"}}>{g.trackingNumber||"Noch offen"}</div>{g.customerNote&&<div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginTop:5,lineHeight:1.4}}>{g.customerNote}</div>}</div>
            <div style={{display:"flex",gap:6,justifyContent:isMobile?"flex-start":"flex-end",flexWrap:"wrap"}}>{g.fulfillmentStatus!=="open"&&<Btn variant="ghost" sm onClick={()=>reopen(g)}>Zurueck</Btn>}{g.fulfillmentStatus==="open"&&<Btn variant="ghost" sm onClick={()=>pack(g)}><Archive size={12}/> Gepackt</Btn>}<Btn variant={g.fulfillmentStatus==="shipped"?"ghost":"success"} sm onClick={()=>ship(g)}><Truck size={12}/> {g.fulfillmentStatus==="shipped"?"Bearbeiten":"Versenden"}</Btn></div>
          </div>
        </Card>)}
        {filtered.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>Keine Bestellungen im Versandfilter</div>}
      </div>
      {modal&&<Modal title="Versand abschliessen" onClose={()=>setModal(null)} width={460}><div style={{display:"grid",gap:12}}><Fld label="Trackingnummer" value={edit.trackingNumber} onChange={v=>setEdit(x=>({...x,trackingNumber:v}))} placeholder="DHL / Hermes / UPS Tracking"/><div style={{display:"flex",flexDirection:"column",gap:4}}><label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>Kundennotiz</label><textarea value={edit.customerNote} onChange={e=>setEdit(x=>({...x,customerNote:e.target.value}))} placeholder="z.B. Danke fuer deine Bestellung, Paket geht heute raus." style={{minHeight:90,background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/></div></div><div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14,flexWrap:"wrap"}}><Btn variant="ghost" onClick={()=>setModal(null)}>Abbrechen</Btn><Btn variant="success" onClick={saveShip}><Check size={13}/> Als versendet markieren</Btn></div></Modal>}
    </div>
  );
}

function AusgView({ expenses, setExpenses, invoices=[] }) {
  const isMobile = useIsMobile();
  const [show,setShow]=useState(false);
  const E={category:"Wareneinkauf",amount:"",date:tod(),note:""};const [f,setF]=useState(E);
  const CATS=["Wareneinkauf","Versandmaterial","Werbung","Shopify","Domain","Sonstiges"];
  const CC={Wareneinkauf:C.blu,Versandmaterial:C.ylw,Werbung:C.red,Shopify:"#6366f1",Domain:C.grn,Sonstiges:C.muted};
  const add=()=>{if(!f.amount)return;setExpenses(p=>[{...f,id:uid(),amount:parseFloat(f.amount)},...p]);setF(E);setShow(false);};
  const del=id=>setExpenses(p=>p.filter(e=>e.id!==id));
  const total=expenses.reduce((a,e)=>a+e.amount,0);
  const [viewImg,setViewImg]=useState(null);
  const getInvoice=id=>invoices.find(i=>i.id===id);
  return (
    <div>
      {viewImg&&<div onClick={()=>setViewImg(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}}><div onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh"}}><button onClick={()=>setViewImg(null)} style={{position:"absolute",top:-14,right:-14,background:"#e11d48",border:"none",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={14} color="#fff"/></button><img src={viewImg.src} alt={viewImg.fileName} style={{maxWidth:"100%",maxHeight:"85vh",borderRadius:8,display:"block",objectFit:"contain"}}/><div style={{fontFamily:"Barlow",fontSize:11,color:"#888",textAlign:"center",marginTop:8}}>{viewImg.fileName}</div></div></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}><div><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>AUSGABEN</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>Gesamt: {fmt(total)}</p></div><Btn onClick={()=>setShow(s=>!s)}><Plus size={13}/> Ausgabe</Btn></div>
      {show&&<Card style={{marginBottom:14}}><SH>Neue Ausgabe</SH><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:11,marginBottom:11}}><Fld label="Kategorie" value={f.category} onChange={v=>setF(x=>({...x,category:v}))} options={CATS}/><Fld label="Betrag (€)" type="number" value={f.amount} onChange={v=>setF(x=>({...x,amount:v}))} placeholder="0.00"/><Fld label="Datum" type="date" value={f.date} onChange={v=>setF(x=>({...x,date:v}))}/><Fld label="Notiz" value={f.note} onChange={v=>setF(x=>({...x,note:v}))} placeholder="Beschreibung…" style={{gridColumn:"1/-1"}}/></div><div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}><Btn variant="ghost" sm onClick={()=>setShow(false)}>Abbrechen</Btn><Btn sm onClick={add}><Check size={12}/> Speichern</Btn></div></Card>}
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {expenses.map(e=>(
          <Card key={e.id} style={{display:"flex",alignItems:"center",gap:12}}><div style={{background:(CC[e.category]||C.muted)+"22",borderRadius:6,padding:7}}><DollarSign size={14} color={CC[e.category]||C.muted}/></div><div style={{flex:1}}><Badge color={CC[e.category]||C.muted}>{e.category}</Badge><div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginTop:3}}>{e.date}{e.note?` · ${e.note}`:""}</div></div><div style={{fontFamily:"Barlow Condensed",fontSize:17,fontWeight:700,color:C.red}}>{fmt(e.amount)}</div>{getInvoice(e.id)?.image&&<button onClick={()=>setViewImg({src:getInvoice(e.id).image,fileName:getInvoice(e.id).fileName})} style={{background:"#111",border:"1px solid #222",color:"#888",borderRadius:5,padding:"5px 8px",cursor:"pointer",display:"flex",alignItems:"center"}}><Eye size={11}/></button>}<Btn variant="danger" sm onClick={()=>del(e.id)}><Trash2 size={11}/></Btn></Card>
        ))}
        {expenses.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>Noch keine Ausgaben erfasst</div>}
      </div>
    </div>
  );
}

function StatsView({ sales, products, expenses }) {
  const isMobile = useIsMobile();
  const now=new Date();
  const TT={contentStyle:{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:5,fontFamily:"Barlow",fontSize:11}};
  const md=Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-11+i,1);const ms=sales.filter(s=>{const sd=new Date(s.date);return sd.getMonth()===d.getMonth()&&sd.getFullYear()===d.getFullYear()&&s.status!=="cancelled";});const me=expenses.filter(e=>{const ed=new Date(e.date);return ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear();});return{name:MON[d.getMonth()],Umsatz:+ms.reduce((a,s)=>a+s.total,0).toFixed(2),Gewinn:+ms.reduce((a,s)=>a+s.profit,0).toFixed(2),Ausgaben:+me.reduce((a,e)=>a+e.amount,0).toFixed(2)};});
  const bP={};sales.filter(s=>s.status!=="cancelled").forEach(s=>{const k=s.productName.split(" ").slice(0,4).join(" ");bP[k]=(bP[k]||0)+s.total;});
  const pD=Object.entries(bP).map(([n,v])=>({name:n,value:+v.toFixed(2)})).sort((a,b)=>b.value-a.value);
  const bC={};expenses.forEach(e=>{bC[e.category]=(bC[e.category]||0)+e.amount;});
  const eD=Object.entries(bC).map(([n,v])=>({name:n,value:+v.toFixed(2)}));
  const bS={S:0,M:0,L:0,XL:0,XXL:0};sales.filter(s=>s.status!=="cancelled").forEach(s=>{bS[s.size]=(bS[s.size]||0)+s.quantity;});
  const sD=Object.entries(bS).map(([n,v])=>({name:n,value:v}));
  const PC=[C.red,C.blu,C.grn,C.ylw,"#6366f1",C.muted];
  return (
    <div>
      <div style={{marginBottom:22}}><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>STATISTIKEN</h2></div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
        <Card style={{gridColumn:"1/-1"}}><SH>Umsatz, Gewinn & Ausgaben — 12 Monate</SH><ResponsiveContainer width="100%" height={220}><LineChart data={md}><CartesianGrid strokeDasharray="3 3" stroke={C.bdr}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:10,fontFamily:"Barlow"}}/><YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"Barlow"}}/><Tooltip {...TT}/><Legend wrapperStyle={{fontFamily:"Barlow",fontSize:11}}/><Line type="monotone" dataKey="Umsatz" stroke={C.blu} strokeWidth={2} dot={false}/><Line type="monotone" dataKey="Gewinn" stroke={C.grn} strokeWidth={2} dot={false}/><Line type="monotone" dataKey="Ausgaben" stroke={C.red} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></Card>
        <Card><SH>Umsatz nach Produkt</SH>{pD.length===0?<div style={{color:C.muted,fontFamily:"Barlow",fontSize:12,textAlign:"center",padding:"28px 0"}}>Keine Daten</div>:<ResponsiveContainer width="100%" height={200}><BarChart data={pD} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={C.bdr}/><XAxis type="number" tick={{fill:C.muted,fontSize:9,fontFamily:"Barlow"}}/><YAxis dataKey="name" type="category" tick={{fill:C.muted,fontSize:9,fontFamily:"Barlow"}} width={120}/><Tooltip {...TT}/><Bar dataKey="value" fill={C.blu} radius={[0,4,4,0]}/></BarChart></ResponsiveContainer>}</Card>
        <Card><SH>Ausgaben nach Kategorie</SH>{eD.length===0?<div style={{color:C.muted,fontFamily:"Barlow",fontSize:12,textAlign:"center",padding:"28px 0"}}>Keine Daten</div>:<ResponsiveContainer width="100%" height={200}><PieChart><Pie data={eD} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={{stroke:C.muted,strokeWidth:1}}>{eD.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}</Pie><Tooltip {...TT}/></PieChart></ResponsiveContainer>}</Card>
        <Card><SH>Verkaufte Größen</SH><ResponsiveContainer width="100%" height={200}><BarChart data={sD}><CartesianGrid strokeDasharray="3 3" stroke={C.bdr}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11,fontFamily:"Barlow"}}/><YAxis tick={{fill:C.muted,fontSize:11,fontFamily:"Barlow"}}/><Tooltip {...TT}/><Bar dataKey="value" fill={C.red} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>
        <Card><SH>Lagerbestand nach Größe</SH><ResponsiveContainer width="100%" height={200}><BarChart data={["S","M","L","XL","XXL"].map(sz=>({name:sz,value:products.reduce((a,p)=>a+(p.sizes[sz]||0),0)}))}><CartesianGrid strokeDasharray="3 3" stroke={C.bdr}/><XAxis dataKey="name" tick={{fill:C.muted,fontSize:11,fontFamily:"Barlow"}}/><YAxis tick={{fill:C.muted,fontSize:11,fontFamily:"Barlow"}}/><Tooltip {...TT}/><Bar dataKey="value" fill={C.grn} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></Card>
      </div>
    </div>
  );
}

function ReportView({ sales, expenses }) {
  const isMobile = useIsMobile();
  const now=new Date();
  const [mo,setMo]=useState(now.getMonth());const [yr,setYr]=useState(now.getFullYear());
  const ms=sales.filter(s=>{const d=new Date(s.date);return d.getMonth()===mo&&d.getFullYear()===yr&&s.status!=="cancelled";});
  const me=expenses.filter(e=>{const d=new Date(e.date);return d.getMonth()===mo&&d.getFullYear()===yr;});
  const rev=ms.reduce((a,s)=>a+s.total,0);const gP=ms.reduce((a,s)=>a+s.profit,0);const totE=me.reduce((a,e)=>a+e.amount,0);const net=gP-totE;
  const TH=({c})=><th style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,textAlign:"left",padding:"5px 7px",fontWeight:600,letterSpacing:"0.5px"}}>{c}</th>;
  const TD=({c,col})=><td style={{fontFamily:"Barlow",fontSize:11,color:col||C.txt,padding:"6px 7px",borderBottom:`1px solid ${C.bdr}22`}}>{c}</td>;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>MONATSBERICHT</h2>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={mo} onChange={e=>setMo(parseInt(e.target.value))} style={{background:C.card,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"6px 10px",fontFamily:"Barlow",fontSize:12}}>{Array.from({length:12},(_,i)=><option key={i} value={i}>{MON[i]}</option>)}</select>
          <select value={yr} onChange={e=>setYr(parseInt(e.target.value))} style={{background:C.card,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"6px 10px",fontFamily:"Barlow",fontSize:12}}>{[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select>
          <Btn variant="ghost" sm onClick={()=>printReport({sales,expenses,mo,yr})}><Printer size={13}/> Drucken / PDF</Btn>
        </div>
      </div>
      <Card style={{overflowX:isMobile?"auto":"visible"}}>
        <div style={{fontFamily:"Bebas Neue",fontSize:24,color:C.txt,letterSpacing:"3px",marginBottom:2}}>DOF – DISCIPLINE OVER FEELINGS</div>
        <div style={{fontFamily:"Barlow Condensed",fontSize:13,color:C.muted,marginBottom:22}}>Monatsbericht {MON[mo]} {yr} · dofclothes.de</div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:22}}>
          {[{l:"Umsatz",v:fmt(rev),c:C.blu},{l:"Rohgewinn",v:fmt(gP),c:C.grn},{l:"Ausgaben",v:fmt(totE),c:C.red},{l:"Nettogewinn",v:fmt(net),c:net>=0?C.grn:C.red}].map(x=><div key={x.l} style={{background:C.card2,borderRadius:7,padding:"12px 14px",textAlign:"center"}}><div style={{fontFamily:"Barlow",fontSize:10,color:C.muted,marginBottom:5}}>{x.l}</div><div style={{fontFamily:"Barlow Condensed",fontSize:20,fontWeight:700,color:x.c}}>{x.v}</div></div>)}
        </div>
        <SH>Verkäufe ({ms.length})</SH>
        <table style={{width:"100%",borderCollapse:"collapse",marginBottom:20}}><thead><tr style={{borderBottom:`1px solid ${C.bdr}`}}>{["Datum","Produkt","Gr.","Menge","Betrag","Gewinn","Zahlung","Kunde"].map(h=><TH key={h} c={h}/>)}</tr></thead><tbody>{ms.map(s=><tr key={s.id}><TD c={s.date} col={C.muted}/><TD c={s.productName.split(" ").slice(0,3).join(" ")}/><TD c={s.size}/><TD c={s.quantity}/><TD c={fmt(s.total)}/><TD c={fmt(s.profit)} col={C.grn}/><TD c={s.payment} col={C.muted}/><TD c={s.customerName||"–"} col={C.muted}/></tr>)}{ms.length===0&&<tr><td colSpan={8} style={{fontFamily:"Barlow",fontSize:12,color:C.muted,textAlign:"center",padding:"16px 0"}}>Keine Verkäufe</td></tr>}</tbody></table>
        <SH>Ausgaben ({me.length})</SH>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{borderBottom:`1px solid ${C.bdr}`}}>{["Datum","Kategorie","Betrag","Notiz"].map(h=><TH key={h} c={h}/>)}</tr></thead><tbody>{me.map(e=><tr key={e.id}><TD c={e.date} col={C.muted}/><TD c={e.category}/><TD c={fmt(e.amount)} col={C.red}/><TD c={e.note||"–"} col={C.muted}/></tr>)}{me.length===0&&<tr><td colSpan={4} style={{fontFamily:"Barlow",fontSize:12,color:C.muted,textAlign:"center",padding:"16px 0"}}>Keine Ausgaben</td></tr>}</tbody></table>
      </Card>
    </div>
  );
}

function KundView({ customers, setCustomers, sales }) {
  const [modal,setModal]=useState(null);const [eid,setEid]=useState(null);const [search,setSearch]=useState("");
  const [ask,confirmNode]=useConfirm();
  const E={name:"",email:"",phone:"",notes:""};const [f,setF]=useState(E);
  const openAdd=()=>{setF(E);setModal("add");};const openEdit=c=>{setF(c);setEid(c.id);setModal("edit");};
  const save=()=>{if(modal==="add")setCustomers(p=>[...p,{...f,id:uid(),createdAt:tod()}]);else setCustomers(p=>p.map(c=>c.id===eid?{...c,...f}:c));setModal(null);};
  const del=id=>ask("Kunden wirklich löschen?",()=>setCustomers(p=>p.filter(c=>c.id!==id)));
  const gs=c=>{const cs=sales.filter(s=>s.customerName&&s.customerName.toLowerCase()===c.name.toLowerCase()&&s.status!=="cancelled");return{n:cs.length,r:cs.reduce((a,s)=>a+s.total,0)};};
  const fil=customers.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||(c.email||"").toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      {confirmNode}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>KUNDEN</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>{customers.length} Kunden</p></div>
        <div style={{display:"flex",gap:9}}><div style={{position:"relative"}}><Search size={12} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen…" style={{background:C.card,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"7px 10px 7px 28px",fontFamily:"Barlow",fontSize:12,width:180}}/></div><Btn onClick={openAdd}><Plus size={13}/> Neu</Btn></div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {fil.map(c=>{const st=gs(c);return(
          <Card key={c.id} style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:C.red+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:"Bebas Neue",fontSize:17,color:C.red}}>{c.name[0]?.toUpperCase()}</span></div>
            <div style={{flex:1}}><div style={{fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,color:C.txt,marginBottom:2}}>{c.name}</div><div style={{fontFamily:"Barlow",fontSize:11,color:C.muted}}>{c.email||"–"}{c.phone?` · ${c.phone}`:""}</div>{c.notes&&<div style={{fontFamily:"Barlow",fontSize:11,color:C.dim,marginTop:1,fontStyle:"italic"}}>{c.notes}</div>}</div>
            <div style={{textAlign:"right",minWidth:110}}><div style={{fontFamily:"Barlow Condensed",fontSize:17,fontWeight:700,color:C.txt}}>{fmt(st.r)}</div><div style={{fontFamily:"Barlow",fontSize:10,color:C.muted}}>{st.n} Käufe</div></div>
            <div style={{display:"flex",gap:5}}><Btn variant="ghost" sm onClick={()=>openEdit(c)}><Edit2 size={12}/></Btn><Btn variant="danger" sm onClick={()=>del(c.id)}><Trash2 size={12}/></Btn></div>
          </Card>
        );})}
        {fil.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>{search?"Keine Kunden gefunden":"Noch keine Kunden erfasst"}</div>}
      </div>
      {modal&&<Modal title={modal==="add"?"Neuer Kunde":"Kunde bearbeiten"} onClose={()=>setModal(null)}><div style={{display:"grid",gap:12}}><Fld label="Name" value={f.name} onChange={v=>setF(x=>({...x,name:v}))} placeholder="Max Mustermann"/><Fld label="E-Mail" type="email" value={f.email} onChange={v=>setF(x=>({...x,email:v}))} placeholder="max@example.com"/><Fld label="Telefon" value={f.phone} onChange={v=>setF(x=>({...x,phone:v}))} placeholder="+49…"/><Fld label="Notizen" value={f.notes} onChange={v=>setF(x=>({...x,notes:v}))} placeholder="Interne Notizen…"/></div><div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}><Btn variant="ghost" onClick={()=>setModal(null)}>Abbrechen</Btn><Btn onClick={save}><Check size={13}/> Speichern</Btn></div></Modal>}
    </div>
  );
}

function TodoView({ tasks, setTasks }) {
  const isMobile=useIsMobile();
  const [modal,setModal]=useState(null);const [eid,setEid]=useState(null);
  const [search,setSearch]=useState("");const [area,setArea]=useState("all");const [prio,setPrio]=useState("all");
  const [ask,confirmNode]=useConfirm();
  const ST={todo:["To-do",C.muted],doing:["In Arbeit",C.blu],waiting:["Warten",C.ylw],done:["Erledigt",C.grn]};
  const PR={high:["Hoch",C.red],medium:["Normal",C.ylw],low:["Niedrig",C.muted]};
  const AREAS=["Allgemein","Design","Produktion","Shopify","Marketing","Content","Versand","Steuer","Influencer"];
  const E={title:"",status:"todo",area:"Allgemein",priority:"medium",dueDate:"",owner:"",checklist:"",notes:"",createdAt:tod()};
  const [f,setF]=useState(E);
  const openAdd=(st="todo")=>{setF({...E,status:st});setEid(null);setModal("edit");};
  const openEdit=t=>{setF({...E,...t});setEid(t.id);setModal("edit");};
  const save=()=>{if(!f.title.trim())return;const row={...f,id:eid||uid(),title:f.title.trim(),updatedAt:new Date().toISOString(),doneAt:f.status==="done"?(f.doneAt||tod()):""};setTasks(p=>eid?p.map(t=>t.id===eid?row:t):[row,...p]);setModal(null);};
  const del=id=>ask("Aufgabe wirklich loeschen?",()=>setTasks(p=>p.filter(t=>t.id!==id)));
  const setSt=(id,st)=>setTasks(p=>p.map(t=>t.id===id?{...t,status:st,doneAt:st==="done"?tod():"",updatedAt:new Date().toISOString()}:t));
  const over=t=>t.dueDate&&t.status!=="done"&&t.dueDate<tod();
  const today=t=>t.dueDate===tod()&&t.status!=="done";
  const lines=t=>(t.checklist||"").split("\n").map(x=>x.trim()).filter(Boolean);
  const filtered=tasks.filter(t=>(area==="all"||t.area===area)&&(prio==="all"||t.priority===prio)&&(!search||[t.title,t.notes,t.owner,t.area].join(" ").toLowerCase().includes(search.toLowerCase())));
  const openN=tasks.filter(t=>t.status!=="done").length, doneN=tasks.filter(t=>t.status==="done").length, overN=tasks.filter(over).length, todayN=tasks.filter(today).length;
  return (
    <div>
      {confirmNode}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,gap:12,flexWrap:"wrap"}}>
        <div><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>TO-DO BOARD</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>Aufgaben fuer Drops, Content, Produktion und Alltag</p></div>
        <Btn onClick={()=>openAdd()}><Plus size={13}/> Aufgabe</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <Stat label="Offen" value={openN} Icon={ClipboardList} color={C.blu}/>
        <Stat label="Heute" value={todayN} Icon={Clock} color={C.ylw}/>
        <Stat label="Ueberfaellig" value={overN} Icon={AlertTriangle} color={C.red}/>
        <Stat label="Erledigt" value={doneN} Icon={Check} color={C.grn}/>
      </div>
      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.6fr 1fr 1fr",gap:10}}>
          <div style={{position:"relative"}}><Search size={12} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Aufgabe, Notiz oder Bereich suchen..." style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px 8px 28px",fontFamily:"Barlow",fontSize:12}}/></div>
          <select value={area} onChange={e=>setArea(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:12}}><option value="all">Alle Bereiche</option>{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
          <select value={prio} onChange={e=>setPrio(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:12}}><option value="all">Alle Prioritaeten</option>{Object.entries(PR).map(([k,v])=><option key={k} value={k}>{v[0]}</option>)}</select>
        </div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,minmax(0,1fr))",gap:12,alignItems:"start"}}>
        {Object.entries(ST).map(([st,[label,color]])=>{const rows=filtered.filter(t=>t.status===st);return <div key={st} style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:8,minHeight:220}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 12px",borderBottom:`1px solid ${C.bdr}`}}><div style={{fontFamily:"Barlow Condensed",fontSize:13,fontWeight:700,color,letterSpacing:"1px",textTransform:"uppercase"}}>{label} ({rows.length})</div><button onClick={()=>openAdd(st)} style={{background:"transparent",border:`1px solid ${C.bdr}`,color:C.muted,borderRadius:5,padding:"3px 6px",cursor:"pointer",display:"flex"}}><Plus size={12}/></button></div><div style={{padding:8,display:"flex",flexDirection:"column",gap:8}}>{rows.map(t=><div key={t.id} style={{background:C.card,border:`1px solid ${over(t)?C.red+"66":C.bdr}`,borderRadius:8,padding:"11px 12px"}}><div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:7}}><div style={{fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,color:C.txt,lineHeight:1.2}}>{t.title}</div><Badge color={PR[t.priority]?.[1]||C.muted}>{PR[t.priority]?.[0]||t.priority}</Badge></div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}><Badge color={C.blu}>{t.area}</Badge>{t.dueDate&&<Badge color={over(t)?C.red:today(t)?C.ylw:C.muted}>{over(t)?"Ueberfaellig":today(t)?"Heute":t.dueDate}</Badge>}{t.owner&&<Badge color={C.muted}>{t.owner}</Badge>}</div>{lines(t).length>0&&<div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:8}}>{lines(t).slice(0,3).map((x,i)=><div key={i}>- {x}</div>)}{lines(t).length>3&&<div style={{color:C.dim}}>+ {lines(t).length-3} weitere</div>}</div>}{t.notes&&<div style={{fontFamily:"Barlow",fontSize:11,color:C.dim,lineHeight:1.5,marginBottom:8}}>{t.notes}</div>}<div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"space-between"}}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{Object.keys(ST).filter(x=>x!==st).map(x=><button key={x} onClick={()=>setSt(t.id,x)} style={{background:"transparent",border:`1px solid ${C.bdr}`,color:ST[x][1],borderRadius:5,padding:"3px 6px",fontFamily:"Barlow Condensed",fontSize:10,cursor:"pointer"}}>{ST[x][0]}</button>)}</div><div style={{display:"flex",gap:4}}><button onClick={()=>openEdit(t)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.muted,borderRadius:5,padding:"4px 7px",cursor:"pointer",display:"flex"}}><Edit2 size={11}/></button><button onClick={()=>del(t.id)} style={{background:"#200810",border:`1px solid #3a0a12`,color:C.red,borderRadius:5,padding:"4px 7px",cursor:"pointer",display:"flex"}}><Trash2 size={11}/></button></div></div></div>)}{rows.length===0&&<div style={{fontFamily:"Barlow",fontSize:12,color:C.dim,textAlign:"center",padding:"28px 8px"}}>Leer</div>}</div></div>;})}
      </div>
      {modal==="edit"&&<Modal title={eid?"Aufgabe bearbeiten":"Neue Aufgabe"} onClose={()=>setModal(null)} width={680}><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}><Fld label="Titel" value={f.title} onChange={v=>setF(x=>({...x,title:v}))} placeholder="z.B. Hoodie Sample bestellen" style={{gridColumn:isMobile?"auto":"1/-1"}}/><Fld label="Status" value={f.status} onChange={v=>setF(x=>({...x,status:v}))} options={Object.entries(ST).map(([value,x])=>({value,label:x[0]}))}/><Fld label="Bereich" value={f.area} onChange={v=>setF(x=>({...x,area:v}))} options={AREAS}/><Fld label="Prioritaet" value={f.priority} onChange={v=>setF(x=>({...x,priority:v}))} options={Object.entries(PR).map(([value,x])=>({value,label:x[0]}))}/><Fld label="Deadline" type="date" value={f.dueDate} onChange={v=>setF(x=>({...x,dueDate:v}))}/><Fld label="Verantwortlich" value={f.owner} onChange={v=>setF(x=>({...x,owner:v}))} placeholder="Ich, Designer, Lieferant..."/><div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:isMobile?"auto":"1/-1"}}><label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>Checkliste (eine Zeile pro Punkt)</label><textarea value={f.checklist} onChange={e=>setF(x=>({...x,checklist:e.target.value}))} placeholder={"Mockup fertig\nSupplier anschreiben\nPreis bestaetigen"} style={{minHeight:78,background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/></div><div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:isMobile?"auto":"1/-1"}}><label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>Notizen</label><textarea value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))} placeholder="Details, Links, naechster Schritt..." style={{minHeight:90,background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/></div></div><div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}><Btn variant="ghost" onClick={()=>setModal(null)}>Abbrechen</Btn><Btn onClick={save}><Check size={13}/> Speichern</Btn></div></Modal>}
    </div>
  );
}

function InfluencerView({ influencers, setInfluencers }) {
  const isMobile = useIsMobile();
  const [modal,setModal]=useState(null);const [eid,setEid]=useState(null);
  const [search,setSearch]=useState("");const [status,setStatus]=useState("all");const [platform,setPlatform]=useState("all");
  const [ask,confirmNode]=useConfirm();
  const E={name:"",handle:"",platform:"Instagram",followers:"",status:"contacted",productsSent:"",giftedValue:"0",shippingCost:"0",discountCode:"",campaignLink:"",orders:"0",revenue:"0",contactDate:tod(),sentDate:"",postDate:"",notes:""};
  const [f,setF]=useState(E);const [rev,setRev]=useState({amount:"",orders:"1",note:""});
  const num=v=>parseFloat(v)||0;const int=v=>parseInt(v)||0;
  const cost=i=>num(i.giftedValue)+num(i.shippingCost);
  const roi=i=>cost(i)>0?((num(i.revenue)-cost(i))/cost(i))*100:0;
  const labels={contacted:"Angefragt",sent:"Paket gesendet",posted:"Gepostet",paid:"Umsatz aktiv",dropped:"Beendet"};
  const colors={contacted:C.blu,sent:C.ylw,posted:C.red,paid:C.grn,dropped:C.muted};
  const openAdd=()=>{setF(E);setEid(null);setModal("edit");};
  const openEdit=i=>{setF({...E,...i,followers:String(i.followers||""),giftedValue:String(i.giftedValue||0),shippingCost:String(i.shippingCost||0),orders:String(i.orders||0),revenue:String(i.revenue||0)});setEid(i.id);setModal("edit");};
  const openRev=i=>{setEid(i.id);setRev({amount:"",orders:"1",note:""});setModal("revenue");};
  const save=()=>{const row={...f,id:eid||uid(),followers:int(f.followers),giftedValue:num(f.giftedValue),shippingCost:num(f.shippingCost),orders:int(f.orders),revenue:num(f.revenue),updatedAt:new Date().toISOString()};setInfluencers(p=>eid?p.map(i=>i.id===eid?row:i):[row,...p]);setModal(null);};
  const saveRevenue=()=>{setInfluencers(p=>p.map(i=>i.id===eid?{...i,revenue:num(i.revenue)+num(rev.amount),orders:int(i.orders)+int(rev.orders),status:"paid",lastRevenueNote:rev.note,updatedAt:new Date().toISOString()}:i));setModal(null);};
  const del=id=>ask("Influencer wirklich loeschen?",()=>setInfluencers(p=>p.filter(i=>i.id!==id)));
  const setSt=(id,st)=>setInfluencers(p=>p.map(i=>i.id===id?{...i,status:st,updatedAt:new Date().toISOString()}:i));
  const filtered=influencers.filter(i=>(status==="all"||i.status===status)&&(platform==="all"||i.platform===platform)&&(!search||[i.name,i.handle,i.productsSent,i.discountCode].join(" ").toLowerCase().includes(search.toLowerCase())));
  const totalRevenue=influencers.reduce((a,i)=>a+num(i.revenue),0);
  const totalCost=influencers.reduce((a,i)=>a+cost(i),0);
  const totalFollowers=influencers.reduce((a,i)=>a+int(i.followers),0);
  const best=[...influencers].sort((a,b)=>num(b.revenue)-num(a.revenue))[0];
  return (
    <div>
      {confirmNode}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,gap:12,flexWrap:"wrap"}}>
        <div><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>INFLUENCER-TRACKER</h2><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>Pakete, Codes, Reichweite und Umsatz pro Creator</p></div>
        <Btn onClick={openAdd}><Plus size={13}/> Influencer</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <Stat label="Influencer" value={influencers.length} Icon={Megaphone} color={C.red}/>
        <Stat label="Follower gesamt" value={totalFollowers.toLocaleString("de-DE")} Icon={Users} color={C.blu}/>
        <Stat label="Umsatz" value={fmt(totalRevenue)} Icon={TrendingUp} color={C.grn}/>
        <Stat label="ROI" value={totalCost>0?`${roi({revenue:totalRevenue,giftedValue:totalCost,shippingCost:0}).toFixed(0)}%`:"-"} Icon={DollarSign} color={totalRevenue>=totalCost?C.grn:C.ylw} sub={best?.name?`Top: ${best.name}`:"noch keine Umsaetze"}/>
      </div>
      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.5fr 1fr 1fr",gap:10}}>
          <div style={{position:"relative"}}><Search size={12} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:C.muted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, @handle, Produkt oder Code suchen..." style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px 8px 28px",fontFamily:"Barlow",fontSize:12}}/></div>
          <select value={status} onChange={e=>setStatus(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:12}}><option value="all">Alle Status</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
          <select value={platform} onChange={e=>setPlatform(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:12}}>{["all","Instagram","TikTok","YouTube","Twitch","Sonstiges"].map(x=><option key={x} value={x}>{x==="all"?"Alle Plattformen":x}</option>)}</select>
        </div>
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        {filtered.map(i=><Card key={i.id}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.2fr 1fr 1fr auto",gap:14,alignItems:"center"}}>
            <div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}><span style={{fontFamily:"Barlow Condensed",fontSize:18,fontWeight:700,color:C.txt}}>{i.name||i.handle||"Unbenannt"}</span><Badge color={colors[i.status]||C.muted}>{labels[i.status]||i.status}</Badge></div><div style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>{i.platform} {i.handle?`Â· ${i.handle}`:""} Â· {int(i.followers).toLocaleString("de-DE")} Follower</div><div style={{fontFamily:"Barlow",fontSize:11,color:C.dim,marginTop:4}}>Gesendet: {i.productsSent||"-"}{i.discountCode?` Â· Code: ${i.discountCode}`:""}</div></div>
            <div><div style={{fontFamily:"Barlow",fontSize:10,color:C.muted,marginBottom:4}}>Kosten</div><div style={{fontFamily:"Barlow Condensed",fontSize:19,fontWeight:700,color:C.red}}>{fmt(cost(i))}</div><div style={{fontFamily:"Barlow",fontSize:10,color:C.dim}}>Produkt + Versand</div></div>
            <div><div style={{fontFamily:"Barlow",fontSize:10,color:C.muted,marginBottom:4}}>Performance</div><div style={{fontFamily:"Barlow Condensed",fontSize:19,fontWeight:700,color:num(i.revenue)>0?C.grn:C.txt}}>{fmt(i.revenue)}</div><div style={{fontFamily:"Barlow",fontSize:10,color:C.dim}}>{int(i.orders)} Orders Â· ROI {cost(i)>0?`${roi(i).toFixed(0)}%`:"-"}</div></div>
            <div style={{display:"flex",gap:6,justifyContent:isMobile?"flex-start":"flex-end",flexWrap:"wrap"}}><Btn variant="success" sm onClick={()=>openRev(i)}><Plus size={12}/> Umsatz</Btn><Btn variant="ghost" sm onClick={()=>openEdit(i)}><Edit2 size={12}/></Btn><Btn variant="danger" sm onClick={()=>del(i.id)}><Trash2 size={12}/></Btn></div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>{Object.entries(labels).map(([k,v])=><button key={k} onClick={()=>setSt(i.id,k)} style={{background:i.status===k?(colors[k]+"22"):"transparent",border:`1px solid ${i.status===k?colors[k]+"55":C.bdr}`,color:i.status===k?colors[k]:C.muted,borderRadius:5,padding:"4px 8px",fontFamily:"Barlow Condensed",fontSize:11,cursor:"pointer"}}>{v}</button>)}</div>
          {(i.notes||i.campaignLink||i.lastRevenueNote)&&<div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginTop:10,lineHeight:1.6}}>{i.campaignLink&&<div>Link: {i.campaignLink}</div>}{i.lastRevenueNote&&<div>Letzter Umsatz: {i.lastRevenueNote}</div>}{i.notes&&<div>Notiz: {i.notes}</div>}</div>}
        </Card>)}
        {filtered.length===0&&<div style={{textAlign:"center",padding:"50px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>{influencers.length?"Keine Treffer":"Noch keine Influencer eingetragen"}</div>}
      </div>
      {modal==="edit"&&<Modal title={eid?"Influencer bearbeiten":"Neuer Influencer"} onClose={()=>setModal(null)} width={720}><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}><Fld label="Name" value={f.name} onChange={v=>setF(x=>({...x,name:v}))} placeholder="Creator Name"/><Fld label="@Handle" value={f.handle} onChange={v=>setF(x=>({...x,handle:v}))} placeholder="@creator"/><Fld label="Plattform" value={f.platform} onChange={v=>setF(x=>({...x,platform:v}))} options={["Instagram","TikTok","YouTube","Twitch","Sonstiges"]}/><Fld label="Follower" type="number" value={f.followers} onChange={v=>setF(x=>({...x,followers:v}))}/><Fld label="Status" value={f.status} onChange={v=>setF(x=>({...x,status:v}))} options={Object.entries(labels).map(([value,label])=>({value,label}))}/><Fld label="Produkte geschickt" value={f.productsSent} onChange={v=>setF(x=>({...x,productsSent:v}))} placeholder="Oversized Tee L, Hoodie M"/><Fld label="Produktwert" type="number" value={f.giftedValue} onChange={v=>setF(x=>({...x,giftedValue:v}))}/><Fld label="Versandkosten" type="number" value={f.shippingCost} onChange={v=>setF(x=>({...x,shippingCost:v}))}/><Fld label="Discount Code" value={f.discountCode} onChange={v=>setF(x=>({...x,discountCode:v}))} placeholder="DOF10"/><Fld label="Tracking Link" value={f.campaignLink} onChange={v=>setF(x=>({...x,campaignLink:v}))} placeholder="https://..."/><Fld label="Orders" type="number" value={f.orders} onChange={v=>setF(x=>({...x,orders:v}))}/><Fld label="Umsatz" type="number" value={f.revenue} onChange={v=>setF(x=>({...x,revenue:v}))}/><Fld label="Kontakt am" type="date" value={f.contactDate} onChange={v=>setF(x=>({...x,contactDate:v}))}/><Fld label="Gesendet am" type="date" value={f.sentDate} onChange={v=>setF(x=>({...x,sentDate:v}))}/><Fld label="Post am" type="date" value={f.postDate} onChange={v=>setF(x=>({...x,postDate:v}))} style={{gridColumn:isMobile?"auto":"1 / 2"}}/><div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:isMobile?"auto":"1/-1"}}><label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px"}}>Notizen</label><textarea value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))} placeholder="Absprache, Content-Idee, naechster Follow-up..." style={{minHeight:80,background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/></div></div><div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}><Btn variant="ghost" onClick={()=>setModal(null)}>Abbrechen</Btn><Btn onClick={save}><Check size={13}/> Speichern</Btn></div></Modal>}
      {modal==="revenue"&&<Modal title="Umsatz nachtragen" onClose={()=>setModal(null)} width={420}><div style={{display:"grid",gap:12}}><Fld label="Umsatz" type="number" value={rev.amount} onChange={v=>setRev(x=>({...x,amount:v}))}/><Fld label="Orders" type="number" value={rev.orders} onChange={v=>setRev(x=>({...x,orders:v}))}/><Fld label="Notiz" value={rev.note} onChange={v=>setRev(x=>({...x,note:v}))} placeholder="z.B. Shopify Code DOF10"/></div><div style={{display:"flex",gap:9,justifyContent:"flex-end",marginTop:14}}><Btn variant="ghost" onClick={()=>setModal(null)}>Abbrechen</Btn><Btn variant="success" onClick={saveRevenue}><Check size={13}/> Eintragen</Btn></div></Modal>}
    </div>
  );
}

function EinstView({ settings, setSettings, setProducts, setSales, setExpenses, setCustomers, pushStatus, onPush }) {
  const isMobile = useIsMobile();
  const [thr,setThr]=useState(String(settings.lowStockThreshold));
  const [ask,confirmNode]=useConfirm();
  const save=()=>setSettings(s=>({...s,lowStockThreshold:parseInt(thr)||3}));
  const reset=(what,fn)=>ask(`Wirklich alle ${what} unwiderruflich löschen?`,fn);
  return (
    <div>
      {confirmNode}
      <div style={{marginBottom:22}}><h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>EINSTELLUNGEN</h2></div>
      <div style={{display:"grid",gap:14,maxWidth:540}}>
        <Card><SH>Lager-Einstellungen</SH><div style={{display:"flex",alignItems:"flex-end",gap:11,marginBottom:10}}><Fld label="Niedrigbestand-Warnung (Stück)" type="number" value={thr} onChange={setThr} style={{flex:1}}/><Btn onClick={save}><Check size={13}/> Speichern</Btn></div><p style={{fontFamily:"Barlow",fontSize:11,color:C.muted}}>Warnung bei Gesamtbestand ≤ diesem Wert.</p></Card>
        <Card><SH>Daten zurücksetzen</SH><p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginBottom:12}}>Achtung: Diese Aktionen können nicht rückgängig gemacht werden.</p>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
            <Btn variant="danger" onClick={()=>reset("Verkäufe",()=>setSales([]))}><Trash2 size={12}/> Verkäufe löschen</Btn>
            <Btn variant="danger" onClick={()=>reset("Ausgaben",()=>setExpenses([]))}><Trash2 size={12}/> Ausgaben löschen</Btn>
            <Btn variant="danger" onClick={()=>reset("Kunden",()=>setCustomers([]))}><Trash2 size={12}/> Kunden löschen</Btn>
            <Btn variant="danger" onClick={()=>reset("Produkte",()=>setProducts(INIT_PRODUCTS))}><Trash2 size={12}/> Produkte reset</Btn>
            <Btn variant="danger" onClick={()=>reset("Daten",()=>{setProducts(INIT_PRODUCTS);setSales([]);setExpenses([]);setCustomers([]);})} style={{gridColumn:"1/-1",background:"#2a0808"}}><Trash2 size={12}/> ALLE DATEN ZURÜCKSETZEN</Btn>
          </div>
        </Card>
        <Card>
          <SH>Push-Benachrichtigungen</SH>
          {pushStatus==="granted"
            ?<div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:"#081a0e",border:`1px solid ${C.grn}44`,borderRadius:7,padding:"10px 14px"}}>
                <Bell size={14} color={C.grn}/>
                <span style={{fontFamily:"Barlow",fontSize:13,color:C.grn}}>Benachrichtigungen sind aktiv ✓</span>
              </div>
              <Btn variant="ghost" sm onClick={async()=>{
                const r=await fetch("/api/send-test-push", { method:"POST" });
                const d=await r.json();
                alert(d.sent>0?`✓ Test gesendet! (${d.sent} Gerät)`:(d.message||"Fehler: "+JSON.stringify(d)));
              }}><Bell size={12}/> Test-Benachrichtigung senden</Btn>
              <Btn variant="ghost" sm onClick={onPush} style={{marginTop:8}}><RefreshCw size={12}/> Push neu verbinden</Btn>
            </div>
            :<div>
              <p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginBottom:12}}>Aktiviere Push-Benachrichtigungen um bei jeder neuen Shopify-Bestellung sofort informiert zu werden.</p>
              <Btn onClick={onPush}><Smartphone size={13}/> Benachrichtigungen aktivieren</Btn>
            </div>
          }
        </Card>
        <Card><SH>Über DOFClothes</SH><div style={{fontFamily:"Barlow",fontSize:12,color:C.muted,lineHeight:1.7}}><strong style={{color:C.txt,fontFamily:"Barlow Condensed",fontSize:14,letterSpacing:"0.5px"}}>DOFClothes Business Dashboard</strong><br/>Internes Management-Tool für dofclothes.de<br/>Daten werden in der Cloud gespeichert (Supabase) — überall verfügbar.</div></Card>
      </div>
    </div>
  );
}

// ── SIDEBAR ───────────────────────────────────────────────────────────
const NAV=[
  {id:"dashboard",label:"Dashboard",    Icon:Home},
  {id:"products", label:"Produkte",     Icon:Package},
  {id:"inventory",label:"Lager",        Icon:Archive},
  {id:"sale",     label:"Verkauf",      Icon:ShoppingCart},
  {id:"orders",   label:"Bestellungen", Icon:Receipt},
  {id:"shipping", label:"Versand",      Icon:Truck},
  {id:"returns",  label:"Retouren",     Icon:RefreshCw},
  {id:"expenses", label:"Ausgaben",     Icon:DollarSign},
  {id:"stats",    label:"Statistiken",  Icon:BarChart2},
  {id:"report",   label:"Monatsbericht",Icon:FileText},
  {id:"customers",label:"Kunden",       Icon:Users},
  {id:"todo",     label:"To-do Board",  Icon:ClipboardList},
  {id:"supportmail",label:"Support Mail",Icon:Mail},
  {id:"influencers",label:"Influencer", Icon:Megaphone},
  {id:"settings",   label:"Einstellungen",Icon:Settings},
  {id:"rechnungen", label:"Rechnungen",    Icon:Upload},
  {id:"steuer",     label:"Steuer",       Icon:Landmark},
  {id:"kalkulator", label:"Kalkulator",   Icon:Calculator},
];

function Sidebar({ active, setActive, lowN, onLogout, pushStatus, onPush, isMobile, isOpen, onClose }) {
  return (
    <aside style={{
      width:isMobile?268:232, background:`linear-gradient(180deg, #0d0d0c, #070707)`, borderRight:`1px solid ${C.line}`,
      display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto",
      ...(isMobile ? {
        position:"fixed", top:0, left: isOpen ? 0 : -286, height:"100vh",
        zIndex:999, transition:"left 0.25s ease", boxShadow: isOpen ? "12px 0 40px rgba(0,0,0,0.7)" : "none"
      } : {
        position:"sticky", top:0, height:"100vh", minHeight:"100vh"
      })
    }}>
      <div style={{padding:"18px 16px 16px",borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:7,border:`1px solid ${C.red}66`,background:"#18070b",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Bebas Neue",fontSize:22,color:C.txt,letterSpacing:"1px"}}>D</div>
          <div>
            <div style={{fontFamily:"Bebas Neue",fontSize:24,letterSpacing:"3px",color:C.txt,lineHeight:1}}>DOFCLOTHES</div>
            <div style={{fontFamily:"Barlow Condensed",fontSize:9,color:C.red,letterSpacing:"2px",marginTop:2,fontWeight:700}}>BUSINESS OPS</div>
          </div>
        </div>
      </div>
      <nav style={{flex:1,padding:"12px 9px"}}>
        {NAV.map(({id,label,Icon})=>{const on=active===id;return(
          <button className="dof-nav-btn" key={id} onClick={()=>setActive(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:isMobile?"11px 10px":"9px 10px",borderRadius:7,marginBottom:3,background:on?"rgba(255,48,79,.13)":"transparent",border:on?`1px solid ${C.red}55`:"1px solid transparent",color:on?C.txt:C.muted,cursor:"pointer",transition:"background 0.1s",textAlign:"left"}}>
            <span style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:on?C.red+"22":"rgba(255,255,255,.035)",border:`1px solid ${on?C.red+"44":C.bdr}`}}><Icon size={14} color={on?C.red:C.muted}/></span>
            <span style={{fontFamily:"Barlow Condensed",fontSize:13,fontWeight:on?700:600,letterSpacing:"0.4px",flex:1}}>{label}</span>
            {id==="inventory"&&lowN>0&&<span style={{background:C.ylw,color:"#000",borderRadius:9,padding:"1px 5px",fontSize:9,fontFamily:"Barlow Condensed",fontWeight:700}}>{lowN}</span>}
          </button>
        );})}
      </nav>
      <div style={{padding:"12px 14px 14px",borderTop:`1px solid ${C.line}`}}>
        <div style={{fontFamily:"Barlow",fontSize:10,color:C.muted}}>dofclothes.de</div>
        <div style={{fontFamily:"Barlow Condensed",fontSize:9,color:C.dim,letterSpacing:"1px",marginTop:2}}>DISCIPLINE OVER FEELINGS</div>
        <button onClick={onLogout} style={{marginTop:10,width:"100%",background:"#11100e",border:`1px solid ${C.line}`,color:C.muted,borderRadius:6,padding:"7px",fontFamily:"Barlow Condensed",fontSize:11,letterSpacing:"0.8px",cursor:"pointer"}}>AUSLOGGEN</button>
        {pushStatus==="granted"
          ?<div style={{marginTop:7,display:"flex",alignItems:"center",gap:6,padding:"6px 7px",border:`1px solid ${C.grn}33`,borderRadius:6,background:C.grn+"10"}}><Bell size={10} color={C.grn}/><span style={{fontFamily:"Barlow Condensed",fontSize:9,color:C.grn,letterSpacing:"0.8px"}}>PUSH AKTIV</span></div>
          :pushStatus!=="unsupported"&&<button onClick={onPush} style={{marginTop:7,width:"100%",background:"#16060a",border:`1px solid ${C.red}44`,color:C.red,borderRadius:6,padding:"7px",fontFamily:"Barlow Condensed",fontSize:9,letterSpacing:"0.8px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><Smartphone size={9}/> APP INSTALLIEREN</button>}
      </div>
    </aside>
  );
}

// ── APP ───────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem("dof_auth") === "1");
  const [products, setProducts, p0] = useDB("dof_products",  INIT_PRODUCTS);
  const [sales,    setSales,    p1] = useDB("dof_sales",     []);
  const [expenses, setExpenses, p2] = useDB("dof_expenses",  []);
  const [customers,setCustomers,p3] = useDB("dof_customers", []);
  const [settings, setSettings, p4] = useDB("dof_settings",  { lowStockThreshold:3 });
  const [invoices, setInvoices,  p5] = useDB("dof_invoices",   []);
  const [influencers,setInfluencers,p6] = useDB("dof_influencers", []);
  const [tasks, setTasks, p7] = useDB("dof_tasks", []);
  const [supportMailMeta, setSupportMailMeta, p8] = useDB("dof_support_mail_meta", {});
  const [returns, setReturns, p9] = useDB("dof_returns", []);
  const [active, setActive] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const isMobile = useIsMobile();
  const { status: pushStatus, subscribe: pushSubscribe } = usePush();

  useEffect(() => {
    const expire = () => setAuthed(false);
    window.addEventListener("dof_auth_expired", expire);
    return () => window.removeEventListener("dof_auth_expired", expire);
  }, []);

  const ready = p0 && p1 && p2 && p3 && p4 && p5 && p6 && p7 && p8 && p9;
  const lowN  = products.filter(p=>{const t=Object.values(p.sizes).reduce((a,b)=>a+b,0);return t>0&&t<=settings.lowStockThreshold;}).length;
  const vp    = { products, setProducts, sales, setSales, expenses, setExpenses, customers, setCustomers, settings, setSettings, invoices, setInvoices, influencers, setInfluencers, tasks, setTasks, supportMailMeta, setSupportMailMeta, returns, setReturns };

  const VIEWS = {
    dashboard:<DashView  {...vp}/>, products:<ProdView  {...vp}/>, inventory:<LagerView {...vp}/>,
    sale:<SaleView {...vp}/>, orders:<OrdersView {...vp}/>, shipping:<ShippingView {...vp}/>, returns:<ReturnsView returns={returns} setReturns={setReturns}/>, expenses:<AusgView  {...vp} invoices={invoices}/>,
    stats:<StatsView {...vp}/>, report:<ReportView {...vp}/>, customers:<KundView  {...vp}/>, todo:<TodoView {...vp}/>, supportmail:<SupportMailView mailMeta={supportMailMeta} setMailMeta={setSupportMailMeta}/>, influencers:<InfluencerView {...vp}/>,
    settings:<EinstView {...vp} pushStatus={pushStatus} onPush={pushSubscribe}/>,
    rechnungen:<RechnungenView expenses={expenses} setExpenses={setExpenses} invoices={invoices} setInvoices={setInvoices}/>,
    steuer:<SteuerView sales={sales} expenses={expenses}/>,
    kalkulator:<KalkulatorView/>,
  };

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  if (!ready) return (
    <div className="dof-shell" style={{background:C.bg,height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <GlobalChromeStyles/>
      <div style={{fontFamily:"Bebas Neue",fontSize:32,letterSpacing:"6px",color:C.txt}}>DOFCLOTHES</div>
      <div style={{display:"flex",alignItems:"center",gap:8,color:C.muted,fontFamily:"Barlow",fontSize:13}}>
        <RefreshCw size={14} style={{animation:"spin 1s linear infinite"}}/> Verbinde mit Datenbank…
      </div>
    </div>
  );

  return (
    <div className="dof-shell" style={{background:C.bg,minHeight:"100vh",display:"flex",color:C.txt}}>
      <GlobalChromeStyles/>
      {/* Mobile overlay */}
      {isMobile && sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:998}}/>
      )}
      <Sidebar
        active={active}
        setActive={id => { setActive(id); setSideOpen(false); }}
        lowN={lowN}
        onLogout={() => { fetch("/api/logout").catch(()=>{}); localStorage.removeItem("dof_auth"); setAuthed(false); }}
        pushStatus={pushStatus}
        onPush={pushSubscribe}
        isMobile={isMobile}
        isOpen={sideOpen}
        onClose={() => setSideOpen(false)}
      />
      <main style={{flex:1,overflowY:"auto",padding:isMobile?"12px":"28px 30px",paddingTop:isMobile?"0":"28px",minWidth:0}}>
        {isMobile && (
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,paddingTop:"calc(env(safe-area-inset-top, 0px) + 10px)",paddingBottom:10,position:"sticky",top:0,zIndex:50,background:"rgba(5,5,5,.92)",backdropFilter:"blur(10px)",borderBottom:`1px solid ${C.bdr}`}}>
            <button onClick={() => setSideOpen(true)} style={{background:C.card,border:`1px solid ${C.line}`,color:C.txt,borderRadius:7,padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontFamily:"Barlow Condensed",fontSize:14,fontWeight:700,letterSpacing:"1px"}}>
              <span style={{fontSize:18,lineHeight:1}}>☰</span> MENÜ
            </button>
            <div style={{fontFamily:"Bebas Neue",fontSize:22,color:C.txt,letterSpacing:"3px"}}>DOFCLOTHES</div>
          </div>
        )}
        <div style={{maxWidth:1480,margin:"0 auto"}}>
          {VIEWS[active]}
        </div>
      </main>
    </div>
  );
}
