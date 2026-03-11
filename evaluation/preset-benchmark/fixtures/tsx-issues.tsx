import React, { useState } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
}

// ── Issue 1: click handler on a <div> — no role, no keyboard support ──────
const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const [liked, setLiked] = useState(false);

  return (
    <div
      className="product-card"
      onClick={() => (window.location.href = `/products/${product.id}`)}
    >
      <div className="product-actions">
        {/* Issue 2: icon-only button with no accessible name (no aria-label) */}
        <button onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09
                 C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5
                 c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill={liked ? 'red' : 'grey'}
            />
          </svg>
        </button>
      </div>
      <h3>{product.name}</h3>
      <p className="price">£{product.price.toFixed(2)}</p>
    </div>
  );
};

// ── Issues 3, 4, 5 ────────────────────────────────────────────────────────
const SettingsForm: React.FC = () => {
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState(false);

  return (
    <div role="form">
      <h2>User Settings</h2>

      {/* Issue 3: text input with only a placeholder, no <label> */}
      <input
        type="text"
        placeholder="Display name"
        className="input"
      />

      {/* Issue 4: <select> has no associated label */}
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>

      {/* Issue 5: interactive toggle built from <div> — no role, no keyboard */}
      <div
        className={`toggle ${notifications ? 'on' : 'off'}`}
        onClick={() => setNotifications(!notifications)}
      >
        Notifications: {notifications ? 'On' : 'Off'}
      </div>

      {/* Issue 6: video with autoPlay — can distract / cause issues for users
          with vestibular disorders; no controls to pause */}
      <video src="/tutorial.mp4" autoPlay loop muted>
        Your browser does not support video.
      </video>
    </div>
  );
};

export { ProductCard, SettingsForm };
