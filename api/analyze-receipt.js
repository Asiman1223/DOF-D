// api/analyze-receipt.js — Gemini API Proxy (server-seitig)

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { base64, mimeType, apiKey } = req.body;
  if (!base64 || !apiKey) return res.status(400).json({ error: "base64 und apiKey erforderlich" });

  const prompt = `Du bist ein Rechnungsscanner. Analysiere dieses Bild und antworte NUR mit diesem JSON (kein Text davor/danach):
{"betrag":ZAHL_IN_EURO,"datum":"YYYY-MM-DD","haendler":"Firmenname","kategorie":"Wareneinkauf oder Versandmaterial oder Werbung oder Shopify oder Domain oder Sonstiges","notiz":"Kurzbeschreibung max 60 Zeichen"}
Betrag = Gesamtbetrag inkl. MwSt. Datum = Rechnungsdatum. Falls nicht lesbar: heutiges Datum nutzen.`;

  const MODELS = [
    { model: "gemini-2.0-flash",      api: "v1beta" },
    { model: "gemini-2.0-flash-lite", api: "v1beta" },
    { model: "gemini-1.5-flash",      api: "v1beta" },
    { model: "gemini-1.5-flash",      api: "v1"     },
    { model: "gemini-pro-vision",     api: "v1beta" },
  ];

  let lastError = "";
  for (const { model, api } of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
              { text: prompt }
            ]}],
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
          })
        }
      );
      const data = await r.json();
      if (data.error) { lastError = `${model}: ${data.error.message}`; continue; }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) { lastError = `${model}: leere Antwort`; continue; }

      // JSON extrahieren
      const match = text.match(/\{[\s\S]*\}/);
      const json  = JSON.parse(match ? match[0] : text.replace(/```json|```/g,"").trim());

      return res.status(200).json({
        ok:       true,
        model,
        betrag:   json.betrag   || json.amount || 0,
        datum:    json.datum    || json.date   || new Date().toISOString().slice(0,10),
        kategorie: json.kategorie || "Sonstiges",
        haendler: json.haendler || "",
        notiz:    json.notiz    || json.beschreibung || "",
      });
    } catch(e) {
      lastError = `${model}: ${e.message}`;
    }
  }
  return res.status(500).json({ ok: false, error: lastError });
};
