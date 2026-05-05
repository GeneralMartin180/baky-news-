# Baky News

Baky News je news agregator postaveny na `React + Vite` s backendom na `Node.js/Express`.

Frontend:
- editorial feed v style modern news app
- lokalna edicia pre Slovensko
- weather widget
- search a article modal

Backend:
- RSS ingestion a fallbacky
- image enrichment pre clanky
- prepared feed cache pipeline
- health endpoint
- weather endpoint cez Open-Meteo

## Lokalny beh

Predpoklady:
- Node.js 20+

Instalacia:

```bash
npm install
```

Spustenie:

```bash
npm run dev
```

Appka potom bezi na:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Vercel

Projekt je pripraveny na deploy na Vercel:
- frontend sa builduje cez `vite build`
- API endpointy bezia cez `api/*.ts`
- config je v `vercel.json`

## API endpointy

- `GET /api/news`
- `GET /api/article-content`
- `GET /api/weather`
- `GET /api/health`
