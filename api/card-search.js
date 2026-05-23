const API_BASE = 'https://api.pokemontcg.io/v2/cards';

const STOP_WORDS = new Set([
  'pokemon', 'basic', 'stage', 'evolves', 'from', 'hp', 'weakness', 'resistance', 'retreat',
  'energy', 'attack', 'damage', 'illus', 'illustrated', 'copyright', 'nintendo', 'creatures',
  'gamefreak', 'game', 'freak', 'during', 'your', 'next', 'turn', 'this', 'card', 'cards',
  'opponent', 'active', 'bench', 'attach', 'discard', 'trainer', 'supporter', 'item', 'stadium',
  'ability', 'search', 'shuffle', 'deck', 'hand', 'prize', 'weak', 'resist'
]);

function cleanText(value = '') {
  return String(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-zA-Z0-9\/\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value = '') {
  return cleanText(value).toLowerCase();
}

function extractNumber(text) {
  const clean = cleanText(text);
  const match = clean.match(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  if (match) return { number: match[1], printedTotal: match[2], full: `${match[1]}/${match[2]}` };
  return null;
}

function wordsFrom(text) {
  return normalize(text)
    .split(' ')
    .map(w => w.trim())
    .filter(w => w.length >= 3)
    .filter(w => !/^\d+$/.test(w))
    .filter(w => !STOP_WORDS.has(w));
}

function candidateNames(raw) {
  const lines = String(raw || '')
    .split(/\n|\r|\|/)
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 10);

  const candidates = [];

  for (const line of lines) {
    const words = wordsFrom(line).slice(0, 5);
    if (words.length) candidates.push(words.join(' '));
  }

  const allWords = wordsFrom(raw);
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i <= Math.min(allWords.length - n, 8); i++) {
      candidates.push(allWords.slice(i, i + n).join(' '));
    }
  }

  return [...new Set(candidates)]
    .filter(c => c.length >= 3)
    .slice(0, 12);
}

function escapeQueryValue(value = '') {
  return String(value).replace(/"/g, '').trim();
}

async function pokemonSearch(q, pageSize = 20) {
  const url = new URL(API_BASE);
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', '-set.releaseDate,number');

  const headers = {};
  if (process.env.POKEMON_TCG_API_KEY) {
    headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pokémon TCG API error ${response.status}: ${text}`);
  }
  return response.json();
}

function scoreCard(card, rawText, numberInfo) {
  const textWords = new Set(wordsFrom(rawText));
  const nameWords = wordsFrom(card.name || '');
  let score = 0;

  for (const word of nameWords) {
    if (textWords.has(word)) score += 8;
  }

  if (numberInfo && String(card.number) === String(numberInfo.number)) score += 14;
  if (numberInfo && card.set && String(card.set.printedTotal) === String(numberInfo.printedTotal)) score += 10;
  if (card.rarity && normalize(rawText).includes(normalize(card.rarity).split(' ')[0])) score += 2;
  if (card.tcgplayer && card.tcgplayer.prices) score += 3;

  const printed = `${card.number || ''}/${card.set?.printedTotal || ''}`;
  if (numberInfo && printed === numberInfo.full) score += 12;

  return score;
}

function getRawMarket(card) {
  const prices = card?.tcgplayer?.prices;
  if (!prices) return null;
  const keys = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', 'unlimitedHolofoil'];
  for (const key of keys) {
    const price = prices[key];
    if (price?.market) return price.market;
    if (price?.mid) return price.mid;
  }
  for (const price of Object.values(prices)) {
    if (price?.market) return price.market;
    if (price?.mid) return price.mid;
  }
  return null;
}

function ebayUrl(card, grade) {
  const setName = card?.set?.name || '';
  const query = `${card.name || ''} ${setName} ${card.number || ''} ${grade} pokemon card`;
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
}

function compactCard(card) {
  return {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity || null,
    image: card.images?.small || card.images?.large || null,
    set: card.set ? {
      id: card.set.id,
      name: card.set.name,
      series: card.set.series,
      printedTotal: card.set.printedTotal,
      releaseDate: card.set.releaseDate
    } : null,
    tcgplayer: card.tcgplayer || null,
    prices: {
      rawMarket: getRawMarket(card),
      psa9Link: ebayUrl(card, 'PSA 9'),
      psa10Link: ebayUrl(card, 'PSA 10')
    }
  };
}

export default async function handler(req, res) {
  try {
    const raw = cleanText(req.query.q || req.query.text || '');
    if (!raw || raw.length < 2) {
      return res.status(400).json({ error: 'q is required' });
    }

    const numberInfo = extractNumber(raw);
    const candidates = candidateNames(raw);
    const queries = [];

    if (numberInfo) {
      queries.push(`number:${numberInfo.number} set.printedTotal:${numberInfo.printedTotal}`);
      queries.push(`number:${numberInfo.number}`);
    }

    for (const name of candidates.slice(0, 8)) {
      const safe = escapeQueryValue(name);
      if (!safe) continue;
      if (numberInfo) queries.push(`name:"${safe}" number:${numberInfo.number}`);
      queries.push(`name:"${safe}"`);
      queries.push(`name:${safe.split(' ')[0]}*`);
    }

    queries.push(`name:"${escapeQueryValue(raw)}"`);

    const seenQuery = new Set();
    const cardsById = new Map();
    const tried = [];

    for (const q of queries) {
      if (seenQuery.has(q)) continue;
      seenQuery.add(q);
      tried.push(q);
      try {
        const data = await pokemonSearch(q, numberInfo ? 60 : 25);
        for (const card of data.data || []) cardsById.set(card.id, card);
        if (cardsById.size >= 80) break;
      } catch (_) {}
    }

    const allCards = [...cardsById.values()];
    const ranked = allCards
      .map(card => ({ card, score: scoreCard(card, raw, numberInfo) }))
      .sort((a, b) => b.score - a.score || (getRawMarket(b.card) || 0) - (getRawMarket(a.card) || 0));

    const best = ranked[0]?.card || null;

    return res.status(200).json({
      query: raw,
      extracted: {
        number: numberInfo,
        candidates
      },
      tried: tried.slice(0, 12),
      card: best ? compactCard(best) : null,
      cards: ranked.slice(0, 8).map(item => ({ ...compactCard(item.card), score: item.score })),
      source: 'Pokémon TCG API + TCGPlayer market price when available'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Search failed' });
  }
}
