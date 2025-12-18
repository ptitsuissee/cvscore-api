exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: "Invalid JSON" };
  }

  const { lang = "fr", country = "CH", job_title = "", cv_text = "" } = body;

  if (!cv_text || String(cv_text).trim().length < 40) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "CV trop court" }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "OPENAI_API_KEY manquant dans Netlify" }),
    };
  }

  const instructions =
    lang === "en"
      ? "You are a senior European recruiter and ATS expert. Be direct, actionable, and honest."
      : "Tu es un recruteur européen senior et expert ATS. Sois direct, actionnable et honnête.";

  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "overall_score",
      "sub_scores",
      "summary",
      "priority_fixes",
      "actionable_tips",
      "country_specific_advice",
    ],
    properties: {
      overall_score: { type: "integer", minimum: 0, maximum: 100 },
      sub_scores: {
        type: "object",
        additionalProperties: false,
        required: ["clarity", "impact", "structure", "ats_compatibility"],
        properties: {
          clarity: { type: "integer", minimum: 0, maximum: 100 },
          impact: { type: "integer", minimum: 0, maximum: 100 },
          structure: { type: "integer", minimum: 0, maximum: 100 },
          ats_compatibility: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
      summary: { type: "string", minLength: 10, maxLength: 300 },
      priority_fixes: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string", minLength: 5, maxLength: 180 },
      },
      actionable_tips: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: { type: "string", minLength: 5, maxLength: 200 },
      },
      country_specific_advice: { type: "string", minLength: 5, maxLength: 300 },
    },
  };

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions,
        input: [
          {
            role: "user",
            content:
              (lang === "en"
                ? `Language: EN\nTarget country: ${country}\nTarget role: ${job_title || "N/A"}\n\nResume:\n${cv_text}`
                : `Langue: FR\nPays ciblé: ${country}\nPoste visé: ${job_title || "N/A"}\n\nCV:\n${cv_text}`),
          },
        ],
       text: { format: { type: "json_schema", name: "cvscore_score", strict: true, schema } },
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "OpenAI error", details: errText }),
      };
    }

    const data = await resp.json();

// 1) Essaye d'abord le champ "output_text" s'il existe
let outputText = (typeof data.output_text === "string" && data.output_text.trim())
  ? data.output_text.trim()
  : "";

// 2) Sinon, récupère le texte depuis data.output[].content[]
if (!outputText && Array.isArray(data.output)) {
  const chunks = [];
  for (const item of data.output) {
    if (!item || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (!c) continue;
      if (c.type === "output_text" && typeof c.text === "string") chunks.push(c.text);
      if (c.type === "text" && typeof c.text === "string") chunks.push(c.text);
    }
  }
  outputText = chunks.join("").trim();
}

// 3) Si toujours vide, renvoie une erreur lisible (debug)
if (!outputText) {
  return {
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({
      error: "OpenAI returned empty output",
      details: data
    }),
  };
}

let result;
try {
  result = JSON.parse(outputText);
} catch (e) {
  return {
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({
      error: "OpenAI output was not valid JSON",
      outputText,
      parseError: String(e)
    }),
  };
}

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server error", details: String(e) }),
    };
  }
};
