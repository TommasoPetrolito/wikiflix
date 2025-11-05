# 🚀 GitHub Setup Guide

This guide will help you safely publish Flux to GitHub without exposing any sensitive information.

## ✅ Pre-Publish Checklist

### 1. Verify `.gitignore` includes environment files

Your `.gitignore` should already include:
```
.env
.env.local
.env.*.local
```

**Check:** Run `git status` - you should NOT see `.env` listed.

### 2. Verify no API keys in code

All API keys should use environment variables:
- ✅ `VITE_TMDB_API_KEY` - in `.env` only
- ✅ `VITE_SPORTSDB_API_KEY` - in `.env` only  
- ✅ `VITE_STREAMS_API_URL` - in `.env` only

**Never commit:**
- ❌ `.env` file
- ❌ Actual API keys in code
- ❌ Hardcoded credentials

### 3. Create `.env.example` file

This file shows what environment variables are needed WITHOUT exposing actual keys:
```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_SPORTSDB_API_KEY=your_sportsdb_api_key_here
VITE_STREAMS_API_URL=https://ppv.to
```

✅ `.env.example` is safe to commit (it has no real keys)

## 📤 Publishing to GitHub

### Step 1: Check what will be committed

```bash
cd flux
git status
```

**Should show:**
- ✅ Source code files
- ✅ `.env.example`
- ✅ `README.md`
- ✅ Configuration files

**Should NOT show:**
- ❌ `.env`
- ❌ `node_modules/`
- ❌ Any files with actual API keys

### Step 2: Create GitHub repository

1. Go to GitHub.com
2. Click "New repository"
3. Name it (e.g., "flux-streaming-platform")
4. Make it **Public** or **Private** (your choice)
5. **DO NOT** initialize with README (you already have one)

### Step 3: Push your code

```bash
# Initialize git (if not already done)
git init

# Add all files (except those in .gitignore)
git add .

# Commit
git commit -m "Initial commit: Flux streaming platform"

# Add GitHub remote
git remote add origin https://github.com/enyw/flux.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🔍 Double-Check Before Pushing

### Verify no secrets in committed files:

```bash
# Search for potential API keys
grep -r "VITE_TMDB_API_KEY=" . --exclude-dir=node_modules
# Should only show .env.example (with placeholder)

# Check git diff
git diff --cached
# Review what will be committed
```

### If you accidentally committed `.env`:

```bash
# Remove from git history (but keep local file)
git rm --cached .env
git commit -m "Remove .env from tracking"

# If already pushed, you'll need to:
# 1. Regenerate your API keys (they're now public)
# 2. Use git filter-branch or BFG Repo-Cleaner to remove from history
```

## 📝 Repository Description

Suggested GitHub repository description:
```
A modern streaming platform clone built with React, TypeScript, and Vite. Features 75K+ movies and TV shows via TMDB API, sports streaming, and a Netflix-inspired UI.
```

## 🏷️ Suggested Topics/Tags

- `react`
- `typescript`
- `vite`
- `streaming`
- `movies`
- `netflix-clone`
- `tmdb-api`
- `responsive-design`

## ⚖️ Legal Considerations

### Safe to publish:
- ✅ Your UI/UX code
- ✅ Component structure
- ✅ Styling and design
- ✅ Integration code (without API keys)

### What this project uses:
- **TMDB API** - Free, public API (requires free account)
- **TheSportsDB** - Free, public API
- **Vidking** - Public streaming service
- **React** - Open source (MIT license)

### Important Notes:
1. **This is a clone/demo project** - For educational purposes
2. **API keys are user's responsibility** - Each user gets their own
3. **No copyrighted content** - Only metadata (posters, descriptions)
4. **Streaming via third-party** - Vidking handles actual video hosting

## 🛡️ Ongoing Security

### After publishing:

1. **Never commit `.env`** - Always check before committing
2. **Rotate keys if exposed** - If keys leak, regenerate them
3. **Use branch protection** - Enable on GitHub if collaborating
4. **Review PRs carefully** - Check for accidental key commits

### Best Practices:

```bash
# Always check before committing
git status

# Use pre-commit hooks (optional)
# Prevents committing .env accidentally
```

## 📚 Additional Resources

- [GitHub Secrets Guide](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Gitignore Patterns](https://git-scm.com/docs/gitignore)
- [TMDB API Terms](https://www.themoviedb.org/documentation/api/terms-of-use)

---

**✅ Your project is ready for GitHub!**

Remember: As long as `.env` is in `.gitignore` and you've verified no keys are hardcoded, you're safe to publish! 🎉

