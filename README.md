# ZenDen Slides

Upload PowerPoint decks, keep them on a shelf, and play them through at a pace you choose.

**Live site:** [https://pawsp7.github.io/ZenDenSlides/](https://pawsp7.github.io/ZenDenSlides/)

Every push to `main` publishes a static build to the `gh-pages` branch. Decks on the hosted site stay in the browser (IndexedDB). Self-hosting with `npm start` keeps uploads on disk.

### First-time Pages enablement

GitHub Pages has to be switched on once for this repository:

1. Open [Pages settings](https://github.com/pawsp7/ZenDenSlides/settings/pages)
2. Set **Source** to **Deploy from a branch**
3. Set **Branch** to `gh-pages` and the folder to `/ (root)`
4. Save

The site is then served at the URL above.

## What it does

- Drop one or many `.pptx` files onto the library
- Browse every uploaded deck from the home shelf or while a deck is playing
- Auto-advance slides at a set number of seconds per slide (changeable per deck, live in the player)
- Pause, step, loop, jump from the filmstrip, or open full screen

Legacy `.ppt` files are not supported — save them as `.pptx` in PowerPoint first.

## Run it locally

```bash
npm install
npm run dev
```

The UI is at [http://localhost:5173](http://localhost:5173). Uploads are stored in `data/`.

To run the production build:

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

Pushes to `main` deploy the static site to GitHub Pages.

## Tests

```bash
npm test
```
