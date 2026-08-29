import { NavLink, Route, Routes } from "react-router-dom";
import Library from "./pages/Library.jsx";
import Player from "./pages/Player.jsx";

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="6" width="26" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 16c3-6 13-6 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <header className="site-header">
                <NavLink to="/" className="brand">
                  <Mark />
                  <span>
                    ZenDen <em>Slides</em>
                  </span>
                </NavLink>
                <p className="tagline">Put a deck on the table. Let it unfold.</p>
              </header>
              <Library />
            </>
          }
        />
        <Route path="/play/:id" element={<Player />} />
      </Routes>
    </div>
  );
}
