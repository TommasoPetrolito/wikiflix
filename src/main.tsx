import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import SearchPage from './pages/SearchPage.tsx'
import AIPage from './pages/AIPage.tsx'
import { ThemeProvider } from './contexts/ThemeContext.tsx'
import { LanguageProvider } from './contexts/LanguageContext.tsx'
import './index.css'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/search', element: <SearchPage /> },
  { path: '/ai', element: <AIPage /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <RouterProvider
          router={router}
        />
      </ThemeProvider>
    </LanguageProvider>
  </React.StrictMode>,
)

