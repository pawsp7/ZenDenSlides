# ZenDen Slides

Upload PowerPoint decks, keep them on a shared shelf, and play them through at a pace you choose.

## What it does

- Drop one or many `.pptx` files onto the library
- Browse every uploaded deck from the home shelf or while a deck is playing
- Auto-advance slides at a set number of seconds per slide (changeable per deck, live in the player)
- Pause, step, loop, jump from the filmstrip, or open full screen

Legacy `.ppt` files are not supported — save them as `.pptx` in PowerPoint first.

## Run it

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

## Tests

```bash
npm test
```
