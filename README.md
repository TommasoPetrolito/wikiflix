# 🎬 Flux

A Netflix-inspired streaming platform UI built with React, TypeScript, and Vite.

[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- 75,000+ movies and TV shows via TMDB API
- Netflix-inspired UI/UX design
- Advanced search with actor profiles
- Progress tracking and watch list
- Live sports streaming
- Fully responsive design
- Type-safe with TypeScript

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Ennyw/flux.git
cd flux

# Install dependencies
npm install

# Add your TMDB API key to .env
# Get free key: https://www.themoviedb.org/settings/api

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

Create a `.env` file:

```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_SPORTSDB_API_KEY=your_sportsdb_key_here  # Optional
```

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TMDB API** - Movie/TV metadata
- **TheSportsDB** - Sports data

## Project Structure

```
flux/
├── src/
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── utils/         # API clients & utilities
│   └── hooks/         # Custom React hooks
├── scripts/           # Setup scripts
└── .env.example       # Environment template
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This project is for **educational purposes only**. It is a UI/UX demonstration showcasing modern web development techniques. No copyrighted content is hosted or distributed. Users are responsible for compliance with all applicable laws and terms of service.

---

**Made with React + TypeScript + Vite**
