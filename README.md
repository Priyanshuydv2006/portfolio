# Priyanshu Yadav: portfolio

A fast, animated portfolio where **every word, link, colour, project, certificate and image is editable from an admin panel**. No code changes needed.

```
docs/      the website (HTML, CSS, JS). Works without a build step.
backend/   the API (Express + libSQL/Turso). Same code runs locally, on Vercel or on any Node host.
api/       Vercel entry point (wraps backend/app.js)
scripts/   check-defaults.mjs (keeps text defaults in sync), import-old-site.mjs (copies data from the old Render site)
```

## Editing your site

Open `https://YOUR-SITE/#admin` and log in. You get two ways to edit:

- **Edit text:** click it, then click any phrase on the page and type. Click a project, certificate or journey card to edit that item. Press **Save changes**.
- **Admin panel:** every field in one place (menu names, buttons, form messages, links, colours, show/hide sections), plus Skills, Projects, Certificates, Journey, Inbox (contact form messages) and Resume.

Notes: photos are shrunk in the browser before upload (max 4 MB after that). Resume must be a PDF up to 4 MB. Certificates are uploaded as images. Visitors see changes within about 30 seconds (edge cache); you see them instantly.

## Run locally

```bash
npm install
cp .env.example .env      # optional locally; without it the admin password is "admin123" (dev only)
npm start                 # http://localhost:5000, admin at http://localhost:5000/#admin
```

Locally the data lives in `backend/data/local.db` (git-ignored).

## Deploy on Vercel (about 10 minutes)

1. **Database.** Create a free database at [turso.tech](https://turso.tech). Copy its URL (`libsql://...`) and create an auth token.
2. **GitHub.** Push this folder to your repo.
3. **Vercel.** New Project, import the repo, leave the build settings alone (`vercel.json` configures everything).
4. **Environment variables** (Project Settings, Environment Variables):

   | Name | Value |
   |---|---|
   | `ADMIN_PASSWORD` | a long passphrase (required) |
   | `JWT_SECRET` | a long random string (required) |
   | `TURSO_DATABASE_URL` | `libsql://...` from Turso |
   | `TURSO_AUTH_TOKEN` | token from Turso |
   | `RESEND_API_KEY`, `CONTACT_TO` | optional, email yourself every contact message |

   The admin stays disabled until both `ADMIN_PASSWORD` and `JWT_SECRET` are set. There are no default passwords in production.
5. **Deploy**, then open `/#admin`.

### Bring over your old data

Your certificates, projects and resume uploaded on the Render version can be copied across:

```bash
node scripts/import-old-site.mjs https://YOUR-SITE.vercel.app "your admin password"
```

It skips the demo projects that shipped with the first version. Add `--text` to also copy the old hero/about text.

When you are happy, delete the Render service and turn off GitHub Pages for this repo. The old API also had a well-known fallback admin password when `ADMIN_PASSWORD` was unset, so do not leave it running.

## Adding a new editable phrase

1. Add `data-c="some.key"` to the element in `docs/index.html` with its default text.
2. Add a matching line in `backend/content-schema.js`.
3. Run `npm run check`. It fails if the two disagree.

The admin panel builds itself from the schema, so nothing else is needed.
