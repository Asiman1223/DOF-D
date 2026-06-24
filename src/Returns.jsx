import { useEffect, useMemo, useState } from "react";
import { Check, Edit2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

const C = {
  bg:"#050505", panel:"#090909", card:"#10100f", card2:"#151513",
  bdr:"#2a2925", red:"#ff304f", grn:"#38d970", ylw:"#f8b938",
  blu:"#5aa7ff", txt:"#f4f1e8", muted:"#a09a8c", dim:"#5a554c",
  line:"#37342d"
};

const STATUS = {
  new: ["Eingegangen", C.red],
  checking: ["Pruefen", C.blu],
  waiting_item: ["Ware erwartet", C.ylw],
  refunded: ["Erstattet", C.grn],
  rejected: ["Abgelehnt", "#ff7b7b"],
};

const REFUND = {
  open: ["Offen", C.red],
  partial: ["Teilweise", C.ylw],
  done: ["Erledigt", C.grn],
};

const REASONS = [
  "Falsche Groesse",
  "Aus Versehen bestellt",
  "Artikel gefaellt nicht",
  "Lieferung zu spaet",
  "Defekt oder Qualitaetsproblem",
  "Doppelt bestellt",
  "Sonstiges",
];

const emptyReturn = {
  customerName: "",
  email: "",
  orderNumber: "",
  product: "",
  reason: "Falsche Groesse",
  status: "new",
  refundStatus: "open",
  refundAmount: "",
  submittedAt: new Date().toISOString().slice(0, 10),
  receivedAt: "",
  note: "",
};

function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function eur(value) {
  const n = Number(String(value || "0").replace(",", "."));
  return `${n.toFixed(2).replace(".", ",")} EUR`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("de-DE", { day:"2-digit", month:"2-digit", year:"2-digit" });
}

function Card({ children, style }) {
  return (
    <div style={{
      background:`linear-gradient(180deg, ${C.card}, #0c0c0b)`,
      border:`1px solid ${C.bdr}`,
      borderRadius:8,
      padding:16,
      boxShadow:"0 16px 42px rgba(0,0,0,.24)",
      ...style
    }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style }) {
  const styles = {
    primary: { background:`linear-gradient(180deg, ${C.red}, #b90d27)`, color:"#fff", border:"1px solid #ff5a70" },
    ghost: { background:"#11100e", color:C.txt, border:`1px solid ${C.line}` },
    danger: { background:"#21070d", color:"#ff6b81", border:"1px solid #4d1220" },
    success: { background:"#071a0d", color:C.grn, border:"1px solid #17472a" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...styles[variant],
      borderRadius:6,
      padding:"8px 12px",
      fontFamily:"Barlow",
      fontWeight:700,
      fontSize:12,
      display:"inline-flex",
      alignItems:"center",
      gap:6,
      opacity:disabled ? .55 : 1,
      cursor:disabled ? "default" : "pointer",
      minHeight:34,
      whiteSpace:"nowrap",
      ...style,
    }}>
      {children}
    </button>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{
      background:color+"18",
      color,
      border:`1px solid ${color}55`,
      borderRadius:4,
      padding:"3px 7px",
      fontSize:10,
      fontFamily:"Barlow Condensed",
      fontWeight:700,
      letterSpacing:".6px",
      whiteSpace:"nowrap"
    }}>
      {children}
    </span>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder, style }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4, ...style }}>
      <label style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1px" }}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ background:C.card2, border:`1px solid ${C.line}`, color:C.txt, borderRadius:6, padding:"9px 10px", fontFamily:"Barlow", fontSize:13, minHeight:38 }}>
          {options.map(option => (
            <option key={typeof option === "object" ? option.value : option} value={typeof option === "object" ? option.value : option}>
              {typeof option === "object" ? option.label : option}
            </option>
          ))}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ background:C.card2, border:`1px solid ${C.line}`, color:C.txt, borderRadius:6, padding:"9px 10px", fontFamily:"Barlow", fontSize:13, minHeight:38 }} />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.8)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:12 }}>
      <div style={{ background:`linear-gradient(180deg, #12110f, ${C.panel})`, border:`1px solid ${C.line}`, borderRadius:8, width:760, maxWidth:"100%", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 26px 80px rgba(0,0,0,.55)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"15px 18px", borderBottom:`1px solid ${C.line}` }}>
          <h3 style={{ fontFamily:"Barlow Condensed", fontSize:18, fontWeight:700, color:C.txt, textTransform:"uppercase", letterSpacing:".7px", margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ color:C.muted, cursor:"pointer", background:"transparent", border:0 }}><X size={17}/></button>
        </div>
        <div style={{ padding:18 }}>{children}</div>
      </div>
    </div>
  );
}

