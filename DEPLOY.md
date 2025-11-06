# 🚀 Deployment Guide

Quick guide to deploy Flux and get a live demo URL for promotion.

## Vercel (Recommended - Easiest)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd flux
vercel
```

Follow prompts:
- Link to existing project? **No**
- Project name? **flux** (or your choice)
- Directory? **./** (current directory)
- Override settings? **No**

### Step 3: Add Environment Variables
1. Go to https://vercel.com/your-username/flux/settings/environment-variables
2. Add:
   - `VITE_TMDB_API_KEY` = your TMDB key
   - `VITE_SPORTSDB_API_KEY` = your sports key (optional)
   - `VITE_STREAMS_API_URL` = https://ppv.to

### Step 4: Redeploy
```bash
vercel --prod
```

**Done!** Your app is live at: `https://flux-xxx.vercel.app`

### Step 5: Add to README
Update README.md:
```markdown
🌐 [Live Demo](https://flux-xxx.vercel.app)
```

---

## Netlify

### Step 1: Build
```bash
npm run build
```

### Step 2: Deploy
1. Go to https://app.netlify.com
2. Drag and drop `dist/` folder
3. Add site name

### Step 3: Environment Variables
- Site settings → Environment variables
- Add your API keys

### Step 4: Update README
Add your Netlify URL to README

---

## GitHub Pages (Free but Requires Setup)

### Step 1: Update `vite.config.ts`
```typescript
export default defineConfig({
  base: '/flux/', // Your repo name
  // ... rest of config
})
```

### Step 2: Build
```bash
npm run build
```

### Step 3: Deploy
- GitHub repo → Settings → Pages
- Source: GitHub Actions (or manual upload `dist/`)

---

## After Deployment

1. ✅ Add demo link to README
2. ✅ Share on social media
3. ✅ Post to Reddit (r/webdev)
4. ✅ Update GitHub topics
5. ✅ Create GitHub release

---

**Important:** Remember to add environment variables in your hosting platform's dashboard!

