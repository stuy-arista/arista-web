# ARISTA website

The website for ARISTA, Stuyvesant's honor society: [www.stuyarista.org](https://www.stuyarista.org).
Members sign up for events, log tutoring, check in to meetings and track their credits.

## How it fits together

- **Site:** SvelteKit 2 with Svelte 5, TypeScript and Tailwind 4. Vercel builds and serves it from the `main` branch of [stuy-arista/arista-web](https://github.com/stuy-arista/arista-web).
- **Database:** [PocketBase](https://pocketbase.io) at `db.stuyarista.org`. It holds users, events, credits and meetings, and its hooks send email and serve the public link preview data. Its hooks and schema live on the server, not in this repo.
- **Link previews:** `src/routes/og` draws the cards that show when a link is shared (satori and resvg). Page cards are built at deploy time; event, events and meeting cards are drawn on request and cached.

## Local development

You need Node 24.

```bash
npm install
cp .env.example .env
npm run dev
```

Set `PUBLIC_POCKETBASE_URL` in `.env` to a local PocketBase (`http://127.0.0.1:8090`) so you're not working against real member data. Ask the web team for a copy of the local PocketBase setup.

| Variable                                                | What it's for                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `PUBLIC_POCKETBASE_URL`                                 | The PocketBase server. Defaults to `https://db.stuyarista.org`. |
| `PB_PROXY_SECRET`                                       | Lets PocketBase rate-limit by the visitor's IP. Optional.       |
| `SLACK_TUTORING_BOT_TOKEN`, `SLACK_TUTORING_CHANNEL_ID` | Posts tutoring requests to Slack. Optional.                     |

## Scripts

| Command            | What it does                        |
| ------------------ | ----------------------------------- |
| `npm run dev`      | Start the dev server.               |
| `npm run build`    | Build for Vercel.                   |
| `npm run check`    | Type-check the project.             |
| `npm run test:seo` | Test page titles and link previews. |
| `npm run lint`     | Check formatting with Prettier.     |
| `npm run format`   | Fix formatting.                     |

## Contributing

Make a branch, open a pull request against `main`, and run `npm run check`, `npm run test:seo` and `npm run lint` first.
