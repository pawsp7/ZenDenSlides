export async function listDecks() {
  const res = await fetch("/api/decks");
  if (!res.ok) throw new Error(await readError(res, "Could not load the library."));
  return res.json();
}

export async function getDeck(id) {
  const res = await fetch(`/api/decks/${id}`);
  if (!res.ok) throw new Error(await readError(res, "Deck not found."));
  return res.json();
}

export async function updateDeck(id, patch) {
  const res = await fetch(`/api/decks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await readError(res, "Could not update this deck."));
  return res.json();
}

export async function deleteDeck(id) {
  const res = await fetch(`/api/decks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res, "Could not remove this deck."));
}

export function uploadDecks(files, intervalSeconds, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("intervalSeconds", String(intervalSeconds));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/decks");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText);
          resolve(Array.isArray(payload) ? payload : [payload]);
        } catch (err) {
          reject(err);
        }
      } else {
        try {
          reject(new Error(JSON.parse(xhr.responseText).error));
        } catch {
          reject(new Error("Upload failed."));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.send(form);
  });
}

async function readError(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}
