import { useState } from "react";

// ✏️ PASSWORT HIER ÄNDERN:
const PASSWORT = "Qbingo10";

const C = {
  bg:"#080808", panel:"#0d0d0d", bdr:"#222222",
  red:"#e11d48", txt:"#f0f0f0", muted:"#666666"
};

export default function Login({ onLogin }) {
  const [pw,  setPw]  = useState("");
  const [err, setErr] = useState(false);

  const submit = () => {
    const entered = pw.trim();

    if (entered === PASSWORT) {
      localStorage.setItem("dof_auth", "1");
      onLogin();
    } else {
      setErr(true);
      setPw("");
      setTimeout(() => setErr(false), 600);
    }
  };

  return (
    <div style={{ background:C.bg, height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap');
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60%  { transform: translateX(-10px); }
          40%,80%  { transform: translateX(10px); }
        }
        .shake { animation: shake 0.45s ease; }
        .login-input:focus { border-color: #e11d48 !important; }
        .login-btn:hover { background: #c81040 !important; }
      `}</style>

      {/* Logo */}
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontFamily:"Bebas Neue", fontSize:44, letterSpacing:"7px", color:C.txt, lineHeight:1 }}>
          DOFCLOTHES
        </div>
        <div style={{ fontFamily:"Barlow Condensed", fontSize:10, color:C.red, letterSpacing:"3px", fontWeight:700, marginTop:5 }}>
          BUSINESS DASHBOARD
        </div>
      </div>

      {/* Login Card */}
      <div
        className={err ? "shake" : ""}
        style={{
          background: C.panel,
          border: `1px solid ${err ? C.red : C.bdr}`,
          borderRadius: 12,
          padding: "28px 32px",
          width: 320,
          transition: "border-color 0.2s",
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
          placeholder="••••••••"
          autoFocus
          style={{
            width:"100%", background:"#171717",
            border:`1px solid ${err ? C.red : C.bdr}`,
            color:C.txt, borderRadius:6, padding:"10px 12px",
            fontFamily:"Barlow", fontSize:15, letterSpacing:"5px",
            marginBottom:14, transition:"border-color 0.2s",
          }}
        />
        <button
          className="login-btn"
          onClick={submit}
          style={{
            width:"100%", background:C.red, color:"#fff",
            border:"none", borderRadius:6, padding:"11px",
            fontFamily:"Barlow Condensed", fontSize:15, fontWeight:700,
            letterSpacing:"1.5px", cursor:"pointer", transition:"background 0.15s",
          }}
        >
          EINLOGGEN
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
