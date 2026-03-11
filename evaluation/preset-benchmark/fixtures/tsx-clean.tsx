import React, { useState, useRef, useEffect, useId } from 'react';

interface Article {
  id: number;
  title: string;
  summary: string;
  url: string;
}

// Fully accessible article list
const ArticleList: React.FC<{ articles: Article[] }> = ({ articles }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Latest Articles</h2>
      <ul>
        {articles.map((article) => (
          <li key={article.id}>
            <h3>
              <a href={article.url}>{article.title}</a>
            </h3>
            <p>{article.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

// Accessible search form
const SearchBox: React.FC<{ onSearch: (q: string) => void }> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const inputId = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} role="search">
      <label htmlFor={inputId}>Search articles</label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <button type="submit">Search</button>
    </form>
  );
};

// Accessible favourite button with visible label
const FavouriteButton: React.FC<{ label: string }> = ({ label }) => {
  const [active, setActive] = useState(false);
  return (
    <button
      aria-pressed={active}
      onClick={() => setActive((v) => !v)}
      aria-label={`${active ? 'Remove from' : 'Add to'} favourites: ${label}`}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </button>
  );
};

export { ArticleList, SearchBox, FavouriteButton };
