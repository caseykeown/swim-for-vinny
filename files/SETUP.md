# ISR with Daphne — CMS Setup Guide
## Self-serve photo/video uploads via Decap CMS + Cloudflare

When complete, Daphne logs in at `https://isrwithdaphne.com/admin`,
uploads a photo, hits Save, and it appears in the gallery automatically.
No code edits, no emailing Casey.

---

## STEP 1 — Create a GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - Application name: `ISR with Daphne CMS`
   - Homepage URL: `https://isrwithdaphne.com`
   - Authorization callback URL: `https://cms-auth.YOUR_SUBDOMAIN.workers.dev/callback`
     *(leave the callback URL placeholder for now — fill it in after Step 2)*
4. Click **Register application**
5. Click **Generate a new client secret**
6. Save both the **Client ID** and **Client Secret** somewhere safe

---

## STEP 2 — Deploy the OAuth Cloudflare Worker

This is the `cms-worker/` folder. It runs inside Daphne's Cloudflare account
as a separate small Worker. It only does one thing: handle the GitHub login popup.

### Option A: Deploy via Wrangler (terminal)
```bash
cd cms-worker
npx wrangler login        # opens browser, log in to Daphne's Cloudflare account
npx wrangler deploy
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

### Option B: Deploy via Cloudflare Dashboard (no terminal)
1. In Daphne's Cloudflare dashboard → **Workers & Pages** → **Create**
2. Choose **Create Worker**
3. Name it `cms-auth`
4. Click **Edit code**, paste the contents of `cms-worker/index.js`, click **Deploy**
5. Go to the worker's **Settings** → **Variables and Secrets**
6. Add two secrets (click + Add, choose type **Secret**):
   - `GITHUB_CLIENT_ID`    → paste the value from Step 1
   - `GITHUB_CLIENT_SECRET` → paste the value from Step 1
7. Note the worker URL shown: `https://cms-auth.iluvprimitives.workers.dev`

### After deploying:
- Go back to your GitHub OAuth App (Step 1)
- Update the **Authorization callback URL** to:
  `https://cms-auth.iluvprimitives.workers.dev/callback`
- Click **Update application**

---

## STEP 3 — Update admin/config.yml in the repo

Open `admin/config.yml` and replace the `base_url` placeholder:

```yaml
backend:
  base_url: https://cms-auth.iluvprimitives.workers.dev
```

Commit and push this change to the main branch.

---

## STEP 4 — Set up Cloudflare Pages build command

In Daphne's Cloudflare dashboard:
1. Go to **Workers & Pages** → `swim-for-vinny`
2. Go to **Settings** → **Build & Deployments** (or Build configuration)
3. Set:
   - **Build command:** `node build-gallery.js`
   - **Build output directory:** `/` (root — where index.html lives)
4. Save

This means every time a commit hits the repo, Cloudflare runs
`build-gallery.js` first, which writes `gallery.json`, then serves the site.

---

## STEP 5 — Add these files to the GitHub repo

Add the following to the `caseykeown/swim-for-vinny` repo:
```
admin/
  index.html       ← Decap CMS loader
  config.yml       ← CMS field definitions (with base_url filled in)
build-gallery.js   ← build script that generates gallery.json
_gallery/          ← create this empty folder (add a .gitkeep file)
```

Commit and push. Cloudflare Pages will redeploy automatically.

---

## STEP 6 — Invite Daphne

1. Daphne visits `https://isrwithdaphne.com/admin`
2. She clicks **Login with GitHub**
3. A popup opens, she approves access to the repo
4. She's in — she sees only the "Photo & Video Gallery" collection

> **Note:** Daphne will need a GitHub account for this login to work.
> If she doesn't have one, create a free account at github.com with her
> email, then in the `caseykeown/swim-for-vinny` repo settings go to
> **Collaborators** and invite her GitHub username with **Write** access.
> She only needs Write access — not admin.

---

## HOW IT WORKS DAY-TO-DAY

1. Daphne logs into `isrwithdaphne.com/admin`
2. Clicks "Photo & Video Gallery" → "New Gallery Item"
3. Types a caption, uploads a photo (or pastes a TikTok link)
4. Clicks **Publish**
5. Decap commits a small file to the `_gallery/` folder in the repo
6. Cloudflare Pages detects the new commit and rebuilds (takes ~1-2 min)
7. `build-gallery.js` runs, updates `gallery.json`
8. The carousel on `isrwithdaphne.com` shows the new item

Casey never needs to be involved again for photo/video additions.

---

## TROUBLESHOOTING

**"Not authorized" error on login:**
→ Make sure Daphne's GitHub account has Write access to the repo (Step 6)
→ Make sure the callback URL in the GitHub OAuth App exactly matches the worker URL

**Photos not appearing after save:**
→ Check Cloudflare Pages build logs to confirm `build-gallery.js` ran
→ Check that `gallery.json` was updated in the repo

**Admin page shows blank or error:**
→ Check browser console — usually a config.yml `base_url` mismatch
