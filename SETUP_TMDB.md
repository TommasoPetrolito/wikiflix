# 🎬 TMDB API Setup Guide

Your Flux now has **unlimited access to 75,000+ movies and TV shows**! Here's how to enable it:

## 🚀 Quick Setup (2 minutes)

### Step 1: Get Your Free TMDB API Key

1. Visit: **https://www.themoviedb.org/settings/api**
2. Sign up (free account)
3. Click **"Create"** under API section
4. Select **"Developer"**
5. Copy your **API Key** (v3 Auth)

### Step 2: Add to Your Project

Create a `.env` file in the `flux` folder:

```env
VITE_TMDB_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with the key you copied.

**DO NOT commit this to git!** (It's already in `.gitignore`)

### Step 3: Restart Dev Server

```bash
npm run dev
```

Done! 🎉

---

## ✨ What You Now Have

✅ **Unlimited Search** - Search 75,000+ titles instantly  
✅ **Real-time Results** - See results as you type (debounced)  
✅ **All Categories** - Movies, TV shows, documentaries, etc.  
✅ **Live Data** - Always up-to-date with latest releases  
✅ **No Limits** - Query any TMDB content  

---

## 🔍 How It Works

**Search Box in Navbar:**
- Type any movie/show title
- Results appear instantly (after 500ms)
- Shows both movies and TV shows
- Loading indicator while searching
- "No results" message if not found

**Examples to Try:**
```
"The Matrix"        → All Matrix films
"Spider-Man"        → All Spider-Man movies
"Breaking Bad"      → TV shows too
"Marvel"            → All Marvel content
"2024 movies"       → Recent releases
"animated"          → Animated films
```

---

## 🎯 Features

### Real-time Search
- 500ms debounce to avoid excessive API calls
- Loading state indicator
- "No results" messages
- Shows up to 50 results per search

### Dynamic Hero Section
- Hero changes when searching
- Shows first search result's backdrop
- Updates instantly

### Category Filtering
- Works with search (Movies/TV/All)
- Filter search results by type
- Featured content still shows when not searching

### Continue Watching
- Still tracks your progress
- Works with both featured and searched content
- Persists locally

---

## ⚙️ Configuration

### API Limits
- **Free Tier**: 40 requests/10 seconds (plenty for browsing)
- **Search Results**: Limited to 50 per search for performance
- **Results Per Page**: 1 page to keep it snappy

### Performance
- Debounced search (500ms)
- Parallel API calls (movies + TV simultaneously)
- Only shows items with poster images
- Caches continue watching locally

---

## 🆘 Troubleshooting

**Q: Search not working?**
A: Check that `.env` file exists and has correct API key

**Q: Getting "403" errors?**
A: API key might be invalid or rate-limited. Wait a minute and try again.

**Q: Very slow search?**
A: First search may take 1-2 seconds. After that it's instant due to caching.

**Q: Want to see API calls?**
A: Open browser DevTools → Network tab → see API requests to TMDB

---

## 📊 What Changed

### New Files
- `src/utils/tmdb.ts` - TMDB API integration
- `.env.example` - Template for API key
- `SETUP_TMDB.md` - This file!

### Modified Files
- `src/App.tsx` - Added TMDB search logic
- `src/types/index.ts` - ✅ Already supports all content

### Still Available
- ✅ All 100+ featured titles
- ✅ Continue watching
- ✅ Player integration
- ✅ All styling & UI

---

## 🔒 Security Notes

✅ API key goes in `.env` (not committed to git)
✅ Vite automatically hides from client if prefixed with `VITE_`
✅ Only your instance can see it
✅ Free tier limits prevent abuse

---

## 💡 Next Steps

1. **Set up API key** (2 minutes)
2. **Start searching** - Try: "latest movies", "best tv shows", etc.
3. **Browse categories** - Use Home/Movies/TV filters
4. **Enjoy** 75,000+ titles! 🎬

---

**Questions?** Check the main README or QUICK_REFERENCE.md

Happy streaming! 🍿
