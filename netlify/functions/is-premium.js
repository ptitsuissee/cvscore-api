exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  const email = (event.queryStringParameters?.email || "").trim().toLowerCase();
  if (!email) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "email required" }) };
  }

  const baseId = process.env.AIRTABLE_BASE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;

  const url =
    `https://api.airtable.com/v0/${baseId}/premium_users` +
    `?filterByFormula=${encodeURIComponent(`LOWER({email})='${email}'`)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "airtable_error", details: await res.text() }) };
  }

  const data = await res.json();
  const premium = Array.isArray(data.records) && data.records.length > 0;

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ email, premium }),
  };
};
