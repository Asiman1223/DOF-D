import { useEffect, useState } from "react";
import { Calculator, TrendingUp, Info } from "lucide-react";

const C = { bg:"#080808", panel:"#0d0d0d", card:"#111111", card2:"#171717", bdr:"#222222", red:"#e11d48", grn:"#22c55e", ylw:"#f59e0b", blu:"#3b82f6", txt:"#f0f0f0", muted:"#888888", dim:"#444444" };
const fmt  = n => `${parseFloat(n||0).toFixed(2).replace(".",",")} €`;
const fN   = v => parseFloat(v) || 0;

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

const Fld = ({ label, value, onChange, hint }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    <label style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.8px" }}>{label}</label>
    <div style={{ position:"relative" }}>
      <input type="number" value={value} onChange={e=>onChange(e.target.value)} step="0.01" min="0"
        style={{ width:"100%", background:C.card2, border:`1px solid ${C.bdr}`, color:C.txt, borderRadius:6, padding:"8px 10px", fontFamily:"Barlow Condensed", fontSize:16, fontWeight:600 }}/>
      {hint && <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontFamily:"Barlow", fontSize:11, color:C.muted }}>{hint}</span>}
    </div>
  </div>
);

const Result = ({ label, value, color, big, sub }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.bdr}22` }}>
    <div>
      <div style={{ fontFamily:"Barlow", fontSize:big?14:12, color:C.muted }}>{label}</div>
      {sub && <div style={{ fontFamily:"Barlow", fontSize:10, color:C.dim, marginTop:1 }}>{sub}</div>}
    </div>
    <span style={{ fontFamily:"Barlow Condensed", fontSize:big?22:15, fontWeight:big?700:600, color:color||C.txt }}>{value}</span>
  </div>
);

export default function KalkulatorView() {
  const isMobile = useIsMobile();
  const [ek,        setEk]        = useState("9.00");
  const [verpack,   setVerpack]   = useState("0.50");
  const [versand,   setVersand]   = useState("0.00");
  const [shopifyP,  setShopifyP]  = useState("2.0");    // % Shopify-Gebühr
  const [shopifyF,  setShopifyF]  = useState("0.30");   // Fixgebühr pro Transaktion
  const [sonstiges, setSonstiges] = useState("0.00");
  const [marge,     setMarge]     = useState("60");     // Gewünschte Marge %
  const [mwst,      setMwst]      = useState("klein");  // klein | 19

  const mwstSatz = mwst === "19" ? 0.19 : 0;

  // Fixe Kosten ohne Shopify-Gebühr (die hängt vom VK ab)
  const fixKosten = fN(ek) + fN(verpack) + fN(versand) + fN(sonstiges);

  // VK berechnen: VK = (fixKosten + shopifyF) / (1 - shopifyP/100 - marge/100)
  const shopifyPRatio = fN(shopifyP) / 100;
  const margePRatio   = fN(marge) / 100;
  const divisor       = 1 - shopifyPRatio - margePRatio;

  let vkNetto = 0, vkBrutto = 0, shopifyGesamt = 0, gewinn = 0, margin = 0;
  if (divisor > 0) {
    vkNetto      = (fixKosten + fN(shopifyF)) / divisor;
    shopifyGesamt = vkNetto * shopifyPRatio + fN(shopifyF);
    gewinn       = vkNetto - fixKosten - shopifyGesamt;
    margin       = vkNetto > 0 ? (gewinn / vkNetto) * 100 : 0;
    vkBrutto     = mwst === "19" ? vkNetto * (1 + mwstSatz) : vkNetto;
  }

  // Empfehlungen bei verschiedenen Margen
  const empfehlung = [50, 60, 70].map(m => {
    const d = 1 - shopifyPRatio - m/100;
    if (d <= 0) return null;
    const vk  = (fixKosten + fN(shopifyF)) / d;
    const sh  = vk * shopifyPRatio + fN(shopifyF);
    const g   = vk - fixKosten - sh;
    const vkB = mwst === "19" ? vk * 1.19 : vk;
    return { marge:m, vk:vkB, gewinn:g };
  }).filter(Boolean);

  const gesamtKosten = fixKosten + shopifyGesamt;
  const breakEven    = divisor > 0 ? (fixKosten + fN(shopifyF)) / (1 - shopifyPRatio) : 0;

  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <h2 style={{ fontFamily:"Bebas Neue", fontSize:30, color:C.txt, letterSpacing:"2px" }}>PRODUKTKOSTEN-KALKULATOR</h2>
        <p style={{ fontFamily:"Barlow", fontSize:12, color:C.muted, marginTop:3 }}>Berechne deinen echten Gewinn und finde den optimalen VK-Preis</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>

        {/* ── Eingaben ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <div style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:14, paddingBottom:7, borderBottom:`1px solid ${C.bdr}` }}>Kosten pro Stück</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
              <Fld label="EK-Preis (€)"       value={ek}        onChange={setEk}        hint="€"/>
              <Fld label="Verpackung (€)"      value={verpack}   onChange={setVerpack}   hint="€"/>
              <Fld label="Versandkosten (€)"   value={versand}   onChange={setVersand}   hint="€"/>
              <Fld label="Sonstiges (€)"       value={sonstiges} onChange={setSonstiges} hint="€"/>
            </div>
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <div style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:14, paddingBottom:7, borderBottom:`1px solid ${C.bdr}` }}>Shopify & Steuern</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:12 }}>
              <Fld label="Shopify-Gebühr (%)" value={shopifyP} onChange={setShopifyP} hint="%"/>
              <Fld label="Transaktionsgebühr" value={shopifyF} onChange={setShopifyF} hint="€"/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.8px" }}>Steuer</label>
              <select value={mwst} onChange={e=>setMwst(e.target.value)} style={{ background:C.card2, border:`1px solid ${C.bdr}`, color:C.txt, borderRadius:6, padding:"8px 10px", fontFamily:"Barlow", fontSize:13 }}>
                <option value="klein">Kleinunternehmer (keine MwSt.)</option>
                <option value="19">Regelbesteuerung (19% MwSt.)</option>
              </select>
            </div>
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <div style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:10, paddingBottom:7, borderBottom:`1px solid ${C.bdr}` }}>Gewünschte Marge: <span style={{ color:C.red }}>{marge}%</span></div>
            <input type="range" min="20" max="80" value={marge} onChange={e=>setMarge(e.target.value)}
              style={{ width:"100%", accentColor:C.red, cursor:"pointer" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"Barlow", fontSize:10, color:C.dim, marginTop:4 }}>
              <span>20% (günstig)</span><span>50%</span><span>80% (premium)</span>
            </div>
          </div>
        </div>

        {/* ── Ergebnisse ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Hauptergebnis */}
          <div style={{ background:C.card, border:`2px solid ${C.red}44`, borderRadius:8, padding:"16px 20px" }}>
            <div style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:14, paddingBottom:7, borderBottom:`1px solid ${C.bdr}` }}>Empfohlener VK-Preis</div>
            <div style={{ textAlign:"center", padding:"16px 0" }}>
              <div style={{ fontFamily:"Bebas Neue", fontSize:isMobile?42:52, color:C.red, letterSpacing:"2px", lineHeight:1 }}>
                {fmt(vkBrutto).replace(" €","")}
              </div>
              <div style={{ fontFamily:"Barlow Condensed", fontSize:16, color:C.red, marginTop:2 }}>€ {mwst==="19"?"(inkl. 19% MwSt.)":""}</div>
              <div style={{ fontFamily:"Barlow", fontSize:12, color:C.muted, marginTop:8 }}>bei {marge}% Marge</div>
            </div>
            <div style={{ background:C.card2, borderRadius:6, padding:"12px 14px", marginTop:4 }}>
              <Result label="Gesamtkosten"      value={fmt(gesamtKosten)} color={C.red}/>
              <Result label="davon Shopify"     value={fmt(shopifyGesamt)} color={C.muted} sub={`${shopifyP}% + ${fmt(shopifyF)} fix`}/>
              <Result label="Gewinn pro Stück"  value={fmt(gewinn)} color={C.grn} big/>
              <Result label="Tatsächliche Marge" value={`${margin.toFixed(1)}%`} color={C.grn}/>
              <Result label="Break-Even ab"     value={fmt(breakEven)} color={C.ylw} sub="Kein Verlust ab diesem Preis"/>
            </div>
          </div>

          {/* Margen-Vergleich */}
          <div style={{ background:C.card, border:`1px solid ${C.bdr}`, borderRadius:8, padding:"16px 20px" }}>
            <div style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:12, paddingBottom:7, borderBottom:`1px solid ${C.bdr}` }}>VK-Preisvergleich</div>
            {empfehlung.map(e => (
              <div key={e.marge} onClick={() => setMarge(String(e.marge))}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:7, marginBottom:6, background:parseInt(marge)===e.marge?C.red+"22":C.card2, border:`1px solid ${parseInt(marge)===e.marge?C.red+"44":C.bdr}`, cursor:"pointer" }}>
                <div>
                  <div style={{ fontFamily:"Barlow Condensed", fontSize:14, fontWeight:700, color:C.txt }}>{e.marge}% Marge</div>
                  <div style={{ fontFamily:"Barlow", fontSize:11, color:C.muted }}>Gewinn: {fmt(e.gewinn)}/Stk</div>
                </div>
                <div style={{ fontFamily:"Bebas Neue", fontSize:22, color:parseInt(marge)===e.marge?C.red:C.txt, letterSpacing:"1px" }}>{fmt(e.vk)}</div>
              </div>
            ))}
          </div>

          {/* Hinweis */}
          <div style={{ background:C.card2, border:`1px solid ${C.bdr}`, borderRadius:7, padding:"12px 14px", display:"flex", gap:10 }}>
            <Info size={14} color={C.muted} style={{ flexShrink:0, marginTop:2 }}/>
            <div style={{ fontFamily:"Barlow", fontSize:11, color:C.muted, lineHeight:1.6 }}>
              Shopify Basic: 2% externe Zahlungen oder 0% mit Shopify Payments. Kreditkarten-Gebühren (ca. 1.75-2%) kommen hinzu. Diese Kalkulation ist eine Orientierung.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
