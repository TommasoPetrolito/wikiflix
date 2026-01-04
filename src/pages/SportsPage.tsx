import { useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { Category } from '@/types';
import './SportsPage.css';

export default function SportsPage() {
  const currentCategory = useMemo<Category>(() => 'sports', []);
  const searchQuery = '';

  return (
    <div className="sports-page">
      <Navbar
        currentCategory={currentCategory}
        onCategoryChange={() => {}}
        searchQuery={searchQuery}
        onSearchChange={() => {}}
        onSearchSubmit={() => {}}
      />
      <main className="sports-content">
        <div className="sports-placeholder">
          <h1>Sports streams are not available</h1>
          <p>We have removed third-party stream providers. Please browse movies and series instead.</p>
        </div>
      </main>
    </div>
  );
}
