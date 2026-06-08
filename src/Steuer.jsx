import { useState } from "react";
import { Printer, TrendingUp, TrendingDown, FileText, AlertTriangle } from "lucide-react";

const C = { bg:"#080808", panel:"#0d0d0d", card:"#111111", card2:"#171717", bdr:"#222222", red:"#e11d48", grn:"#22c55e", ylw:"#f59e0b", blu:"#3b82f6", txt:"#f0f0f0", muted:"#888888", dim:"#444444" };
const fmt  = n => `${parseFloat(n||0).toFixed(2).replace(".",",")} €`;
const fmtN = n =>  parseFloat(n||0).toFixed(2).replace(".",",");

const QUARTERS = [
  { label:"Q1 — Jan bis Mär", months:[0,1,2] },
  { label:"Q2 — Apr bis Jun", months:[3,4,5] },
  { label:"Q3 — Jul bis Sep", months:[6,7,8] },
  { label:"Q4 — Okt bis Dez", months:[9,10,11] },
];

export default function SteuerView({ sales, expenses }) {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  const [q,   setQ]   = useState(currentQ);
  const [yr,  setYr]  = useState(now.getFullYear());
  const [typ, setTyp] = useState("klein"); // klein = Kleinunternehmer, regel = Regelbesteuerung

  const months = QUARTERS[q].months;

  const inRange = date => {
    const d = new Date(date);
    return d.getFullYear() === yr && months.includes(d.getMonth());
  };

  const qSales = sales.filter(s => s.status !== "cancelled" && inRange(s.date));
  const qExp   = expenses.filter(e => inRange(e.date));

  const revenue   = qSales.reduce((a,s)  => a + s.total,  0);
  const cogs      = qSales.reduce((a,s)  => a + (s.total - s.profit), 0);
  const grossProf = qSales.reduce((a,s)  => a + s.profit, 0);
  const totalExp  = qExp.reduce((a,e)   => a + e.amount, 0);
  const netProfit = grossProf - totalExp;

  // Steuer-Berechnungen
  const mwstSatz   = 0.19;
  const nettUmsatz = typ === "regel" ? revenue / (1 + mwstSatz) : revenue;
  const mwstBetrag = typ === "regel" ? revenue - nettUmsatz      : 0;
  const estSteuer  = Math.max(0, netProfit * 0.3); // grobe Einkommenssteuer-Schätzung

  // Ausgaben nach Kategorie
  const expByCat = {};
  qExp.forEach(e => { expByCat[e.category] = (expByCat[e.category]||0) + e.amount; });

  const doPrint = () => {
    const el = document.getElementById("dof-print-overlay");
    const rows = qSales.map(s => `<tr><td>${s.date}</td><td>${s.productName.split(" ").slice(0,4).join(" ")}</td><td>${s.size}</td><td>${s.quantity}</td><td>${fmt(s.total)}</td><td>${fmt(s.profit)}</td><td>${s.customerName||"–"}</td></tr>`).join("");
    const expRows = qExp.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td style="color:#dc2626">${fmt(e.amount)}</td><td>${e.note||"–"}</td></tr>`).join("");
    const catRows = Object.entries(expByCat).map(([k,v]) => `<tr><td>${k}</td><td style="color:#dc2626">${fmt(v)}</td></tr>`).join("");

    el.innerHTML = `
      <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:3px;margin-bottom:2px">DOFCLOTHES – DISCIPLINE OVER FEELINGS</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:12px;color:#666;letter-spacing:2px;margin-bottom:6px">STEUERÜBERSICHT ${QUARTERS[q].label.toUpperCase()} ${yr} · DOFCLOTHES.DE</div>
      <div style="font-family:'Barlow',sans-serif;font-size:10px;color:#999;margin-bottom:24px;padding:6px 10px;background:#fff8e1;border:1px solid #f59e0b;border-radius:4px">⚠ Diese Zusammenfassung dient nur zur Orientierung und ersetzt keine Steuerberatung.</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px">
        <div style="border:1px solid #ddd;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#666;margin-bottom:5px">${typ==="regel"?"Brutto-":""}Umsatz</div><div style="font-family:'Barlow Condensed';font-size:20px;font-weight:700">${fmt(revenue)}</div></div>
        ${typ==="regel"?`<div style="border:1px solid #ddd;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#666;margin-bottom:5px">MwSt. (19%)</div><div style="font-family:'Barlow Condensed';font-size:20px;font-weight:700;color:#dc2626">${fmt(mwstBetrag)}</div></div>`:""}
        <div style="border:1px solid #ddd;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#666;margin-bottom:5px">Ausgaben</div><div style="font-family:'Barlow Condensed';font-size:20px;font-weight:700;color:#dc2626">${fmt(totalExp)}</div></div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#666;margin-bottom:5px">Nettogewinn</div><div style="font-family:'Barlow Condensed';font-size:20px;font-weight:700;color:${netProfit>=0?"#15803d":"#dc2626"}">${fmt(netProfit)}</div></div>
        <div style="border:1px solid #ddd;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#666;margin-bottom:5px">Steuer ca. 30%</div><div style="font-family:'Barlow Condensed';font-size:20px;font-weight:700;color:#dc2626">~${fmt(estSteuer)}</div></div>
      </div>

      <div style="font-family:'Barlow Condensed';font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#666;border-bottom:2px solid #111;padding-bottom:5px;margin-bottom:10px">Verkäufe (${qSales.length})</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px">
        <thead><tr style="border-bottom:1px solid #ddd"><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Datum</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Produkt</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Gr.</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Menge</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Betrag</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Gewinn</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Kunde</th></tr></thead>
        <tbody>${rows||`<tr><td colspan="7" style="text-align:center;padding:12px;color:#999">Keine Verkäufe</td></tr>`}</tbody>
      </table>

      <div style="font-family:'Barlow Condensed';font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#666;border-bottom:2px solid #111;padding-bottom:5px;margin-bottom:10px">Ausgaben (${qExp.length})</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px">
        <thead><tr style="border-bottom:1px solid #ddd"><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Datum</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Kategorie</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Betrag</th><th style="text-align:left;padding:4px 6px;font-size:9px;text-transform:uppercase;color:#666">Notiz</th></tr></thead>
        <tbody>${expRows||`<tr><td colspan="4" style="text-align:center;padding:12px;color:#999">Keine Ausgaben</td></tr>`}</tbody>
      </table>

      <div style="font-family:'Barlow Condensed';font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#666;border-bottom:2px solid #111;padding-bottom:5px;margin-bottom:10px">Ausgaben nach Kategorie</div>
      <table style="width:50%;border-collapse:collapse;margin-bottom:28px;font-size:11px">
        <tbody>${catRows}</tbody>
      </table>

      <div style="margin-top:20px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px">Erstellt am ${new Date().toLocaleDateString("de-DE")} · DOFClothes Business Dashboard · dofclothes.de · Keine Steuerberatung.</div>
    `;
    el.style.display = "block";
    window.print();
    setTimeout(() => { el.style.display = "none"; el.innerHTML = ""; }, 1000);
  };

  const SH = ({ ch }) => <div style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:10, paddingBottom:7, borderBottom:`1px solid ${C.bdr}` }}>{ch}</div>;
  const Row = ({ label, value, color, bold }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.bdr}22` }}>
      <span style={{ fontFamily:"Barlow", fontSize:13, color:C.muted }}>{label}</span>
      <span style={{ fontFamily:"Barlow Condensed", fontSize:bold?20:15, fontWeight:bold?700:600, color:color||C.txt }}>{value}</span>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ fontFamily:"Bebas Neue", fontSize:30, color:C.txt, letterSpacing:"2px" }}>STEUERVORBEREITUNG</h2>
          <p style={{ fontFamily:"Barlow", fontSize:12, color:C.muted, marginTop:3 }}>Quartalszusammenfassung für Steuerberater & Steuererklärung</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <select value={q} onChange={e=>setQ(parseInt(e.target.value))} style={{ background:C.card, border:`1px solid ${C.bdr}`, color:C.txt, borderRadius:6, padding:"7px 10px", fontFamily:"Barlow", fontSize:12 }}>
            {QUARTERS.map((qq,i) => <option key={i} value={i}>{qq.label}</option>)}
          </select>
          <select value={yr} onChange={e=>setYr(parseInt(e.target.value))} style={{ background:C.card, border:`1px solid ${C.bdr}`, color:C.txt, borderRadius:6, padding:"7px 10px", fontFamily:"Barlow", fontSize:12 }}>
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={typ} onChange={e=>setTyp(e.target.value)} style={{ background:C.card, border:`1px solid ${C.bdr}`, color:C.txt, borderRadius:6, padding:"7px 10px", fontFamily:"Barlow", fontSize:12 }}>
            <option value="klein">Kleinunternehmer</option>
            <option value="regel">Regelbesteuerung (19% MwSt)</option>
          </select>
          <button onClick={doPrint} style={{ background:"transparent", border:`1px solid ${C.bdr}`, color:C.txt, borderRadius:6, padding:"7px 14px", fontFamily:"Barlow Condensed", fontSize:13, fontWeight:700, letterSpacing:"0.5px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <Printer size={13}/> PDF / Drucken
          </button>
        </div>
      </div>

      {/* Warnung */}
      <div style={{ background:"#1e1400", border:`1px solid ${C.ylw}44`, borderRadius:7, padding:"10px 14px", marginBottom:18, display:"flex", alignItems:"center", gap:8 }}>
        <AlertTriangle size={13} color={C.ylw}/>
        <span style={{ fontFamily:"Barlow", fontSize:12, color:C.ylw }}>Diese Übersicht dient nur zur Orientierung und ersetzt keine Steuerberatung.</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Linke Spalte: Übersicht */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <SH ch="Einnahmen" />
            <Row label="Brutto-Umsatz"  value={fmt(revenue)}   color={C.blu}/>
            {typ==="regel" && <>
              <Row label="Netto-Umsatz (ohne MwSt)" value={fmt(nettUmsatz)}/>
              <Row label="MwSt. 19% (abzuführen)"   value={fmt(mwstBetrag)} color={C.red}/>
            </>}
            <Row label="Anzahl Verkäufe"  value={qSales.length}/>
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <SH ch="Ausgaben" />
            {Object.entries(expByCat).map(([cat,val]) => (
              <Row key={cat} label={cat} value={fmt(val)} color={C.red}/>
            ))}
            {qExp.length === 0 && <div style={{ fontFamily:"Barlow", fontSize:12, color:C.dim, textAlign:"center", padding:"12px 0" }}>Keine Ausgaben in diesem Quartal</div>}
            <Row label="Gesamt Ausgaben" value={fmt(totalExp)} color={C.red} bold/>
          </div>
        </div>

        {/* Rechte Spalte: Ergebnis */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <SH ch="Ergebnis" />
            <Row label="Umsatz"         value={fmt(typ==="regel"?nettUmsatz:revenue)} color={C.grn}/>
            <Row label="Warenkosten"    value={fmt(cogs)}      color={C.red}/>
            <Row label="Rohgewinn"      value={fmt(grossProf)} color={C.grn}/>
            <Row label="Betriebsausgaben" value={fmt(totalExp)} color={C.red}/>
            <div style={{ borderTop:`1px solid ${C.bdr}`, marginTop:8, paddingTop:8 }}>
              <Row label="Nettogewinn" value={fmt(netProfit)} color={netProfit>=0?C.grn:C.red} bold/>
            </div>
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <SH ch="Steuer-Schätzung" />
            <div style={{ fontFamily:"Barlow", fontSize:11, color:C.muted, marginBottom:10, lineHeight:1.5 }}>
              Grobe Orientierung — individuell abweichend.
            </div>
            {typ==="regel" && <Row label="Umsatzsteuer (abzuführen)" value={fmt(mwstBetrag)} color={C.red}/>}
            <Row label="Einkommensteuer (ca. 30%)" value={`~${fmt(estSteuer)}`} color={C.ylw}/>
            <div style={{ background:C.card2, borderRadius:6, padding:"10px 12px", marginTop:12 }}>
              <div style={{ fontFamily:"Barlow Condensed", fontSize:11, color:C.muted, marginBottom:4 }}>FÜR STEUERBERATER EMPFOHLEN:</div>
              <div style={{ fontFamily:"Barlow", fontSize:12, color:C.txt, lineHeight:1.6 }}>
                ✓ Umsatz: {fmt(revenue)}<br/>
                ✓ Ausgaben: {fmt(totalExp)}<br/>
                ✓ Gewinn: {fmt(netProfit)}<br/>
                {typ==="regel" && <>✓ MwSt. abzuführen: {fmt(mwstBetrag)}<br/></>}
                ✓ Zeitraum: {QUARTERS[q].label} {yr}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
