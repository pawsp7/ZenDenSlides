import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { deleteDeck, listDecks, updateDeck, uploadDecks } from "../api.js";

const PRESETS = [3, 5, 8, 15];

function formatWhen(iso) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DeckCard({ deck, onDelete, onRename, onPace }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(deck.title);

  return (
    <article className="deck-card">
      <Link to={`/play/${deck.id}`} className="thumb-link" aria-label={`Play ${deck.title}`}>
        <img src={`/api/decks/${deck.id}/thumbnail`} alt="" />
        <span className="play-badge">Play</span>
      </Link>
      <div className="deck-body">
        {editing ? (
          <form
            className="rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              onRename(deck.id, draft);
              setEditing(false);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              aria-label="Deck title"
            />
            <button type="submit">Save</button>
          </form>
        ) : (
          <h2>
            <Link to={`/play/${deck.id}`}>{deck.title}</Link>
          </h2>
        )}
        <p className="deck-meta">
          {deck.slideCount} {deck.slideCount === 1 ? "slide" : "slides"} · every {deck.intervalSeconds}s
          <span> · {formatWhen(deck.createdAt)}</span>
        </p>
        <div className="deck-actions">
          <Link className="btn btn-copper" to={`/play/${deck.id}`}>
            Open
          </Link>
          <label className="pace-mini">
            Pace
            <select
              value={deck.intervalSeconds}
              onChange={(event) => onPace(deck.id, Number(event.target.value))}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}s
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="text-btn" onClick={() => setEditing(true)}>
            Rename
          </button>
          <button type="button" className="text-btn danger" onClick={() => onDelete(deck.id, deck.title)}>
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Library() {
  const [decks, setDecks] = useState([]);
  const [query, setQuery] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    const next = await listDecks();
    setDecks(next);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return decks;
    return decks.filter((deck) =>
      `${deck.title} ${deck.originalName}`.toLowerCase().includes(needle),
    );
  }, [decks, query]);

  async function handleFiles(fileList) {
    const files = [...fileList].filter((file) => file.name.toLowerCase().endsWith(".pptx"));
    if (files.length === 0) {
      setError("Drop .pptx files — older .ppt decks need to be saved as PowerPoint (.pptx) first.");
      return;
    }
    setError("");
    setBusy(true);
    setProgress(0);
    try {
      await uploadDecks(files, intervalSeconds, setProgress);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <main className="library">
      <section
        className={`dropzone ${dragOver ? "is-over" : ""} ${busy ? "is-busy" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <div>
          <p className="eyebrow">Bring a deck in</p>
          <h1>Drop PowerPoints here</h1>
          <p className="lede">
            They stay on this shelf until you take them down. Playback walks through every slide
            at the pace you set.
          </p>
        </div>
        <div className="drop-controls">
          <label className="pace-field">
            <span>Seconds per slide</span>
            <div className="pace-row">
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={intervalSeconds}
                onChange={(event) => setIntervalSeconds(Number(event.target.value))}
              />
              <strong>{intervalSeconds}s</strong>
            </div>
            <div className="presets">
              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === intervalSeconds ? "is-on" : ""}
                  onClick={() => setIntervalSeconds(n)}
                >
                  {n}s
                </button>
              ))}
            </div>
          </label>
          <button type="button" className="btn btn-copper" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? `Uploading ${Math.round(progress * 100)}%` : "Choose files"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            multiple
            hidden
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </section>

      {error ? <p className="banner error">{error}</p> : null}

      <section className="shelf">
        <div className="shelf-head">
          <h2>Decks in the den</h2>
          <input
            className="search"
            type="search"
            placeholder="Find a deck"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search decks"
          />
        </div>
        {visible.length === 0 ? (
          <div className="empty">
            <p>{decks.length === 0 ? "The shelf is empty." : "Nothing matches that search."}</p>
            <p className="muted">
              {decks.length === 0
                ? "Upload a .pptx to begin. You can drop several at once."
                : "Try a different name, or clear the search."}
            </p>
          </div>
        ) : (
          <div className="deck-grid">
            {visible.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onDelete={async (id, title) => {
                  if (!window.confirm(`Remove “${title}” from the den?`)) return;
                  await deleteDeck(id);
                  await refresh();
                }}
                onRename={async (id, title) => {
                  await updateDeck(id, { title });
                  await refresh();
                }}
                onPace={async (id, seconds) => {
                  await updateDeck(id, { intervalSeconds: seconds });
                  await refresh();
                }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
