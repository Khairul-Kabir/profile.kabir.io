/* ===========================================================
   Nightshelf — storyapp.js
   Shared logic for my-books.html (landing/shelf) and story.html
   (episode list + reader). Detects which page it's on by the
   DOM elements present and wires up only what's needed.
   =========================================================== */

(function ($) {
  "use strict";

  var APP_ROOT = window.location.pathname.toLowerCase().indexOf("/storybooks/") !== -1 ? "" : "storyBooks/";
  var INDEX_URL = resolvePath("stories/stories-index.js");
  var THEME_KEY = "ns-theme";
  var FONT_KEY = "ns-fontsize";
  var CONTINUE_KEY = "ns-continue";
  var WORDS_PER_MIN = 200;
  var PAGE_CHAR_LIMIT = 1100; // episodes longer than this get split into reader pages

  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20.4 14.7A8.4 8.4 0 0 1 9.3 3.6a.5.5 0 0 0-.6-.7A9 9 0 1 0 21.1 15.3a.5.5 0 0 0-.7-.6Z"/></svg>'
  };

  function resolvePath(path) {
    if (!path || /^(https?:|data:|\/)/i.test(path)) return path;

    var queryIndex = path.indexOf("?");
    var base = queryIndex === -1 ? path : path.slice(0, queryIndex);
    var suffix = queryIndex === -1 ? "" : path.slice(queryIndex);

    if (/^storybooks\//i.test(base)) {
      base = base.replace(/^storybooks\//i, "storyBooks/");
    }
    if (/^storyassets\//i.test(base)) {
      base = base.replace(/^storyassets\//i, "storyAssets/");
    }

    if (/^storyBooks\//i.test(base)) {
      return APP_ROOT ? base : base.replace(/^storyBooks\//i, "") + suffix;
    }
    if (/^storyAssets\//i.test(base)) {
      return APP_ROOT ? base.replace(/^storyAssets\//i, "storyBooks/storyAssets/") + suffix : base + suffix;
    }
    if (/^stories\//i.test(base)) {
      return APP_ROOT ? base.replace(/^stories\//i, "storyBooks/stories/") + suffix : base + suffix;
    }
    if (/^assets\//i.test(base)) {
      return APP_ROOT ? base.replace(/^assets\//i, "storyBooks/assets/") + suffix : base + suffix;
    }

    return APP_ROOT ? APP_ROOT + base + suffix : base + suffix;
  }

  var storyCache = {};      // story id -> full story object
  var storySummaries = [];  // ordered list of story objects, for the shelf

  /* ---------------------------------------------------------
     Theme (light / dark)
     --------------------------------------------------------- */

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    var theme = saved || "dark";
    applyTheme(theme);

    $("#themeToggle").on("click", function () {
      var current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
      var next = current === "light" ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      $("#themeToggle").html(ICONS.moon).attr("title", "Switch to night mode");
    } else {
      document.documentElement.removeAttribute("data-theme");
      $("#themeToggle").html(ICONS.sun).attr("title", "Switch to day mode");
    }
  }

  /* ---------------------------------------------------------
     Content protection (best-effort deterrents)
     Nothing running in a browser tab can block an OS-level
     screenshot or a phone camera — this is a deterrent layer
     only: it disables the easy paths (select/copy/right-click/
     dev tools/print) and dims the page when the tab or window
     loses focus, the way a few reading apps do.
     --------------------------------------------------------- */

  var toastTimer;
  function showToast(msg) {
    var $t = $("#nsToast");
    if (!$t.length) return;
    clearTimeout(toastTimer);
    $t.text(msg).addClass("show");
    toastTimer = setTimeout(function () { $t.removeClass("show"); }, 2200);
  }

  function setPrivacyShield(on) {
    $("#nsPrivacyShield").toggleClass("active", !!on);
  }

  function initContentProtection() {
    document.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      showToast("Right-click is turned off on Nightshelf.");
    });

    document.addEventListener("copy", function (e) {
      e.preventDefault();
      showToast("Copying story text isn’t allowed here.");
    });
    document.addEventListener("cut", function (e) { e.preventDefault(); });

    document.addEventListener("dragstart", function (e) {
      if (e.target && e.target.tagName === "IMG") e.preventDefault();
    });

    document.addEventListener("keydown", function (e) {
      var key = (e.key || "").toLowerCase();
      var isCtrlCmd = e.ctrlKey || e.metaKey;
      var blockedCombo = isCtrlCmd && ["a", "c", "x", "s", "p", "u"].indexOf(key) !== -1;
      var blockedDevtools = e.key === "F12" || (isCtrlCmd && e.shiftKey && ["i", "j", "c"].indexOf(key) !== -1);

      if (blockedCombo || blockedDevtools) {
        e.preventDefault();
        showToast("That shortcut is disabled on this page.");
        return;
      }
      if (e.key === "PrintScreen") {
        setPrivacyShield(true);
        setTimeout(function () { setPrivacyShield(false); }, 700);
        showToast("Screenshots are discouraged — please respect the author’s work.");
      }
    });

    document.addEventListener("visibilitychange", function () {
      setPrivacyShield(document.hidden);
    });
    window.addEventListener("blur", function () { setPrivacyShield(true); });
    window.addEventListener("focus", function () { setPrivacyShield(false); });
  }

  /* ---------------------------------------------------------
     Install prompt (PWA)
     Registers the service worker (scoped so it only ever
     touches Nightshelf's own paths — see sw.js) and shows a
     custom "Install" button when the browser says the app is
     installable. iOS Safari never fires beforeinstallprompt, so
     it gets a one-tap set of instructions instead.
     --------------------------------------------------------- */

  function initInstallPrompt() {
    var $btn = $("#installBtn");
    if (!$btn.length) return;

    var isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) return; // already installed/running as an app — nothing to offer

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register(resolvePath("/sw.js")).catch(function () {});
    }

    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      $btn.removeClass("d-none").find(".label").text("Add to Home Screen");
      $btn.on("click", function () {
        showToast("Tap the Share icon, then “Add to Home Screen” to install Nightshelf.");
      });
      return;
    }

    var deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      $btn.removeClass("d-none");
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      $btn.addClass("d-none");
      showToast("Nightshelf is installed — find it on your home screen.");
    });

    $btn.on("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        $btn.addClass("d-none");
      });
    });
  }

  /* ---------------------------------------------------------
     Data loading
     Story data ships as plain .js files (each one just assigns
     an object into window.NS_STORIES) rather than .json fetched
     over AJAX. Browsers block fetch()/XHR against local files
     opened with file://, but a normal <script src="..."> tag
     works everywhere, including a straight double-click on
     my-books.html with no local server needed.
     --------------------------------------------------------- */

  function loadScript(src) {
    var d = $.Deferred();
    var el = document.createElement("script");
    el.src = resolvePath(src);
    el.onload = function () { d.resolve(); };
    el.onerror = function () { d.reject(); };
    document.head.appendChild(el);
    return d.promise();
  }

  function idFromPath(path) {
    return path.split("/").pop().replace(/\.js$/, "");
  }

  function loadStoryIndex() {
    return loadScript(INDEX_URL).then(function () {
      var files = window.NS_STORY_FILES || [];
      var requests = files.map(function (file) {
        return loadScript(resolvePath(file)).fail(function () {
          console.error("Nightshelf: failed to load story file", file);
        });
      });
      return $.when.apply($, requests).then(function () {
        files.forEach(function (file) {
          var story = window.NS_STORIES && window.NS_STORIES[idFromPath(file)];
          if (story) {
            storyCache[story.id] = story;
            storySummaries.push(story);
          }
        });
      });
    });
  }

  function loadSingleStory(storyId) {
    // story.html can be opened directly / bookmarked, so consult
    // the index first to find the right file for this story id.
    return loadScript(INDEX_URL).then(function () {
      var files = window.NS_STORY_FILES || [];
      var match = files.filter(function (f) { return idFromPath(f) === storyId; })[0];
      if (!match) return $.Deferred().reject().promise();
      return loadScript(resolvePath(match)).then(function () {
        var story = window.NS_STORIES && window.NS_STORIES[storyId];
        if (!story) return $.Deferred().reject().promise();
        storyCache[story.id] = story;
        return story;
      });
    });
  }

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */

  function escapeHtml(str) {
    return $("<div>").text(str == null ? "" : str).html();
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }
  function wordCount(text) {
    return (text || "").trim().split(/\s+/).filter(Boolean).length;
  }
  function readingTime(text) {
    var mins = Math.max(1, Math.round(wordCount(text) / WORDS_PER_MIN));
    return mins + " min read";
  }
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // Split an episode's text into reader "pages" on paragraph
  // boundaries only — never mid-paragraph — once it grows past
  // PAGE_CHAR_LIMIT. Short episodes come back as a single page.
  function paginateText(text) {
    var paras = (text || "").split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paras.length) return [[]];

    var pages = [];
    var current = [];
    var currentLen = 0;

    paras.forEach(function (p) {
      if (current.length && currentLen + p.length > PAGE_CHAR_LIMIT) {
        pages.push(current);
        current = [];
        currentLen = 0;
      }
      current.push(p);
      currentLen += p.length;
    });
    if (current.length) pages.push(current);
    return pages;
  }

  /* ---------------------------------------------------------
     Continue Reading (localStorage bookmark)
     --------------------------------------------------------- */

  function saveContinue(story, episodeIndex, pageIndex) {
    var ep = story.episodes[episodeIndex];
    localStorage.setItem(CONTINUE_KEY, JSON.stringify({
      storyId: story.id,
      storyTitle: story.title,
      storyCover: story.cover,
      episodeIndex: episodeIndex,
      pageIndex: pageIndex || 0,
      episodeTitle: ep.title,
      totalEpisodes: story.episodes.length,
      ts: Date.now()
    }));
  }

  function renderContinueCard() {
    var $card = $("#continueCard");
    if (!$card.length) return;

    var raw = localStorage.getItem(CONTINUE_KEY);
    if (!raw) return;

    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!data || !data.storyId) return;

    $("#continueCover").attr("src", data.storyCover).attr("alt", data.storyTitle);
    $("#continueTitle").text(data.storyTitle);
    $("#continueSub").text(
      "Episode " + (data.episodeIndex + 1) + " of " + data.totalEpisodes + " — " + data.episodeTitle
    );
    $card.css("display", "flex");
    $card.off("click").on("click", function () {
      var url = "story.html?story=" + encodeURIComponent(data.storyId) + "&ep=" + data.episodeIndex;
      if (data.pageIndex) url += "&pg=" + data.pageIndex;
      window.location.href = resolvePath(url);
    });
  }

  /* ---------------------------------------------------------
     Font size control (reader only)
     --------------------------------------------------------- */

  function initFontControls() {
    var $controls = $("#fontControls");
    if (!$controls.length) return;

    var scales = { sm: 0.9, md: 1, lg: 1.18 };
    var saved = localStorage.getItem(FONT_KEY) || "md";
    applyFontSize(saved);

    $controls.on("click", "button", function () {
      var size = $(this).data("size");
      applyFontSize(size);
      localStorage.setItem(FONT_KEY, size);
    });

    function applyFontSize(size) {
      document.documentElement.style.setProperty("--reading-scale", scales[size] || 1);
      $controls.find("button").removeClass("active");
      $controls.find('button[data-size="' + size + '"]').addClass("active");
    }
  }

  /* ---------------------------------------------------------
     Reading progress bar (reader only)
     --------------------------------------------------------- */

  function initProgressBar() {
    var $bar = $("#progressBar");
    if (!$bar.length) return;

    $(window).on("scroll", function () {
      if (!$("#view-reader").hasClass("active")) return;
      var doc = $(document);
      var scrollTop = $(window).scrollTop();
      var docHeight = doc.height() - $(window).height();
      var pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      $("#progressBarFill").css("width", pct + "%");
    });
  }

  /* ===========================================================
     PAGE: my-books.html — the shelf
     =========================================================== */

  function initLandingPage() {
    initTheme();
    renderContinueCard();

    loadStoryIndex()
      .then(function () {
        renderLanding(storySummaries);
        wireSearch();
      })
      .fail(function () {
        $("#storyGrid").html(loadErrorHtml());
      });
  }

  function renderLanding(stories) {
    var $grid = $("#storyGrid").empty();

    if (!stories.length) {
      $grid.append('<div class="ns-error"><h4>No stories on the shelf yet</h4><p>Add a story JSON file and list it in storybooks/stories/stories-index.js.</p></div>');
      return;
    }

    stories.forEach(function (story, idx) {
      var $book = $(
        '<div class="ns-col" data-title="' + escapeAttr((story.title + " " + (story.genre || "")).toLowerCase()) + '">' +
          '<a class="ns-book" href="' + resolvePath("story.html?story=" + encodeURIComponent(story.id)) + '" aria-label="Open ' + escapeAttr(story.title) + '">' +
            '<img src="' + escapeAttr(resolvePath(story.cover)) + '" alt="' + escapeAttr(story.title) + ' cover" draggable="false" onerror="this.src=\'' + resolvePath("assets/default-cover.jpg") + '\'">' +
            '<div class="corner-fold"></div>' +
          "</a>" +
          '<div class="ns-book-meta">' +
            '<div class="title">' + escapeHtml(story.title) + "</div>" +
            '<div class="genre">' + escapeHtml(story.genre || "") + "</div>" +
          "</div>" +
        "</div>"
      );
      $book.css("animation-delay", Math.min(idx * 55, 400) + "ms").addClass("ns-book-in");
      $grid.append($book);
    });
  }

  function wireSearch() {
    $("#searchInput").on("input", function () {
      var term = $(this).val().trim().toLowerCase();
      var visible = 0;
      $("#storyGrid .ns-col").each(function () {
        var match = !term || $(this).data("title").toString().indexOf(term) !== -1;
        $(this).toggle(match);
        if (match) visible++;
      });
      $("#noResults").toggle(visible === 0 && term.length > 0);
    });
  }

  /* ===========================================================
     PAGE: story.html — episode list + reader
     =========================================================== */

  var lastReaderKey = null; // "episodeIndex|pageIndex" of the previously rendered page, for flip direction

  function initStoryPage() {
    initTheme();
    initFontControls();
    initProgressBar();

    var storyId = qs("story");
    if (!storyId) {
      window.location.href = "my-books.html";
      return;
    }

    var loader = storyCache[storyId] ? $.Deferred().resolve(storyCache[storyId]).promise() : loadSingleStory(storyId);

    loader
      .then(function (story) {
        wireStoryPageEvents(story);
        route(story);
        $(window).on("popstate", function () { route(story); });
      })
      .fail(function () {
        $("#view-story").addClass("active");
        $("#episodeGrid").html(loadErrorHtml());
      });
  }

  function route(story) {
    var epParam = qs("ep");
    if (epParam !== null) {
      var idx = parseInt(epParam, 10);
      if (isNaN(idx) || idx < 0 || idx >= story.episodes.length) idx = 0;

      var pages = paginateText(story.episodes[idx].text);
      var pgParam = qs("pg");
      var pgIdx = pgParam !== null ? parseInt(pgParam, 10) : 0;
      if (isNaN(pgIdx) || pgIdx < 0 || pgIdx >= pages.length) pgIdx = 0;

      renderReaderView(story, idx, pgIdx, pages);
      showStoryView("reader");
    } else {
      lastReaderKey = null;
      renderStoryView(story);
      showStoryView("story");
    }
  }

  function showStoryView(name) {
    $("#view-story").toggleClass("active", name === "story");
    $("#view-reader").toggleClass("active", name === "reader");
    $("#fontControls").toggleClass("d-none", name !== "reader");
    $("#progressBar").toggleClass("d-none", name !== "reader");
    if (name !== "reader") $("#progressBarFill").css("width", "0%");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderStoryView(story) {
    $("#storyCover").attr("src", resolvePath(story.cover)).attr("alt", story.title + " cover")
      .on("error", function () { $(this).attr("src", resolvePath("assets/default-cover.jpg")); });
    $("#storyGenre").text(story.genre || "");
    $("#storyTitle").text(story.title);
    $("#storyAuthor").text(story.author ? "by " + story.author : "");
    $("#storyDesc").text(story.description || "");
    document.title = story.title + " — Nightshelf";

    var lastRead = getLastReadIndex(story.id);
    var $grid = $("#episodeGrid").empty();

    story.episodes.forEach(function (ep, idx) {
      var excerpt = (ep.text || "").split("\n").join(" ").slice(0, 90);
      var badge = idx === lastRead ? '<div class="read-badge">&#9679; Last read</div>' : "";
      var pageCount = paginateText(ep.text).length;
      var pagesTag = pageCount > 1 ? '<span class="pages-tag">' + pageCount + " pages</span>" : "";
      var $card = $(
        '<a class="ns-episode-card" href="' + resolvePath("story.html?story=" + encodeURIComponent(story.id) + '&ep=' + idx) + '" aria-label="Read ' + escapeAttr(ep.title) + '">' +
          '<div class="thumb">' +
            '<img src="' + escapeAttr(resolvePath(ep.cover)) + '" alt="' + escapeAttr(ep.title) + '" draggable="false" onerror="this.src=\'' + resolvePath("assets/default-cover.jpg") + '\'">' +
            '<div class="num">Ep. ' + (idx + 1) + "</div>" +
          "</div>" +
          '<div class="body">' +
            '<div class="title">' + escapeHtml(ep.title) + "</div>" +
            '<div class="excerpt">' + escapeHtml(excerpt) + "&hellip;</div>" +
            '<div class="read-badge-wrap">' + badge + pagesTag + "</div>" +
          "</div>" +
        "</a>"
      );
      $card.css("animation-delay", Math.min(idx * 55, 400) + "ms").addClass("ns-in");
      $grid.append($card);
    });
  }

  function renderReaderView(story, episodeIndex, pageIndex, pages) {
    var episodes = story.episodes;
    var ep = episodes[episodeIndex];
    if (!ep) return;

    pages = pages || paginateText(ep.text);
    if (pageIndex == null || isNaN(pageIndex) || pageIndex < 0) pageIndex = 0;
    if (pageIndex >= pages.length) pageIndex = pages.length - 1;

    var key = episodeIndex + "|" + pageIndex;
    var direction = null;
    if (lastReaderKey !== null && lastReaderKey !== key) {
      var prevParts = lastReaderKey.split("|").map(Number);
      direction = (episodeIndex > prevParts[0] || (episodeIndex === prevParts[0] && pageIndex > prevParts[1])) ? "next" : "prev";
    }
    lastReaderKey = key;

    var totalPages = pages.length;
    document.title = ep.title + (totalPages > 1 ? " (Page " + (pageIndex + 1) + ")" : "") + " — " + story.title;

    $("#readerStoryTitle").text(story.title);
    $("#readerCover").attr("src", resolvePath(ep.cover)).attr("alt", ep.title)
      .toggleClass("d-none", pageIndex > 0)
      .on("error", function () { $(this).attr("src", resolvePath("assets/default-cover.jpg")); });
    $("#readerKicker").text(
      "Episode " + (episodeIndex + 1) + " of " + episodes.length + " — " + readingTime(ep.text)
    );
    $("#readerTitle").text(ep.title);

    var $pageBadge = $("#readerPageBadge");
    if (totalPages > 1) {
      $pageBadge.text("Page " + (pageIndex + 1) + " of " + totalPages).removeClass("d-none");
    } else {
      $pageBadge.addClass("d-none");
    }

    var $text = $("#readerText").empty();
    pages[pageIndex].forEach(function (para) {
      $text.append($("<p>").text(para));
    });
    if (pageIndex < totalPages - 1) {
      $text.append('<div class="page-continues">Continued on next page &rsaquo;</div>');
    }

    var $dots = $("#progressDots").empty();
    episodes.forEach(function (_, idx) {
      var cls = "dot";
      if (idx === episodeIndex) cls += " current";
      else if (idx < episodeIndex) cls += " read";
      $dots.append('<span class="' + cls + '" title="Episode ' + (idx + 1) + '"></span>');
    });

    var $prev = $("#prevBtn");
    if (pageIndex > 0) {
      $prev.removeClass("invisible").prop("disabled", false)
        .find(".label").text("Previous page");
      $prev.data("target-ep", episodeIndex).data("target-pg", pageIndex - 1);
    } else if (episodeIndex > 0) {
      var prevPages = paginateText(episodes[episodeIndex - 1].text);
      $prev.removeClass("invisible").prop("disabled", false)
        .find(".label").text(episodes[episodeIndex - 1].title);
      $prev.data("target-ep", episodeIndex - 1).data("target-pg", prevPages.length - 1);
    } else {
      $prev.addClass("invisible");
    }

    var $next = $("#nextBtn");
    if (pageIndex < totalPages - 1) {
      $next.removeClass("invisible").prop("disabled", false)
        .find(".label").text("Next page");
      $next.data("target-ep", episodeIndex).data("target-pg", pageIndex + 1);
    } else if (episodeIndex < episodes.length - 1) {
      $next.removeClass("invisible").prop("disabled", false)
        .find(".label").text(episodes[episodeIndex + 1].title);
      $next.data("target-ep", episodeIndex + 1).data("target-pg", 0);
    } else {
      $next.addClass("invisible");
    }

    saveContinue(story, episodeIndex, pageIndex);
    window.scrollTo({ top: 0, behavior: "auto" });

    var $page = $(".ns-page");
    $page.removeClass("ns-flip-next ns-flip-prev");
    if (direction) {
      // restart the animation on the next frame
      requestAnimationFrame(function () {
        $page.addClass(direction === "next" ? "ns-flip-next" : "ns-flip-prev");
      });
    }
  }

  function getLastReadIndex(storyId) {
    var raw = localStorage.getItem(CONTINUE_KEY);
    if (!raw) return -1;
    try {
      var data = JSON.parse(raw);
      return data.storyId === storyId ? data.episodeIndex : -1;
    } catch (e) { return -1; }
  }

  function wireStoryPageEvents(story) {
    $("#backBtn").on("click", function () {
      if (qs("ep") !== null) {
        navigate(resolvePath("story.html?story=" + encodeURIComponent(story.id)));
      } else {
        window.location.href = APP_ROOT ? "my-books.html" : "../my-books.html";
      }
    });

    $("#tocBtn").on("click", function () {
      navigate(resolvePath("story.html?story=" + encodeURIComponent(story.id)));
    });

    $("#prevBtn").on("click", function () {
      if ($(this).hasClass("invisible")) return;
      navigate(buildEpUrl(story.id, $(this).data("target-ep"), $(this).data("target-pg")));
    });

    $("#nextBtn").on("click", function () {
      if ($(this).hasClass("invisible")) return;
      navigate(buildEpUrl(story.id, $(this).data("target-ep"), $(this).data("target-pg")));
    });

    function buildEpUrl(storyId, ep, pg) {
      var url = "story.html?story=" + encodeURIComponent(storyId) + "&ep=" + ep;
      if (pg) url += "&pg=" + pg;
      return resolvePath(url);
    }

    function navigate(url) {
      window.history.pushState({}, "", url);
      route(story);
    }
  }

  function loadErrorHtml() {
    return '<div class="ns-error"><h4>Couldn’t load the shelf</h4>' +
      "<p>A story data file failed to load. Check that <code>storyBooks/stories/stories-index.js</code> lists the " +
      "right file paths, and that each file it points to actually exists.</p></div>";
  }

  /* ---------------------------------------------------------
     Boot — detect which page we're on
     --------------------------------------------------------- */

  $(function () {
    initContentProtection();
    initInstallPrompt();
    if ($("#storyGrid").length) {
      initLandingPage();
    } else if ($("#view-story").length && $("#view-reader").length) {
      initStoryPage();
    }
  });

})(jQuery);