export default function ReturnsView({ returns = [], setReturns }) {
  const isMobile = useIsMobile();
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyReturn);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [refund, setRefund] = useState("all");

  const list = useMemo(() => {
    return [...returns]
      .sort((a, b) => new Date(b.createdAt || b.submittedAt || 0) - new Date(a.createdAt || a.submittedAt || 0))
      .filter(item => {
        const hay = [item.customerName, item.email, item.orderNumber, item.product, item.reason, item.note].join(" ").toLowerCase();
        return (!query || hay.includes(query.toLowerCase()))
          && (status === "all" || (item.status || "new") === status)
          && (refund === "all" || (item.refundStatus || "open") === refund);
      });
  }, [returns, query, status, refund]);

  const stats = useMemo(() => {
    return returns.reduce((acc, item) => {
      const st = item.status || "new";
      const rf = item.refundStatus || "open";
      acc.status[st] = (acc.status[st] || 0) + 1;
      acc.refund[rf] = (acc.refund[rf] || 0) + 1;
      acc.refundOpenValue += rf !== "done" ? Number(String(item.refundAmount || "0").replace(",", ".")) || 0 : 0;
      return acc;
    }, { status:{}, refund:{}, refundOpenValue:0 });
  }, [returns]);

  function openNew() {
    setEditingId("");
    setForm({ ...emptyReturn, submittedAt: new Date().toISOString().slice(0, 10) });
    setModal(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm({ ...emptyReturn, ...item, submittedAt: (item.submittedAt || "").slice(0, 10), receivedAt: (item.receivedAt || "").slice(0, 10) });
    setModal(true);
  }

  function save() {
    if (!form.customerName.trim() || !form.orderNumber.trim()) return;
    const now = new Date().toISOString();
    const next = {
      ...form,
      id: editingId || uid(),
      createdAt: form.createdAt || now,
      updatedAt: now,
    };
    setReturns(prev => editingId ? prev.map(item => item.id === editingId ? next : item) : [next, ...prev]);
    setModal(false);
  }

  function remove(id) {
    if (!window.confirm("Retoure wirklich loeschen?")) return;
    setReturns(prev => prev.filter(item => item.id !== id));
  }

  function patch(id, data) {
    setReturns(prev => prev.map(item => item.id === id ? { ...item, ...data, updatedAt:new Date().toISOString() } : item));
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:22}}>
        <div>
          <h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px",margin:0}}>RETOUREN & WIDERRUF</h2>
          <p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,margin:"3px 0 0"}}>Widerrufe, Ruecksendungen, Rueckerstattungen und interne Notizen</p>
        </div>
        <Button onClick={openNew}><Plus size={13}/> Neue Retoure</Button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <Card>
          <div style={{fontFamily:"Barlow Condensed",fontSize:11,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Gesamt</div>
          <div style={{fontFamily:"Barlow Condensed",fontSize:29,fontWeight:700,color:C.txt,marginTop:4}}>{returns.length}</div>
        </Card>
        <Card>
          <div style={{fontFamily:"Barlow Condensed",fontSize:11,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Neu / Pruefen</div>
          <div style={{fontFamily:"Barlow Condensed",fontSize:29,fontWeight:700,color:C.red,marginTop:4}}>{(stats.status.new || 0) + (stats.status.checking || 0)}</div>
        </Card>
        <Card>
          <div style={{fontFamily:"Barlow Condensed",fontSize:11,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Rueckzahlung offen</div>
          <div style={{fontFamily:"Barlow Condensed",fontSize:29,fontWeight:700,color:C.ylw,marginTop:4}}>{stats.refund.open || 0}</div>
        </Card>
        <Card>
          <div style={{fontFamily:"Barlow Condensed",fontSize:11,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Offener Betrag</div>
          <div style={{fontFamily:"Barlow Condensed",fontSize:29,fontWeight:700,color:C.grn,marginTop:4}}>{eur(stats.refundOpenValue)}</div>
        </Card>
      </div>

      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr 1fr",gap:10}}>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Kunde, Bestellnummer, Produkt suchen..." style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px 9px 31px",fontFamily:"Barlow",fontSize:13}}/>
          </div>
          <select value={status} onChange={e=>setStatus(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px",fontFamily:"Barlow",fontSize:13}}>
            <option value="all">Alle Status</option>
            {Object.entries(STATUS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={refund} onChange={e=>setRefund(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px",fontFamily:"Barlow",fontSize:13}}>
            <option value="all">Alle Rueckzahlungen</option>
            {Object.entries(REFUND).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </Card>

      <div style={{display:"grid",gap:10}}>
        {list.map(item => {
          const st = item.status || "new";
          const rf = item.refundStatus || "open";
          return (
            <Card key={item.id} style={{padding:isMobile?13:15}}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.2fr .8fr .85fr .95fr auto",gap:12,alignItems:"center"}}>
                <div>
                  <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:5}}>
                    <strong style={{fontFamily:"Barlow Condensed",fontSize:18,color:C.txt,letterSpacing:".4px"}}>{item.customerName || "Ohne Name"}</strong>
                    <Badge color={STATUS[st]?.[1] || C.muted}>{STATUS[st]?.[0] || st}</Badge>
                    <Badge color={REFUND[rf]?.[1] || C.muted}>Rueckzahlung {REFUND[rf]?.[0] || rf}</Badge>
                  </div>
                  <div style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>{item.email || "-"} · Bestellung {item.orderNumber || "-"}</div>
                  <div style={{fontFamily:"Barlow",fontSize:11,color:C.dim,marginTop:4}}>Eingang: {formatDate(item.submittedAt || item.createdAt)}</div>
                </div>
                <div>
                  <div style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Produkt</div>
                  <div style={{fontFamily:"Barlow",fontSize:12,color:C.txt,marginTop:3}}>{item.product || "-"}</div>
                </div>
                <div>
                  <div style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Grund</div>
                  <div style={{fontFamily:"Barlow",fontSize:12,color:C.txt,marginTop:3}}>{item.reason || "-"}</div>
                </div>
                <div>
                  <div style={{fontFamily:"Barlow Condensed",fontSize:10,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>Betrag / Notiz</div>
                  <div style={{fontFamily:"Barlow",fontSize:12,color:C.txt,marginTop:3}}>{item.refundAmount ? eur(item.refundAmount) : "-"}{item.note ? ` · ${item.note}` : ""}</div>
                </div>
                <div style={{display:"flex",gap:6,justifyContent:isMobile?"flex-start":"flex-end",flexWrap:"wrap"}}>
                  <Button variant="success" onClick={()=>patch(item.id, { refundStatus:"done", status:"refunded" })}><Check size={12}/> Erledigt</Button>
                  <Button variant="ghost" onClick={()=>openEdit(item)}><Edit2 size={12}/></Button>
                  <Button variant="danger" onClick={()=>remove(item.id)}><Trash2 size={12}/></Button>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
                {Object.entries(STATUS).map(([key, [label, color]]) => (
                  <button key={key} onClick={()=>patch(item.id, { status:key })} style={{background:st===key?color+"22":"transparent",border:`1px solid ${st===key?color+"55":C.bdr}`,color:st===key?color:C.muted,borderRadius:5,padding:"4px 8px",fontFamily:"Barlow Condensed",fontSize:11,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
            </Card>
          );
        })}
        {!list.length && (
          <div style={{textAlign:"center",padding:"52px 0",fontFamily:"Barlow",fontSize:13,color:C.muted}}>
            {returns.length ? "Keine Treffer fuer deine Filter." : "Noch keine Widerrufe oder Retouren eingetragen."}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={editingId ? "Retoure bearbeiten" : "Neue Retoure"} onClose={()=>setModal(false)}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
            <Field label="Kunde" value={form.customerName} onChange={v=>setForm(f=>({...f,customerName:v}))} placeholder="Vor- und Nachname" />
            <Field label="E-Mail" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="kunde@email.de" />
            <Field label="Bestellnummer" value={form.orderNumber} onChange={v=>setForm(f=>({...f,orderNumber:v}))} placeholder="#1001" />
            <Field label="Artikel" value={form.product} onChange={v=>setForm(f=>({...f,product:v}))} placeholder="DOF Performance Training T-Shirt, M" />
            <Field label="Grund" value={form.reason} onChange={v=>setForm(f=>({...f,reason:v}))} options={REASONS} />
            <Field label="Status" value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={Object.entries(STATUS).map(([value, [label]])=>({ value, label }))} />
            <Field label="Rueckzahlung" value={form.refundStatus} onChange={v=>setForm(f=>({...f,refundStatus:v}))} options={Object.entries(REFUND).map(([value, [label]])=>({ value, label }))} />
            <Field label="Betrag" type="number" value={form.refundAmount} onChange={v=>setForm(f=>({...f,refundAmount:v}))} placeholder="24.99" />
            <Field label="Eingegangen am" type="date" value={form.submittedAt} onChange={v=>setForm(f=>({...f,submittedAt:v}))} />
            <Field label="Ware angekommen am" type="date" value={form.receivedAt} onChange={v=>setForm(f=>({...f,receivedAt:v}))} />
            <div style={{display:"flex",flexDirection:"column",gap:4,gridColumn:isMobile?"auto":"1 / -1"}}>
              <label style={{fontFamily:"Barlow Condensed",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Notiz</label>
              <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="z.B. Kunde wartet auf Rueckzahlung, Paket noch nicht da..." style={{minHeight:90,background:C.card2,border:`1px solid ${C.line}`,color:C.txt,borderRadius:6,padding:"9px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:16}}>
            <Button variant="ghost" onClick={()=>setModal(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!form.customerName.trim() || !form.orderNumber.trim()}><Check size={13}/> Speichern</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
