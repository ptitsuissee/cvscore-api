exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: "Invalid JSON" };
  }

  const { lang = "fr", country = "CH", cv_text = "" } = body;

  if (!cv_text || cv_text.length < 40) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "CV trop court" })
    };
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      overall_score: 72,
      message: lang === "en"
        ? "This is a test API. AI will be added later."
        : "Ceci est une API de test. L’IA sera ajoutée plus tard."
    })
  };
};
