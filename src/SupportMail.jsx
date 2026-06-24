import { useEffect, useMemo, useState } from "react";
import { Clock, Mail, RefreshCw, Search, Send } from "lucide-react";

const C = {
  bg:"#050505", panel:"#090909", card:"#10100f", card2:"#151513",
  bdr:"#2a2925", red:"#ff304f", grn:"#38d970", ylw:"#f8b938",
  blu:"#5aa7ff", txt:"#f4f1e8", muted:"#a09a8c", dim:"#5a554c",
  line:"#37342d"
};

const STATUS = {
  new: ["Neu", C.red],
  working: ["In Arbeit", C.blu],
  waiting: ["Warten", C.ylw],
  done: ["Erledigt", C.grn],
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

function Button({ children, onClick, variant = "ghost", disabled }) {
  const styles = {
    ghost: { background:"#11100e", color:C.txt, border:`1px solid ${C.line}` },
    primary: { background:`linear-gradient(180deg, ${C.red}, #b90d27)`, color:"#fff", border:"1px solid #ff5a70" },
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
    }}>{children}</button>
  );
}

function Badge({ children, color }) {
  return <span style={{ background:color+"18", color, border:`1px solid ${color}55`, borderRadius:4, padding:"3px 7px", fontSize:10, fontFamily:"Barlow Condensed", fontWeight:700, letterSpacing:".6px", whiteSpace:"nowrap" }}>{children}</span>;
}

