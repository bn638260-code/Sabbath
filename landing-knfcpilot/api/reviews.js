// KNFC pilot reviews API — public list via Vercel Blob (optional).
const BLOB_HOST = "https://blob.vercel-storage.com";
const PREFIX = "pilot/reviews/";
const MAX_REVIEWS = 300;

function clean(s, max) {
  return String(s || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}

function authHeaders() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  return {
    authorization: "Bearer " + token,
    "x-api-version": "7",
  };
}

async function listReviews() {
  const headers = authHeaders();
  if (!headers) return [];
  const r = await fetch(
    BLOB_HOST + "?prefix=" + encodeURIComponent(PREFIX) + "&limit=1000",
    { headers }
  );
  if (!r.ok) throw new Error("blob list failed: " + r.status);
  const data = await r.json();
  const blobs = (data.blobs || [])
    .sort((a, b) => (a.pathname < b.pathname ? 1 : -1))
    .slice(0, MAX_REVIEWS);
  const items = await Promise.all(
    blobs.map(async (b) => {
      try {
        const res = await fetch(b.url);
        if (!res.ok) return null;
        const rev = await res.json();
        return rev && rev.name && rev.text ? rev : null;
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean);
}

async function saveReview(review) {
  const headers = authHeaders();
  if (!headers) return;
  const r = await fetch(BLOB_HOST + "/" + PREFIX + Date.now() + ".json", {
    method: "PUT",
    headers: Object.assign(headers, {
      "x-add-random-suffix": "1",
      "x-content-type": "application/json",
    }),
    body: JSON.stringify(review),
  });
  if (!r.ok) throw new Error("blob write failed: " + r.status);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 10000) reject(new Error("too large"));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      return res.status(200).json(await listReviews());
    }
    if (req.method === "POST") {
      let body = {};
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return res.status(400).json({ error: "Invalid request body." });
      }
      const review = {
        name: clean(body.name, 60),
        church: clean(body.church, 80),
        text: clean(body.text, 600),
        rating: Math.round(Number(body.rating)),
        date: new Date().toISOString().slice(0, 10),
      };
      if (
        !review.name ||
        !review.text ||
        !(review.rating >= 1 && review.rating <= 5)
      ) {
        return res
          .status(400)
          .json({ error: "Name, rating and review text are required." });
      }
      try {
        await saveReview(review);
      } catch {
        // Public wall is optional when Blob is not configured.
      }
      return res.status(200).json({ ok: true, review });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong. Please try again.";
    return res.status(500).json({ error: message });
  }
}
