let cachedToken = null;
let tokenExpiresAt = 0;

async function getEbayToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in Vercel environment variables");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay token error: ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (Number(data.expires_in || 7200) - 60) * 1000;
  return cachedToken;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function cleanPrice(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function summarize(items) {
  const prices = (items || [])
    .map(item => cleanPrice(item.price?.value))
    .filter(price => price && price > 1);

  return {
    median: median(prices),
    low: prices.length ? Math.min(...prices) : null,
    high: prices.length ? Math.max(...prices) : null,
    count: prices.length
  };
}

function itemPreview(items) {
  return (items || []).slice(0, 5).map(item => ({
    title: item.title,
    price: item.price?.value ? Number(item.price.value) : null,
    currency: item.price?.currency || "USD",
    url: item.itemWebUrl || null,
    image: item.image?.imageUrl || null
  }));
}

async function searchEbay(query, token) {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "25");
  url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},conditions:{1000|1500|2000|2500|3000|4000|5000|6000}");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      "X-EBAY-C-ENDUSERCTX": "contextualLocation=country=US"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`eBay search error: ${text}`);
  }

  return response.json();
}

function safe(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export default async function handler(req, res) {
  try {
    const cardName = safe(req.query.cardName);
    const setName = safe(req.query.setName);
    const number = safe(req.query.number);

    if (!cardName) return res.status(400).json({ error: "cardName is required" });

    const token = await getEbayToken();
    const base = `${cardName} ${setName} ${number} Pokemon card`.trim();
    const rawQuery = `${base} -PSA -BGS -CGC`;
    const psa9Query = `${base} PSA 9`;
    const psa10Query = `${base} PSA 10`;

    const [rawData, psa9Data, psa10Data] = await Promise.all([
      searchEbay(rawQuery, token),
      searchEbay(psa9Query, token),
      searchEbay(psa10Query, token)
    ]);

    return res.status(200).json({
      source: "eBay Browse API, active US listings",
      note: "Active listing prices are not the same as sold prices.",
      query: { raw: rawQuery, psa9: psa9Query, psa10: psa10Query },
      prices: {
        raw: summarize(rawData.itemSummaries),
        psa9: summarize(psa9Data.itemSummaries),
        psa10: summarize(psa10Data.itemSummaries)
      },
      listings: {
        raw: itemPreview(rawData.itemSummaries),
        psa9: itemPreview(psa9Data.itemSummaries),
        psa10: itemPreview(psa10Data.itemSummaries)
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown error" });
  }
}
