import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PptxRenderer } from "pptx-browser";
import { getDeck, getDeckFile, listDecks, updateDeck } from "../api.js";

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
  const [fullscreen, setFullscreen] = useState(false);
  const skipIndexRender = useRef(true);
  const indexRef = useRef(0);

  function slideRenderWidth() {
    const stage = stageRef.current;
    const cssWidth = stage?.clientWidth || 1600;
    const dpr = window.devicePixelRatio || 1;
    return Math.min(3840, Math.max(1280, Math.round(cssWidth * dpr)));
  }

  async function paintSlide(slideIndex) {
    const renderer = rendererRef.current;
    const dest = canvasRef.current;
    if (!renderer || !dest) return;
    const scratch = document.createElement("canvas");
    await renderer.renderSlide(slideIndex, scratch, slideRenderWidth());
    dest.width = scratch.width;
    dest.height = scratch.height;
    dest.getContext("2d").drawImage(scratch, 0, 0);
  }

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
        const buffer = await getDeckFile(id);
        if (cancelled) return;
        await renderer.load(buffer);
        if (cancelled) return;
        setSlideCount(renderer.slideCount);
        await paintSlide(0);
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
    indexRef.current = index;
    if (loading || slideCount === 0) return undefined;
    if (skipIndexRender.current) {
      skipIndexRender.current = false;
      return undefined;
    }
    if (!rendererRef.current) return undefined;
    const gen = (paintGen.current += 1);
    let cancelled = false;
    (async () => {
      try {
        await paintSlide(index);
        if (cancelled || gen !== paintGen.current) return;
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
    function syncFullscreen() {
      const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setFullscreen(active);
      document.documentElement.classList.toggle("is-deck-fullscreen", active);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      document.removeEventListener("webkitfullscreenchange", syncFullscreen);
      document.documentElement.classList.remove("is-deck-fullscreen");
    };
  }, []);

  useLayoutEffect(() => {
    if (loading || slideCount === 0 || !rendererRef.current) return undefined;
    paintSlide(indexRef.current).catch(() => {});
  }, [fullscreen, loading, slideCount]);

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
    const apiActive = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreen || apiActive) {
      document.documentElement.classList.remove("is-deck-fullscreen");
      setFullscreen(false);
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    document.documentElement.classList.add("is-deck-fullscreen");
    setFullscreen(true);
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    Promise.resolve(request?.call(root)).catch(() => {
      /* Presentation layout still fills the window if the Fullscreen API is blocked. */
    });
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

      <section className="stage-wrap">
        <div
          className={`stage ${fullscreen ? "is-fullscreen" : ""}`}
          ref={stageRef}
        >
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
            {fullscreen ? "Exit full screen" : "Full screen"}
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
                    <img src={item.thumbnailUrl} alt="" />
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
