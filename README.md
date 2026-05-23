# CardLens AR Scanner

eBay API 없이 테스트하는 포켓몬 카드 AR 스캐너입니다.

## What it does

- Mobile browser camera overlay
- OCR with Tesseract.js
- Searches Pokémon TCG API
- Shows card name, set, number, rarity
- Shows TCGPlayer raw market price when available
- PSA 9 / PSA 10 buttons open Google search links
- Outdoor visibility mode

## Files

```text
api/card-search.js
public/index.html
package.json
vercel.json
README.md
```

## Deploy to Vercel

1. Upload this folder to GitHub
2. Import the repo in Vercel
3. Framework preset: Other
4. Deploy
5. Open the Vercel HTTPS URL on mobile
6. Tap Start camera scanner

## Optional environment variable

Pokémon TCG API often works without a key for testing, but adding a key improves limits.

```text
POKEMON_TCG_API_KEY
```

Get it from https://pokemontcg.io/

## Notes

This version does not use eBay API. PSA 9 and PSA 10 are not auto-priced. They open search links so you can verify manually.
