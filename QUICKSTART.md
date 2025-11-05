# Flux React - Quick Start

## 🚀 Get Started (30 seconds)

```bash
cd flux
npm install
npm run dev
```

Open: **http://localhost:3000**

## ✨ What You Have

A **professional React + TypeScript streaming platform** with:

- ✅ Modern React 18 + TypeScript
- ✅ Vite for instant dev/build
- ✅ Professional component architecture
- ✅ Type-safe code
- ✅ Smart state management
- ✅ Custom hooks
- ✅ Responsive design
- ✅ Framer Motion animations
- ✅ Vidking Player integration
- ✅ Progress tracking
- ✅ Continue watching
- ✅ Search & filters

## 📁 File Structure

```
src/
├── components/          React components
│   ├── Navbar.tsx      Navigation bar
│   ├── Hero.tsx        Hero section
│   ├── ContentCard.tsx Movie/TV card
│   ├── ContentGrid.tsx Content grid
│   └── PlayerModal.tsx Video player modal
├── data/               Content library
├── hooks/              Custom React hooks
├── types/              TypeScript types
├── utils/              Utilities
└── App.tsx             Main app
```

## 🎨 Customize

### Add Movies
Edit `src/data/content.ts`:
```typescript
export const trendingMovies: Content[] = [
  { id: 123, title: "Movie", type: "movie", ... }
];
```

### Change Colors
Edit `src/index.css`:
```css
:root {
  --primary: #e50914;
}
```

### Modify Components
All components are in `src/components/` - fully customizable!

## 🛠️ Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## 📦 Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type safety
- **Vite** - Lightning-fast builds
- **Framer Motion** - Smooth animations
- **CSS Modules** - Scoped styling

## 🌐 Deploy

```bash
# Build
npm run build

# Deploy dist/ folder to:
- Vercel
- Netlify
- GitHub Pages
- Any static host
```

## 🎯 Features

### Components
- **Navbar**: Category filter, search
- **Hero**: Featured content banner
- **ContentGrid**: Movie/TV grid with hover
- **ContentCard**: Individual content card
- **PlayerModal**: Fullscreen video player

### Hooks
- **usePlayerTracking**: Vidking event tracking

### Utils
- **storage**: localStorage management
- **vidking**: Player URL builder

### Types
- **Content**: Movie/TV show type
- **WatchProgress**: Progress tracking
- **PlayerEvent**: Vidking events

## 🔥 Pro Tips

1. **Hot Reload**: Edit files, see changes instantly
2. **TypeScript**: Get autocomplete and type checking
3. **Component Based**: Easy to modify and extend
4. **Performance**: Optimized with React.memo and useMemo
5. **Professional**: Production-ready code

## 🆘 Troubleshooting

### Port in use?
```bash
# Change port in vite.config.ts
server: { port: 3001 }
```

### Build errors?
```bash
rm -rf node_modules
npm install
```

### Type errors?
Check `src/types/index.ts` for type definitions

## 📚 Learn More

- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org)
- [Vite Docs](https://vitejs.dev)
- [Vidking API](https://www.vidking.net)

---

**You now have a professional React streaming platform! 🎬**

Start customizing and make it your own!

