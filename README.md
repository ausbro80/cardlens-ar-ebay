# CardLens AR eBay Scanner

Vercel-ready prototype for a camera-based Pokémon card scanner.

## What it does

- Opens the phone camera in the browser
- Shows an AR-style card scanning HUD
- Runs OCR in the browser with Tesseract.js
- Matches the scanned text against preset Pokémon card records
- Calls a Vercel serverless function
- Searches live eBay US active listings
- Shows Raw, PSA 9, and PSA 10 median active listing prices

## Important note

This version uses eBay active listings, not sold/completed prices. Active listing prices are useful for quick reference, but sold prices are better for investment decisions.

## Files

```text
api/ebay-prices.js
public/index.html
package.json
vercel.json
```

## Setup

1. Create an eBay Developer account.
2. Create an application and get Production keys.
3. In Vercel, add these environment variables:

```text
EBAY_CLIENT_ID
EBAY_CLIENT_SECRET
```

4. Deploy this folder to Vercel.
5. Open the Vercel HTTPS URL on your phone.
6. Allow camera access.
7. Point at a card and press Scan.

## Local test

Install Vercel CLI:

```bash
npm i -g vercel
```

Run:

```bash
vercel dev
```

Open:

```text
http://localhost:3000
```

Camera access works on localhost or HTTPS.

## Manual preset test

Press the list button and choose a preset card. This calls the live eBay API without needing OCR success.
