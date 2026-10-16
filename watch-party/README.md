# Watch Party

Watch movies together in real time — synced playback, chat and reactions.

Built with TanStack Start, React, TypeScript, Tailwind CSS and Supabase.

## Getting started

```sh
cp .env.example .env     # then fill in your Supabase values
npm install              # or: bun install
npm run dev              # http://localhost:8080
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build (Nitro; output in `.output/`) |
| `npm start` | Run the production build (Node target) |
| `npm test` | Run the test suite |
| `npm run lint` | ESLint |

## Deployment

`npm run build` auto-targets Vercel, Netlify or Cloudflare when run on those
platforms; elsewhere it produces a Node server (`npm start`). Force a target with
`NITRO_PRESET`, e.g. `NITRO_PRESET=vercel npm run build`.
Set the variables from `.env.example` in your host's environment settings.

## Favicon

Replace `public/favicon.ico` with your own file. Browsers cache favicons hard, so
also bump the `?v=2` suffix in `src/routes/__root.tsx` when you do.

## Database

The schema lives in `drizzle/migrations/0000_migration.sql`. Apply it to your own
Supabase project (SQL editor, or `supabase db push`) if you are starting fresh.
