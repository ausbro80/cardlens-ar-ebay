# CardLens Glasses Auto Scan

A Vercel-ready prototype for a smart-glasses style Pokémon card scanner.

## What it does

- Uses the live camera in the browser
- Automatically scans the centered card with OCR
- Sends OCR text to `/api/card-search`
- Searches the Pokémon TCG API
- Shows a small glasses-style HUD with:
  - Card name
  - Set
  - Card number
  - Rarity
  - TCGPlayer raw market price when available
  - PSA 9 and PSA 10 eBay search links

## Vercel deploy

Upload these files to GitHub, then import the repo into Vercel.

Do not add `vercel.json`.

## Optional environment variable

`POKEMON_TCG_API_KEY`

Get it from https://dev.pokemontcg.io/

The app can work without the key, but rate limits are better with it.

## Files

- `public/index.html`
- `api/card-search.js`
- `package.json`
- `README.md`

## Notes

This is an MVP. OCR can fail under glare, blur, sleeves, or bad focus. For production, add a card-corner detector and image matching model.
