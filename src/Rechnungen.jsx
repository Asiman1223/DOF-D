import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Check, FileText, AlertTriangle, Eye, X, ZoomIn } from "lucide-react";

function getGeminiKey() { return localStorage.getItem("dof_gemini_key") || ""; }

const C = {
  bg:"#080808", panel:"#0d0d0d", card:"#111111", card2:"#171717",
  bdr:"#222222", red:"#e11d48", grn:"#22c55e", ylw:"#f59e0b",
  blu:"#3b82f6", txt:"#f0f0f0", muted:"#888888", dim:"#444444"
};
const fmt  = n => `${parseFloat(n||0).toFixed(2).replace(".",",")} €`;
const CATS = ["Wareneinkauf","Versandmaterial","Werbung","Shopify","Domain","Sonstiges"];
const CC   = { Wareneinkauf:C.blu, Versandmaterial:C.ylw, Werbung:C.red, Shopify:"#6366f1", Domain:C.grn, Sonstiges:C.muted };

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// Bild komprimieren bevor es gespeichert wird (max 1000px, JPEG 75%)
function compressImage(dataUrl, maxW = 1000) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio  = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = img.width  * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Bild-Viewer Modal
function ImageModal({ src, fileName, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ position:"relative", maxWidth:"90vw", maxHeight:"90vh" }}>
        <button onClick={onClose} style={{ position:"absolute", top:-14, right:-14, background:C.red, border:"none", borderRadius:"50%", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", zIndex:1 }}>
          <X size={14} color="#fff"/>
        </button>
        <img src={src} alt={fileName} style={{ maxWidth:"100%", maxHeight:"85vh", borderRadius:8, display:"block", objectFit:"contain" }}/>
        <div style={{ fontFamily:"Barlow", fontSize:11, color:C.muted, textAlign:"center", marginTop:8 }}>{fileName}</div>
      </div>
    </div>
  );
}

