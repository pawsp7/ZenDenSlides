import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PptxRenderer } from "pptx-browser";
import { getDeck, listDecks, updateDeck } from "../api.js";

function formatClock(seconds) {
  const n = Math.max(0, seconds);
  return n >= 10 ? n.toFixed(1) : n.toFixed(1);
}

export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const stageRef = useRef(null);
  const paintGen = useRef(0);

  const [deck, setDeck] = useState(null);
  const [library, setLibrary] = useState([]);
  const [slideCount, setSlideCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState([]);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [status, setStatus] = useState("Opening deck…");
  const skipIndexRender = useRef(true);

  useEffect(() => {
    listDecks().then(setLibrary).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const renderer = new PptxRenderer();
    rendererRef.current = renderer;
    setLoading(true);
    setError("");
    setIndex(0);
    setThumbs([]);
    setPlaying(true);
    setProgress(0);
    paintGen.current += 1;

    (async () => {
      try {
        const meta = await getDeck(id);
        if (cancelled) return;
        setDeck(meta);
        setIntervalSeconds(meta.intervalSeconds);
        setStatus("Reading slides…");
        const response = await fetch(`/api/decks/${id}/file`);
        if (!response.ok) throw new Error("Could not download this PowerPoint.");
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        await renderer.load(buffer);
        if (cancelled) return;
        setSlideCount(renderer.slideCount);
        const canvas = canvasRef.current;
        if (canvas) await renderer.renderSlide(0, canvas, 1600);
        if (cancelled) return;
        skipIndexRender.current = true;
        setLoading(false);
        setStatus("");
        const strip = [];
        for (let i = 0; i < renderer.slideCount; i += 1) {
          const thumb = document.createElement("canvas");
          try {
            await renderer.renderSlide(i, thumb, 220);
            strip.push(thumb.toDataURL("image/jpeg", 0.72));
          } catch {
            strip.push("");
          }
        }
        if (!cancelled) setThumbs(strip);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not open this deck.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (loading || slideCount === 0) return undefined;
    if (skipIndexRender.current) {
      skipIndexRender.current = false;
      return undefined;
    }
    const renderer = rendererRef.current;
    if (!renderer) return undefined;
    const gen = (paintGen.current += 1);
    let cancelled = false;
    (async () => {
      try {
        const scratch = document.createElement("canvas");
        await renderer.renderSlide(index, scratch, 1600);
        if (cancelled || gen !== paintGen.current) return;
        const dest = canvasRef.current;
        if (!dest) return;
        dest.width = scratch.width;
        dest.height = scratch.height;
        dest.getContext("2d").drawImage(scratch, 0, 0);
      } catch {
        // Renderer was torn down while navigating between decks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, loading, slideCount]);

  useEffect(() => {
    if (!playing || loading || slideCount === 0) return undefined;
    const started = Date.now();
    const duration = intervalSeconds * 1000;
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setProgress(Math.min(1, elapsed / duration));
      if (elapsed >= duration) {
        setIndex((current) => {
          if (current + 1 < slideCount) return current + 1;
          if (loop) return 0;
          setPlaying(false);
          return current;
        });
        setProgress(0);
      }
    }, 50);
    return () => window.clearInterval(tick);
  }, [playing, loading, slideCount, intervalSeconds, loop, index]);

  useEffect(() => {
    function onKey(event) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(slideCount - 1, current + 1));
        setProgress(0);
      } else if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(0, current - 1));
        setProgress(0);
      } else if (event.key === "f") {
        toggleFullscreen();
      } else if (event.key === "b") {
        setBrowseOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideCount]);

  function toggleFullscreen() {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      node.requestFullscreen?.().catch(() => {});
    }
  }

  async function persistPace(seconds) {
    setIntervalSeconds(seconds);
    if (deck) {
      const next = await updateDeck(deck.id, { intervalSeconds: seconds });
      setDeck(next);
    }
  }

  const others = useMemo(
    () => library.filter((item) => item.id !== id),
    [library, id],
  );

  if (error) {
    return (
      <main className="player-page">
        <header className="player-bar">
          <Link to="/" className="brand small">
            Back to the den
          </Link>
        </header>
        <p className="banner error">{error}</p>
      </main>
    );
  }

  return (
    <main className="player-page">
      <header className="player-bar">
        <Link to="/" className="ghost-link">
          ← The den
        </Link>
        <div className="now-showing">
          <p className="eyebrow">Now showing</p>
          <h1>{deck?.title || "Opening…"}</h1>
        </div>
        <button type="button" className="btn btn-quiet" onClick={() => setBrowseOpen(true)}>
          Browse decks ({library.length})
        </button>
      </header>

      <section className="stage-wrap" ref={stageRef}>
        <div className="stage">
          <canvas ref={canvasRef} className="is-front" />
          {loading ? <div className="stage-mask">{status || "Preparing slides…"}</div> : null}
        </div>
      </section>

      <section className="transport">
        <div className="transport-row">
          <button type="button" className="btn btn-copper" onClick={() => setPlaying((value) => !value)}>
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setIndex((current) => Math.max(0, current - 1));
              setProgress(0);
            }}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              setIndex((current) => Math.min(Math.max(slideCount - 1, 0), current + 1));
              setProgress(0);
            }}
          >
            Next
          </button>
          <p className="counter">
            {slideCount ? `${index + 1} / ${slideCount}` : "—"}
          </p>
          <label className="loop">
            <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
            Loop
          </label>
          <button type="button" className="btn btn-quiet" onClick={toggleFullscreen}>
            Full screen
          </button>
        </div>

        <div className="meter" aria-hidden="true">
          <div className="meter-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="meter-label">
          {playing
            ? `${formatClock((1 - progress) * intervalSeconds)}s until the next slide`
            : "Paused"}
        </p>

        <label className="pace-field wide">
          <span>Seconds per slide</span>
          <div className="pace-row">
            <input
              type="range"
              min="1"
              max="30"
              value={intervalSeconds}
              onChange={(event) => persistPace(Number(event.target.value))}
            />
            <strong>{intervalSeconds}s</strong>
          </div>
        </label>
      </section>

      {thumbs.length > 0 ? (
        <nav className="filmstrip" aria-label="Slides">
          {thumbs.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={i === index ? "is-current" : ""}
              onClick={() => {
                setIndex(i);
                setProgress(0);
              }}
            >
              <img src={src} alt={`Slide ${i + 1}`} />
            </button>
          ))}
        </nav>
      ) : null}

      <p className="keys">
        Space plays or pauses · arrows step · F full screen · B browse
      </p>

      {browseOpen ? (
        <div className="drawer-backdrop" onClick={() => setBrowseOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <h2>All decks</h2>
              <button type="button" className="text-btn" onClick={() => setBrowseOpen(false)}>
                Close
              </button>
            </div>
            <ul>
              {library.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === id ? "is-current" : ""}
                    onClick={() => {
                      setBrowseOpen(false);
                      if (item.id !== id) navigate(`/play/${item.id}`);
                    }}
                  >
                    <img src={`/api/decks/${item.id}/thumbnail`} alt="" />
                    <span>
                      <strong>{item.title}</strong>
                      <em>
                        {item.slideCount} slides · {item.intervalSeconds}s
                      </em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {others.length === 0 ? <p className="muted">This is the only deck on the shelf.</p> : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
