// api/analyze-receipt.js — Rechnungsscanner via Groq (kostenlos) oder Gemini

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { base64, mimeType, apiKey } = req.body;
  if (!base64 || !apiKey) return res.status(400).json({ error: "base64 und apiKey erforderlich" });

  const prompt = `Analysiere diese Rechnung/Quittung und antworte NUR mit diesem JSON ohne Text davor oder danach:
{"betrag":ZAHL_IN_EURO,"datum":"YYYY-MM-DD","haendler":"Firmenname","kategorie":"Wareneinkauf oder Versandmaterial oder Werbung oder Shopify oder Domain oder Sonstiges","notiz":"Kurzbeschreibung max 50 Zeichen"}
Regeln: betrag=Gesamtbetrag inkl MwSt als reine Zahl. datum=Rechnungsdatum oder heute falls unlesbar.`;

  // ── Groq API (kostenlos, key startet mit gsk_) ─────────────────────
  if (apiKey.startsWith("gsk_")) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType||"image/jpeg"};base64,${base64}` } },
              { type: "text", text: prompt }
            ]
          }],
          max_tokens: 300,
          temperature: 0.1,
        })
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.choices?.[0]?.message?.content || "";
      const match = text.match(/\{[\s\S]*\}/);
      const json  = JSON.parse(match ? match[0] : text);
      return res.status(200).json({ ok:true, model:"groq/llama-4-scout", betrag:json.betrag||0, datum:json.datum||new Date().toISOString().slice(0,10), kategorie:json.kategorie||"Sonstiges", haendler:json.haendler||"", notiz:json.notiz||"" });
    } catch(e) {
      return res.status(500).json({ ok:false, error:"Groq: "+e.message });
    }
  }

  // ── Gemini API (key startet mit AIza) ──────────────────────────────
  const MODELS = [
    { m:"gemini-2.0-flash",           v:"v1beta" },
    { m:"gemini-2.0-flash-lite",      v:"v1beta" },
    { m:"gemini-2.5-flash-preview-04-17", v:"v1beta" },
    { m:"gemini-1.5-flash",           v:"v1beta" },
  ];
  let lastErr = "";
  for (const { m, v } of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${apiKey}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents:[{ parts:[{ inline_data:{ mime_type: mimeType||"image/jpeg", data:base64 } }, { text:prompt }] }], generationConfig:{ temperature:0.1, maxOutputTokens:300 } })
      });
      const data = await r.json();
      if (data.error) { lastErr = `${m}: ${data.error.message}`; continue; }
      const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text)    { lastErr = `${m}: leere Antwort`; continue; }
      const match = text.match(/\{[\s\S]*\}/);
      const json  = JSON.parse(match ? match[0] : text.replace(/```json|```/g,"").trim());
      return res.status(200).json({ ok:true, model:`gemini/${m}`, betrag:json.betrag||0, datum:json.datum||new Date().toISOString().slice(0,10), kategorie:json.kategorie||"Sonstiges", haendler:json.haendler||"", notiz:json.notiz||"" });
    } catch(e) { lastErr = `${m}: ${e.message}`; }
  }
  return res.status(500).json({ ok:false, error: lastErr });
};