function Card({ children, style }) {
  return <div style={{ background:`linear-gradient(180deg, ${C.card}, #0c0c0b)`, border:`1px solid ${C.bdr}`, borderRadius:8, padding:16, boxShadow:"0 16px 42px rgba(0,0,0,.24)", ...style }}>{children}</div>;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("de-DE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function cleanReplySubject(subject = "") {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`;
}

export default function SupportMailView({ mailMeta = {}, setMailMeta }) {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState("");

  const selected = messages.find(m => m.id === selectedId) || messages[0];
  const selectedMeta = selected ? (mailMeta[selected.id] || {}) : {};

  async function loadMail() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/support-mail?limit=35");
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "E-Mails konnten nicht geladen werden.");
      setMessages(data.messages || []);
      if (!selectedId && data.messages?.[0]) setSelectedId(data.messages[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return messages.filter(msg => {
      const meta = mailMeta[msg.id] || {};
      const st = meta.status || "new";
      const hay = [msg.subject, msg.from, msg.to, msg.preview, meta.note].join(" ").toLowerCase();
      return (statusFilter === "all" || st === statusFilter) && (!query || hay.includes(query.toLowerCase()));
    });
  }, [messages, mailMeta, query, statusFilter]);

  const counts = useMemo(() => {
    return messages.reduce((acc, msg) => {
      const st = mailMeta[msg.id]?.status || "new";
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
  }, [messages, mailMeta]);

  function updateMeta(id, patch) {
    setMailMeta(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch, updatedAt: new Date().toISOString() },
    }));
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    setSentInfo("");
    setError("");
    try {
      const res = await fetch("/api/support-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          to: selected.from,
          subject: cleanReplySubject(selected.subject),
          text: replyText,
          messageId: selected.messageId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Antwort konnte nicht gesendet werden.");
      updateMeta(selected.id, { status: "done", lastReplyAt: new Date().toISOString() });
      setReplyText("");
      setSentInfo("Antwort wurde gesendet.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,gap:12,flexWrap:"wrap"}}>
        <div>
          <h2 style={{fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"2px",margin:0}}>SUPPORT MAILS</h2>
          <p style={{fontFamily:"Barlow",fontSize:12,color:C.muted,margin:"3px 0 0"}}>Postfach support@dofclothes.de lesen, bearbeiten und beantworten</p>
        </div>
        <Button onClick={loadMail} disabled={loading} variant="primary"><RefreshCw size={13} style={{animation:loading ? "spin 1s linear infinite" : "none"}}/> Aktualisieren</Button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {Object.entries(STATUS).map(([key, [label, color]]) => (
          <Card key={key} style={{padding:13}}>
            <div style={{fontFamily:"Barlow Condensed",fontSize:11,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>{label}</div>
            <div style={{fontFamily:"Barlow Condensed",fontSize:28,fontWeight:700,color,marginTop:4}}>{counts[key] || 0}</div>
          </Card>
        ))}
      </div>

      <Card style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr",gap:10}}>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Betreff, Kunde, Nachricht suchen..." style={{width:"100%",background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px 9px 31px",fontFamily:"Barlow",fontSize:13}}/>
          </div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px",fontFamily:"Barlow",fontSize:13}}>
            <option value="all">Alle Status</option>
            {Object.entries(STATUS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </Card>

      {error && <div style={{background:"#22070d",border:`1px solid ${C.red}66`,color:"#ffb6c1",borderRadius:8,padding:"12px 14px",fontFamily:"Barlow",fontSize:13,marginBottom:14}}>Fehler: {error}</div>}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"390px minmax(0,1fr)",gap:14,alignItems:"start"}}>
        <Card style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.bdr}`,fontFamily:"Barlow Condensed",fontSize:13,color:C.txt,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase"}}>{filtered.length} Nachrichten</div>
          <div style={{display:"flex",flexDirection:"column",maxHeight:isMobile?"none":"68vh",overflowY:"auto"}}>
            {filtered.map(msg => {
              const meta = mailMeta[msg.id] || {};
              const st = meta.status || "new";
              const active = selected?.id === msg.id;
              return (
                <button key={msg.id} onClick={() => { setSelectedId(msg.id); setSentInfo(""); }} style={{
                  background:active ? "rgba(255,48,79,.12)" : "transparent",
                  border:0,
                  borderBottom:`1px solid ${C.bdr}`,
                  color:C.txt,
                  textAlign:"left",
                  padding:"12px 14px",
                  cursor:"pointer",
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}>
                    <strong style={{fontFamily:"Barlow Condensed",fontSize:14,color:C.txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg.subject}</strong>
                    <Badge color={STATUS[st]?.[1] || C.muted}>{STATUS[st]?.[0] || st}</Badge>
                  </div>
                  <div style={{fontFamily:"Barlow",fontSize:11,color:C.muted,marginBottom:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg.from}</div>
                  <div style={{fontFamily:"Barlow",fontSize:11,color:C.dim,lineHeight:1.35}}>{msg.preview || "Keine Vorschau"}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",fontFamily:"Barlow",fontSize:10,color:C.dim,marginTop:7}}><Clock size={10}/>{formatDate(msg.date)}</div>
                </button>
              );
            })}
            {!filtered.length && <div style={{fontFamily:"Barlow",fontSize:13,color:C.muted,textAlign:"center",padding:28}}>{loading ? "Lade E-Mails..." : "Keine E-Mails gefunden"}</div>}
          </div>
        </Card>

        <Card style={{minHeight:420}}>
          {!selected ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:360,color:C.muted,fontFamily:"Barlow",fontSize:13}}><Mail size={16}/> <span style={{marginLeft:8}}>Keine Nachricht ausgewählt</span></div>
          ) : (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:12}}>
                <div>
                  <h3 style={{fontFamily:"Barlow Condensed",fontSize:23,color:C.txt,letterSpacing:".4px",margin:"0 0 5px"}}>{selected.subject}</h3>
                  <div style={{fontFamily:"Barlow",fontSize:12,color:C.muted}}>Von: {selected.from}</div>
                  <div style={{fontFamily:"Barlow",fontSize:11,color:C.dim,marginTop:3}}>{formatDate(selected.date)}</div>
                </div>
                <Badge color={STATUS[selectedMeta.status || "new"]?.[1] || C.red}>{STATUS[selectedMeta.status || "new"]?.[0] || "Neu"}</Badge>
              </div>

              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                {Object.entries(STATUS).map(([key, [label, color]]) => (
                  <button key={key} onClick={() => updateMeta(selected.id, { status:key })} style={{background:(selectedMeta.status || "new") === key ? color+"22" : "transparent",border:`1px solid ${color}55`,color,borderRadius:5,padding:"5px 8px",fontFamily:"Barlow Condensed",fontSize:11,cursor:"pointer"}}>{label}</button>
                ))}
              </div>

              <div style={{background:C.card2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:14,whiteSpace:"pre-wrap",fontFamily:"Barlow",fontSize:13,color:C.txt,lineHeight:1.62,maxHeight:360,overflowY:"auto",marginBottom:14}}>
                {selected.text || "Diese E-Mail enthält keinen lesbaren Text."}
              </div>

              <div style={{display:"grid",gap:10,marginBottom:14}}>
                <label style={{fontFamily:"Barlow Condensed",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Interne Notiz</label>
                <textarea value={selectedMeta.note || ""} onChange={e => updateMeta(selected.id, { note:e.target.value })} placeholder="z.B. Rückzahlung prüfen, Kunde wartet auf Antwort..." style={{minHeight:70,background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/>
              </div>

              <div style={{display:"grid",gap:10}}>
                <label style={{fontFamily:"Barlow Condensed",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"1px"}}>Antwort</label>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Antwort an den Kunden schreiben..." style={{minHeight:120,background:C.card2,border:`1px solid ${C.bdr}`,color:C.txt,borderRadius:6,padding:"9px 10px",fontFamily:"Barlow",fontSize:13,resize:"vertical"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{fontFamily:"Barlow",fontSize:12,color:sentInfo ? C.grn : C.dim}}>{sentInfo || "Antwort wird über support@dofclothes.de gesendet."}</div>
                  <Button onClick={sendReply} disabled={sending || !replyText.trim()} variant="success"><Send size={13}/>{sending ? "Sende..." : "Antwort senden"}</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
