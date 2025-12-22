const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function addPremiumEmailToAirtable(email) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;

  if (!baseId || !apiKey) {
    throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_API_KEY");
  }

  const url = `https://api.airtable.com/v0/${baseId}/premium_users`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { email } }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Airtable error: ${t}`);
  }
}

exports.handler = async (event) => {
  try {
    const sig = event.headers["stripe-signature"];
    if (!sig) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          message: "Webhook reachable. Waiting for Stripe signed events.",
          hasStripeSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
          hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
          hasAirtableKey: !!process.env.AIRTABLE_API_KEY,
          hasAirtableBase: !!process.env.AIRTABLE_BASE_ID,
        }),
      };
    }

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("❌ Signature verify failed:", err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "bad_signature", message: err.message }),
      };
    }

    console.log("✅ Stripe event:", stripeEvent.type);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        session.customer?.email ||
        "";

      console.log("Extracted email:", email);

      if (email) {
        await addPremiumEmailToAirtable(email.trim().toLowerCase());
        console.log("✅ PREMIUM SAVED TO AIRTABLE:", email);
      } else {
        console.log("⚠️ No email found in session");
      }
    }

    return { statusCode: 200, body: "ok" };
  } catch (e) {
    console.log("🔥 Webhook crashed:", String(e));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "webhook_crashed", message: String(e) }),
    };
  }
};
