import { useState } from "react";

const C = {
  bg:"#050505", panel:"#10100f", bdr:"#2a2925",
  red:"#ff304f", txt:"#f4f1e8", muted:"#a09a8c"
};

export default function Login({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const entered = pw.trim();
    if (!entered || busy) return;

    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: entered }),
      });
      if (!res.ok) throw new Error("login failed");
      localStorage.setItem("dof_auth", "1");
      onLogin();
    } catch {
      setErr(true);
      setPw("");
      setTimeout(() => setErr(false), 600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", padding:"24px", backgroundImage:"linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.018) 1px, transparent 1px)", backgroundSize:"56px 56px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap');
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-10px); }
          40%,80%  { transform: translateX(10px); }
        }
        .shake { animation: shake 0.45s ease; }
        .login-input:focus { border-color: #ff304f !important; box-shadow: 0 0 0 3px rgba(255,48,79,.14); }
        .login-btn:hover { filter: brightness(1.05); }
        @media (max-width: 420px) {
          .login-logo { font-size: 38px !important; letter-spacing: 5px !important; }
          .login-card { width: calc(100vw - 28px) !important; padding: 24px 22px !important; }
        }
      `}</style>

      <div style={{ textAlign:"center", marginBottom:30 }}>
        <div style={{width:52,height:52,borderRadius:8,border:`1px solid ${C.red}66`,background:"#18070b",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Bebas Neue",fontSize:30,color:C.txt,letterSpacing:"1px",margin:"0 auto 14px"}}>D</div>
        <div className="login-logo" style={{ fontFamily:"Bebas Neue", fontSize:46, letterSpacing:"7px", color:C.txt, lineHeight:1 }}>
          DOFCLOTHES
        </div>
        <div style={{ fontFamily:"Barlow Condensed", fontSize:10, color:C.red, letterSpacing:"3px", fontWeight:700, marginTop:7 }}>
          BUSINESS OPS
        </div>
      </div>

      <div
        className={`login-card ${err ? "shake" : ""}`}
        style={{
          background: "linear-gradient(180deg, #151411, #0d0d0c)",
          border: `1px solid ${err ? C.red : C.bdr}`,
          borderRadius: 8,
          padding: "28px 32px",
          width: 320,
          transition: "border-color 0.2s",
          boxShadow:"0 24px 70px rgba(0,0,0,.42)",
        }}
      >
        <label style={{ fontFamily:"Barlow Condensed", fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:8 }}>
          Passwort
        </label>
        <input
          className="login-input"
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="********"
          autoFocus
          style={{
            width:"100%", background:"#151513",
            border:`1px solid ${err ? C.red : C.bdr}`,
            color:C.txt, borderRadius:6, padding:"11px 12px",
            fontFamily:"Barlow", fontSize:15, letterSpacing:"5px",
            marginBottom:14, transition:"border-color 0.2s",
          }}
        />
        <button
          className="login-btn"
          onClick={submit}
          disabled={busy}
          style={{
            width:"100%", background:`linear-gradient(180deg, ${C.red}, #b90d27)`, color:"#fff",
            border:"1px solid #ff5a70", borderRadius:6, padding:"11px",
            fontFamily:"Barlow Condensed", fontSize:15, fontWeight:700,
            letterSpacing:"1.5px", cursor:busy?"default":"pointer", transition:"background 0.15s",
            boxShadow:"0 10px 22px rgba(255,48,79,.18)",
            opacity:busy?.7:1,
          }}
        >
          {busy ? "PRUEFE..." : "EINLOGGEN"}
        </button>
        {err && (
          <div style={{ fontFamily:"Barlow", fontSize:12, color:C.red, textAlign:"center", marginTop:12 }}>
            Falsches Passwort
          </div>
        )}
      </div>

      <div style={{ fontFamily:"Barlow Condensed", fontSize:9, color:"#2a2a2a", marginTop:44, letterSpacing:"3px" }}>
        DISCIPLINE OVER FEELINGS
      </div>
    </div>
  );
}
