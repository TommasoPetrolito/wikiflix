# Flux Content Library

## 📊 Current Content Stats

### Movies: **30 Titles** (from 50K+ available via Vidking)
- **2024 Releases**: 10 movies
- **2023 Releases**: 8 movies  
- **2022 Releases**: 2 movies
- **2014-2019**: 7 movies
- **Classics**: 3 movies

**Categories:**
- Trending Now (30 movies)
- Action & Adventure (14 movies)

### TV Shows: **20 Series** (from 25K+ available via Vidking)
- **2020s**: 8 shows
- **2010s**: 7 shows
- **2000s**: 3 shows
- **1990s**: 2 shows

**Categories:**
- Popular TV Shows (20 series)

## 🎬 Featured Content

### Trending Movies Include:
- Carry-On (2024)
- Deadpool & Wolverine (2024)
- Gladiator II (2024)
- Dune: Part Two (2024)
- Inside Out 2 (2024)
- Spider-Man: No Way Home (2021)
- Avengers: Endgame (2019)
- The Dark Knight (2008)
- Inception (2010)
- And many more blockbusters!

### Popular TV Shows Include:
- The Last of Us (2023)
- House of the Dragon (2022)
- Wednesday (2022)
- Arcane (2021)
- Breaking Bad (2008-2013)
- Game of Thrones (2011-2019)
- The Office (2005-2013)
- Friends (1994-2004)
- And many more hit series!

## 🚀 Vidking API Coverage

**Total Available:**
- ✅ **50,000+ Movies**
- ✅ **25,000+ TV Shows**
- ✅ **1,500+ 4K Movies**
- ✅ **99.9% Uptime**

**All Content Accessible Through:**
- TMDB IDs for movies
- TMDB IDs + Season/Episode for TV shows

## 📈 How to Add More Content

1. Find content on [TMDB](https://www.themoviedb.org)
2. Get the TMDB ID from the URL
3. Add to `src/data/content.ts`:

```typescript
{
  id: 123456,              // TMDB ID
  title: "Movie Name",
  type: "movie",           // or "tv"
  year: 2024,
  poster: "/path.jpg",     // From TMDB
  backdrop: "/path.jpg",   // From TMDB
  description: "...",
  // For TV shows:
  season: 1,
  episode: 1
}
```

## 🎯 Content Categories

Current categories in the app:
1. **Continue Watching** - Recently watched (auto-populated)
2. **Trending Now** - Latest blockbusters
3. **Popular TV Shows** - Hit series
4. **Action & Adventure** - Action-packed content

## 💡 Expanding the Library

Want to add more content? You can:

1. **Add more categories** in `App.tsx`
2. **Create genre-specific arrays** in `content.ts`
3. **Integrate TMDB API** for dynamic content
4. **Use Vidking's full catalog** - any TMDB ID works!

## 📝 Note

This is a **curated selection** showcasing the platform. 

**Every movie and TV show on TMDB can be played through Vidking** - we're just displaying a hand-picked collection for demonstration.

To access the full 75K+ title library, integrate the TMDB API or manually add more content IDs.

---

**Powered by Vidking Player API** 🎬

