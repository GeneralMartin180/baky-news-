# Baky News

![Baky News on desktop and mobile](docs/baky-news-showcase.png)

**World news. Zero ads. No tracking scripts.**

Catch up on the stories that matter with a privacy-first news reader for desktop and mobile. No account needed. Just headlines, short previews and links to the original reporting.

**[Start reading →](https://baky-news.vercel.app/)** · Hosted on Vercel · Source code on GitHub

Baky News doesn't run ads or include its own reader-tracking scripts. External publishers and resources may have their own privacy practices.

## In this repository

Baky News je spravodajský agregátor postavený na Reacte a Vite s backendom na Node.js a Expresse.

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
