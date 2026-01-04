import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import SearchPage from './pages/SearchPage.tsx'
import SportsPage from './pages/SportsPage.tsx'
import AIPage from './pages/AIPage.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import './index.css'

const router = createBrowserRouter(
  [
    { path: '/', element: <App /> },
    { path: '/search', element: <SearchPage /> },
    { path: '/sports', element: <SportsPage /> },
    { path: '/ai', element: <AIPage /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
)

