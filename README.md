# CardLens AR TCG Scanner

Vercel-ready prototype.

## Files

- `public/index.html`: camera UI, OCR, manual search, AR-style HUD
- `api/card-search.js`: Pokémon TCG API proxy

## Optional Environment Variable

`POKEMON_TCG_API_KEY`

The app works without it, but the API rate limit is better with a key.

## Notes

OCR can fail when the card is blurry, reflective, or too far away.
Use the top manual search field as the reliable shortcut.
