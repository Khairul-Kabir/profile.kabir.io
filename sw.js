/* ===========================================================
   Nightshelf — sw.js
   Registered from my-books.html / storyBooks/story.html only.
   Scope has to be "/" because my-books.html lives at the site
   root, but the fetch handler only ever answers for Nightshelf's
   own paths below — every other request (the portfolio pages,
   islamic.html, anything else on this domain) is left completely
   untouched by returning early with no respondWith().
   =========================================================== */

var CACHE_NAME = "nightshelf-v1";

var SCOPE_PATHS = [
  "/my-books.html",
  "/manifest.webmanifest",
  "/storyBooks/"
];

function inScope(url) {
  var path;
  try { path = new URL(url).pathname; } catch (e) { return false; }
  return SCOPE_PATHS.some(function (p) { return path === p || path.indexOf(p) === 0; });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll([
        "/my-books.html",
        "/manifest.webmanifest",
        "/storyBooks/story.html",
        "/storyBooks/style.css",
        "/storyBooks/storyapp.js",
        "/storyBooks/lib/jquery.min.js",
        "/storyBooks/lib/bootstrap.min.css",
        "/storyBooks/lib/bootstrap.bundle.min.js"
      ]);
    }).catch(function () { /* fine if a path 404s during dev */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET" || !inScope(event.request.url)) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (response) {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, response.clone()); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