export default function RechnungenView({ expenses, setExpenses, invoices, setInvoices }) {
  const isMobile = useIsMobile();
  const [preview,   setPreview]   = useState(null);   // Vorschau im Upload-Bereich
  const [fileName,  setFileName]  = useState("");
  const [fileType,  setFileType]  = useState("");
  const [base64,    setBase64]    = useState("");      // Roh-Base64 für Gemini
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState(null);
  const [drag,      setDrag]      = useState(false);
  const [viewImg,   setViewImg]   = useState(null);   // {src, fileName} für Modal
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput,     setKeyInput]     = useState("");
  const fileRef = useRef();

  // ── Datei laden ──────────────────────────────────────────────────────
  const loadFile = (file) => {
    if (!file) return;
    setExtracted(null); setSaved(false); setError(null);
    setFileName(file.name); setFileType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      setBase64(e.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0]); };

  // ── Gemini — verbesserter Prompt ─────────────────────────────────────
  const analyze = async () => {
    if (!base64) return;
    const key = getGeminiKey();
    if (!key) {
      setShowKeyInput(true);
      return;
    }
    setAnalyzing(true); setError(null);

    const prompt = `Du bist ein professioneller Rechnungsscanner für ein deutsches Unternehmen.
Analysiere dieses Bild/Dokument sehr genau und extrahiere folgende Informationen.

Regeln:
- "betrag": NUR der GESAMTBETRAG / Endbetrag / Total (inkl. MwSt.) als reine Zahl in Euro. NICHT Zwischensummen oder einzelne Posten.
- "datum": Das Rechnungsdatum im Format YYYY-MM-DD. Falls nicht erkennbar: heutiges Datum.
- "haendler": Name des Unternehmens / Shops / Anbieters der Rechnung.
- "kategorie": Wähle exakt eine dieser Optionen basierend auf dem Inhalt:
  * "Wareneinkauf" → Kleidung, Textilien, Produkte zum Wiederverkauf
  * "Versandmaterial" → Pakete, Kartons, Klebeband, Versand
  * "Werbung" → Meta Ads, Google Ads, Instagram, Marketing
  * "Shopify" → Shopify Abo, Shopify Apps
  * "Domain" → Hosting, Domain, Website
  * "Sonstiges" → alles andere
- "notiz": Kurze präzise Beschreibung was gekauft wurde (max. 60 Zeichen).

Antworte AUSSCHLIESSLICH mit diesem JSON, kein Text davor oder danach:
{"betrag":ZAHL,"datum":"YYYY-MM-DD","haendler":"NAME","kategorie":"KATEGORIE","notiz":"BESCHREIBUNG"}`;

    try {
      const res = await fetch("/api/analyze-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType: fileType || "image/jpeg", apiKey: getGeminiKey() })
      });
      const data = await res.json();
      if (!data.ok) {
        const isAuth = ["credential","401","api key","authentication"].some(w => (data.error||"").toLowerCase().includes(w));
        if (isAuth) {
          localStorage.removeItem("dof_gemini_key");
          setError("API Key ungültig. Bitte neuen Key eingeben.");
          setShowKeyInput(true);
        } else {
          setError(`Fehler: ${data.error}`);
          setExtracted({ amount:"", date: new Date().toISOString().slice(0,10), category:"Sonstiges", note: fileName });
        }
      } else {
        setExtracted({
          amount:   String(data.betrag || ""),
          date:     data.datum || new Date().toISOString().slice(0,10),
          category: CATS.includes(data.kategorie) ? data.kategorie : "Sonstiges",
          note:     [data.haendler, data.notiz].filter(Boolean).join(" – "),
        });
      }
    } catch(e) {
      setError("Verbindungsfehler: " + e.message);
      setExtracted({ amount:"", date: new Date().toISOString().slice(0,10), category:"Sonstiges", note: fileName });
    }
    setAnalyzing(false);
  };

  // ── Speichern ────────────────────────────────────────────────────────
  const save = async () => {
    if (!extracted?.amount) return;

    // Bild komprimieren für Archiv (nur bei echten Bildern, nicht PDF)
    let storedImage = null;
    if (preview && fileType !== "application/pdf") {
      storedImage = await compressImage(preview);
    }

    const id = `inv_${Date.now()}`;

    // In Ausgaben
    setExpenses(prev => [{
      id, category: extracted.category,
      amount: parseFloat(extracted.amount) || 0,
      date: extracted.date, note: extracted.note,
    }, ...prev]);

    // In Archiv (mit Bild)
    setInvoices(prev => [{
      id, fileName, fileType,
      date:     extracted.date,
      amount:   parseFloat(extracted.amount) || 0,
      note:     extracted.note,
      category: extracted.category,
      image:    storedImage,   // komprimiertes Bild
      savedAt:  new Date().toISOString(),
    }, ...prev]);

    setSaved(true);
    setPreview(null); setBase64(""); setFileName(""); setExtracted(null);
    setTimeout(() => setSaved(false), 3000);
  };

  const del = id => setInvoices(prev => prev.filter(i => i.id !== id));
  const totalInv = invoices.reduce((a,i) => a + i.amount, 0);

  const saveKey = () => {
    if (!keyInput.trim()) return;
    localStorage.setItem("dof_gemini_key", keyInput.trim());
    setShowKeyInput(false);
    setKeyInput("");
    // Auto-start analysis after saving key
    setTimeout(() => analyze(), 100);
  };

  const C2 = { bg:"#080808", panel:"#0d0d0d", card:"#111111", card2:"#171717", bdr:"#222222", red:"#e11d48", txt:"#f0f0f0", muted:"#888888" };

  return (
    <div>
      {/* Gemini Key Modal */}
      {showKeyInput && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}}>
          <div style={{background:C2.panel,border:`1px solid ${C2.bdr}`,borderRadius:12,padding:"24px",width:340,maxWidth:"90vw"}}>
            <div style={{fontFamily:"Barlow Condensed",fontSize:16,fontWeight:700,color:C2.txt,marginBottom:6}}>Gemini API Key</div>
            <div style={{fontFamily:"Barlow",fontSize:12,color:C2.muted,marginBottom:10}}>
              <strong style={{color:C2.txt,fontFamily:"Barlow Condensed",fontSize:13}}>Option 1 — Groq (100% kostenlos, empfohlen):</strong><br/>
              <span style={{color:"#22c55e"}}>console.groq.com</span> → "Create API Key" → Key fängt mit <strong style={{color:C2.txt}}>gsk_</strong> an
            </div>
            <div style={{fontFamily:"Barlow",fontSize:12,color:C2.muted,marginBottom:14}}>
              <strong style={{color:C2.txt,fontFamily:"Barlow Condensed",fontSize:13}}>Option 2 — Google Gemini:</strong><br/>
              aistudio.google.com → Key fängt mit <strong style={{color:C2.txt}}>AIzaSy</strong> an
            </div>
            <input
              autoFocus
              type="text"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveKey()}
              placeholder="AIza..."
              style={{width:"100%",background:C2.card2,border:`1px solid ${C2.bdr}`,color:C2.txt,borderRadius:6,padding:"10px 12px",fontFamily:"Barlow",fontSize:13,marginBottom:12}}
            />
            <div style={{display:"flex",gap:9}}>
              <button onClick={() => setShowKeyInput(false)} style={{flex:1,background:"transparent",border:`1px solid ${C2.bdr}`,color:C2.muted,borderRadius:6,padding:"9px",fontFamily:"Barlow",fontSize:13,cursor:"pointer"}}>Abbrechen</button>
              <button onClick={saveKey} style={{flex:2,background:C2.red,border:"none",color:"#fff",borderRadius:6,padding:"9px",fontFamily:"Barlow Condensed",fontSize:14,fontWeight:700,letterSpacing:"0.5px",cursor:"pointer"}}>Speichern & Analysieren</button>
            </div>
          </div>
        </div>
      )}
      {viewImg && <ImageModal src={viewImg.src} fileName={viewImg.fileName} onClose={() => setViewImg(null)}/>}

      <div style={{marginBottom:22}}>
        <h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px"}}>RECHNUNGEN</h2>
        <p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,marginTop:3}}>Rechnung hochladen → KI erkennt Betrag, Datum & Kategorie automatisch</p>
      </div>

      {saved && (
        <div style={{background:"#081a0e",border:`1px solid ${C.grn}44`,borderRadius:7,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
          <Check size={14} color={C.grn}/>
          <span style={{fontFamily:"Barlow",fontSize:12,color:C.grn}}>Gespeichert! Ausgabe wurde automatisch eingetragen.</span>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:20}}>

        {/* ── Links: Upload + Vorschau ── */}
        <div>
          <div
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={onDrop}
            onClick={()=>fileRef.current.click()}
            style={{border:`2px dashed ${drag?C.red:C.bdr}`,borderRadius:10,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:drag?C.red+"0a":C.card,transition:"all 0.2s",marginBottom:12}}
          >
            <Upload size={26} color={drag?C.red:C.dim} style={{margin:"0 auto 10px"}}/>
            <div style={{fontFamily:"Barlow Condensed",fontSize:14,color:C.txt,marginBottom:4}}>Rechnung hier reinziehen</div>
            <div style={{fontFamily:"Barlow",fontSize:11,color:C.muted}}>oder klicken · JPG, PNG, PDF</div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>loadFile(e.target.files[0])}/>
          </div>

          {preview && (
            <div style={{background:C.card2,borderRadius:8,padding:10,marginBottom:12}}>
              {fileType==="application/pdf"
                ? <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 4px"}}><FileText size={22} color={C.red}/><span style={{fontFamily:"Barlow",fontSize:13,color:C.txt}}>{fileName}</span></div>
                : <img src={preview} alt="Rechnung" style={{width:"100%",borderRadius:6,maxHeight:200,objectFit:"contain"}}/>
              }
              <div style={{fontFamily:"Barlow",fontSize:10,color:C.muted,marginTop:6}}>{fileName}</div>
            </div>
          )}

          {/* Key zurücksetzen */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontFamily:"Barlow",fontSize:10,color:"#444"}}>Gemini KI</span>
            <button onClick={()=>{localStorage.removeItem("dof_gemini_key");setShowKeyInput(true);}} style={{background:"transparent",border:"none",color:"#e11d48",fontFamily:"Barlow",fontSize:11,cursor:"pointer",textDecoration:"underline"}}>
              🔑 API Key {localStorage.getItem("dof_gemini_key") ? "ändern" : "eingeben"}
            </button>
          </div>
          {preview && !extracted && (
            <button onClick={analyze} disabled={analyzing} style={{width:"100%",background:analyzing?C.card2:C.red,color:"#fff",border:"none",borderRadius:7,padding:"11px",fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,letterSpacing:"1px",cursor:analyzing?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {analyzing
                ? <><span style={{display:"inline-block",animation:"spin 1s linear infinite",fontSize:16}}>⟳</span> KI analysiert…</>
                : <><ZoomIn size={14}/> Automatisch auslesen</>}
            </button>
          )}
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>

        {/* ── Rechts: Erkannte Daten ── */}
        <div>
          {!extracted && !analyzing && (
            <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"40px 20px",textAlign:"center",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}}>
              <ZoomIn size={30} color={C.dim}/>
              <div style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>Lade eine Rechnung hoch und klicke auf "Automatisch auslesen"</div>
            </div>
          )}

          {extracted && (
            <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:10,padding:18}}>
              <div style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:12}}>
                Erkannte Daten {error&&<span style={{color:C.ylw}}> — bitte prüfen</span>}
              </div>

              {error&&<div style={{background:"#1e1200",border:`1px solid ${C.ylw}44`,borderRadius:6,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:7}}><AlertTriangle size={12} color={C.ylw}/><span style={{fontFamily:"Barlow",fontSize:11,color:C.ylw}}>{error}</span></div>}

              {[
                {label:"Betrag (€)", key:"amount", type:"number", big:true},
                {label:"Datum",      key:"date",   type:"date"},
              ].map(({label,key,type,big})=>(
                <div key={key} style={{marginBottom:11}}>
                  <label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px",display:"block",marginBottom:4}}>{label}</label>
                  <input type={type} value={extracted[key]} onChange={e=>setExtracted(x=>({...x,[key]:e.target.value}))}
                    style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow Condensed",fontSize:big?20:13,fontWeight:big?700:400}}/>
                </div>
              ))}

              <div style={{marginBottom:11}}>
                <label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px",display:"block",marginBottom:4}}>Kategorie</label>
                <select value={extracted.category} onChange={e=>setExtracted(x=>({...x,category:e.target.value}))} style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:13}}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{marginBottom:16}}>
                <label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.8px",display:"block",marginBottom:4}}>Notiz</label>
                <input value={extracted.note} onChange={e=>setExtracted(x=>({...x,note:e.target.value}))} style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"8px 10px",fontFamily:"Barlow",fontSize:13}}/>
              </div>

              <button onClick={save} disabled={!extracted.amount} style={{width:"100%",background:extracted.amount?C.grn+"22":C.card2,color:extracted.amount?C.grn:C.dim,border:`1px solid ${extracted.amount?C.grn+"44":C.bdr}`,borderRadius:7,padding:"11px",fontFamily:"Barlow Condensed",fontSize:15,fontWeight:700,letterSpacing:"1px",cursor:extracted.amount?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                <Check size={14}/> In Ausgaben speichern
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Archiv ── */}
      <div>
        <div style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10,paddingBottom:7,borderBottom:`1px solid ${C.bdr}`,display:"flex",justifyContent:"space-between"}}>
          <span>Rechnungsarchiv ({invoices.length})</span>
          <span style={{color:C.txt}}>Gesamt: {fmt(totalInv)}</span>
        </div>

        {invoices.length===0
          ? <div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontFamily:"Barlow",fontSize:13}}>Noch keine Rechnungen gespeichert</div>
          : <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {invoices.map(inv=>(
                <div key={inv.id} style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:isMobile?"wrap":"nowrap"}}>
                  {/* Vorschau-Thumbnail */}
                  {inv.image
                    ? <img src={inv.image} alt="" onClick={()=>setViewImg({src:inv.image,fileName:inv.fileName})}
                        style={{width:44,height:44,objectFit:"cover",borderRadius:5,cursor:"pointer",flexShrink:0,border:`1px solid ${C.bdr}`}}/>
                    : <div style={{width:44,height:44,background:(CC[inv.category]||C.muted)+"22",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <FileText size={18} color={CC[inv.category]||C.muted}/>
                      </div>
                  }
                  <div style={{flex:1,minWidth:isMobile?190:0}}>
                    <div style={{fontFamily:"Barlow Condensed",fontSize:13,fontWeight:700,color:C.txt,marginBottom:2}}>{inv.note||inv.fileName}</div>
                    <div style={{fontFamily:"Barlow",fontSize:11,color:C.muted}}>{inv.date} · {inv.category} · {inv.fileName}</div>
                  </div>
                  <div style={{fontFamily:"Barlow Condensed",fontSize:17,fontWeight:700,color:C.red,minWidth:80,textAlign:"right"}}>{fmt(inv.amount)}</div>
                  <div style={{display:"flex",gap:6}}>
                    {inv.image&&(
                      <button onClick={()=>setViewImg({src:inv.image,fileName:inv.fileName})} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.muted,borderRadius:5,padding:"5px 8px",cursor:"pointer",display:"flex",alignItems:"center"}}>
                        <Eye size={12}/>
                      </button>
                    )}
                    <button onClick={()=>del(inv.id)} style={{background:"#200810",border:`1px solid #3a0a12`,color:C.red,borderRadius:5,padding:"5px 8px",cursor:"pointer",display:"flex",alignItems:"center"}}>
                      <Trash2 size={11}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
