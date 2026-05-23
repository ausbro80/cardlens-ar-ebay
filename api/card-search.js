export default async function handler(req, res) {
  try {
    const rawQuery = String(req.query.q || req.query.cardName || "").trim();
    if (!rawQuery) {
      return res.status(400).json({ error: "q is required" });
    }

    const key = process.env.POKEMON_TCG_API_KEY;
    const headers = { "Content-Type": "application/json" };
    if (key) headers["X-Api-Key"] = key;

    const cleaned = rawQuery
      .replace(/\b(psa|raw|pokemon|card|holo|rare|price|tcgplayer)\b/gi, " ")
      .replace(/[^a-zA-Z0-9'’:\-/\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const numberMatch = cleaned.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
    const parts = cleaned.split(/\s+/).filter(Boolean);

    const attempts = [];

    if (numberMatch) {
      attempts.push(`number:"${numberMatch[1]}/${numberMatch[2]}"`);
    }

    const quoted = cleaned.replace(/"/g, "");
    attempts.push(`name:"${quoted}"`);
    attempts.push(`name:${quoted.split(" ").slice(0, 3).join("* ")}*`);

    if (parts.length >= 2) {
      attempts.push(`name:${parts.slice(0, 2).join("* ")}*`);
    }

    if (parts.length >= 1) {
      attempts.push(`name:${parts[0]}*`);
    }

    let finalData = null;
    let usedQuery = null;

    for (const q of attempts) {
      const url = new URL("https://api.pokemontcg.io/v2/cards");
      url.searchParams.set("q", q);
      url.searchParams.set("pageSize", "12");
      url.searchParams.set("orderBy", "-set.releaseDate");

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Pokémon TCG API error: ${response.status} ${text}`);
      }

      const data = await response.json();
      if (data.data && data.data.length) {
        finalData = data;
        usedQuery = q;
        break;
      }
    }

    if (!finalData) {
      return res.status(200).json({
        ok: true,
        query: rawQuery,
        usedQuery: null,
        cards: [],
        message: "No matching card found"
      });
    }

    const cards = finalData.data.map(card => {
      const normal = card.tcgplayer?.prices?.normal;
      const holofoil = card.tcgplayer?.prices?.holofoil;
      const reverseHolofoil = card.tcgplayer?.prices?.reverseHolofoil;
      const firstEditionHolofoil = card.tcgplayer?.prices?.["1stEditionHolofoil"];
      const priceObj = holofoil || normal || reverseHolofoil || firstEditionHolofoil || null;

      const market = priceObj?.market ?? priceObj?.mid ?? priceObj?.low ?? null;

      const ebayBase = encodeURIComponent(`${card.name} ${card.set?.name || ""} ${card.number || ""} pokemon card`);
      const ebayPsa9 = encodeURIComponent(`${card.name} ${card.set?.name || ""} ${card.number || ""} PSA 9 pokemon card`);
      const ebayPsa10 = encodeURIComponent(`${card.name} ${card.set?.name || ""} ${card.number || ""} PSA 10 pokemon card`);
      const pc = encodeURIComponent(`${card.name} ${card.set?.name || ""} ${card.number || ""} pokemon`);

      return {
        id: card.id,
        name: card.name,
        set: card.set?.name || "",
        number: card.number || "",
        rarity: card.rarity || "",
        image: card.images?.small || card.images?.large || "",
        tcgplayerUrl: card.tcgplayer?.url || "",
        rawMarket: market,
        prices: card.tcgplayer?.prices || {},
        links: {
          ebayRaw: `https://www.ebay.com/sch/i.html?_nkw=${ebayBase}`,
          ebayPsa9: `https://www.ebay.com/sch/i.html?_nkw=${ebayPsa9}`,
          ebayPsa10: `https://www.ebay.com/sch/i.html?_nkw=${ebayPsa10}`,
          priceCharting: `https://www.pricecharting.com/search-products?q=${pc}&type=prices`
        }
      };
    });

    return res.status(200).json({
      ok: true,
      query: rawQuery,
      usedQuery,
      cards,
      source: "Pokémon TCG API + TCGPlayer price fields"
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
}