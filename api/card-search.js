export default async function handler(req, res) {
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.status(400).json({ error: 'q is required' });
    }

    const query = buildPokemonTcgQuery(q);
    const url = new URL('https://api.pokemontcg.io/v2/cards');
    url.searchParams.set('q', query);
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('orderBy', '-set.releaseDate');

    const headers = {};
    if (process.env.POKEMON_TCG_API_KEY) {
      headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text || 'Pokémon TCG API error' });
    }

    const data = await response.json();
    const cards = Array.isArray(data.data) ? data.data : [];
    const ranked = cards
      .map(card => ({ card, score: scoreCard(q, card) }))
      .sort((a, b) => b.score - a.score);

    return res.status(200).json({
      query,
      card: ranked[0] ? ranked[0].card : null,
      matches: ranked.slice(0, 5).map(item => ({
        id: item.card.id,
        name: item.card.name,
        set: item.card.set?.name,
        number: item.card.number,
        rarity: item.card.rarity,
        score: item.score,
        image: item.card.images?.small,
        tcgplayer: item.card.tcgplayer || null
      })),
      source: 'Pokémon TCG API / TCGPlayer market prices when available'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}

function buildPokemonTcgQuery(input) {
  const cleaned = input.replace(/[^a-zA-Z0-9\s\/\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const numberMatch = cleaned.match(/\b\d{1,3}\/\d{1,3}\b/);
  const words = cleaned
    .replace(/\b\d{1,3}\/\d{1,3}\b/g, ' ')
    .split(' ')
    .filter(Boolean);

  const nameWords = [];
  for (const word of words) {
    if (/^\d+$/.test(word)) continue;
    if (word.length < 2) continue;
    nameWords.push(word);
    if (nameWords.length >= 3) break;
  }

  const clauses = [];
  if (nameWords.length) {
    clauses.push('name:"' + nameWords.join(' ') + '*"');
  } else {
    clauses.push('name:"' + cleaned + '*"');
  }
  if (numberMatch) {
    clauses.push('number:"' + numberMatch[0].split('/')[0] + '"');
  }
  return clauses.join(' ');
}

function scoreCard(input, card) {
  const clean = input.toLowerCase();
  let score = 0;

  if (card.name && clean.includes(card.name.toLowerCase())) score += 10;
  if (card.number && clean.includes(card.number.toLowerCase())) score += 8;
  if (card.number && clean.includes(String(card.number).split('/')[0])) score += 3;
  if (card.set?.name && clean.includes(card.set.name.toLowerCase())) score += 4;

  const firstName = card.name ? card.name.toLowerCase().split(' ')[0] : '';
  if (firstName && clean.includes(firstName)) score += 4;

  if (card.tcgplayer?.prices) score += 1;
  return score;
}
