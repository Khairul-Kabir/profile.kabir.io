/* ===========================================================
   Nightshelf — storyapp.js
   Shared logic for index.html (landing/shelf) and story.html
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
      $("#themeToggle").html("&#9789;").attr("title", "Switch to night mode");
    } else {
      document.documentElement.removeAttribute("data-theme");
      $("#themeToggle").html("&#9788;").attr("title", "Switch to day mode");
    }
  }

  /* ---------------------------------------------------------
     Data loading
     Story data ships as plain .js files (each one just assigns
     an object into window.NS_STORIES) rather than .json fetched
     over AJAX. Browsers block fetch()/XHR against local files
     opened with file://, but a normal <script src="..."> tag
     works everywhere, including a straight double-click on
     index.html with no local server needed.
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

  /* ---------------------------------------------------------
     Continue Reading (localStorage bookmark)
     --------------------------------------------------------- */

  function saveContinue(story, episodeIndex) {
    var ep = story.episodes[episodeIndex];
    localStorage.setItem(CONTINUE_KEY, JSON.stringify({
      storyId: story.id,
      storyTitle: story.title,
      storyCover: story.cover,
      episodeIndex: episodeIndex,
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
      "Episode " + (data.episodeIndex + 1) + " of " + data.totalEpisodes + " \u2014 " + data.episodeTitle
    );
    $card.css("display", "flex");
    $card.off("click").on("click", function () {
      window.location.href = resolvePath("story.html?story=" + encodeURIComponent(data.storyId) + "&ep=" + data.episodeIndex);
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
     PAGE: index.html — the shelf
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
      $grid.append('<div class="ns-error"><h4>No stories on the shelf yet</h4><p>Add a story JSON file and list it in storybooks/stories/stories.json.</p></div>');
      return;
    }

    stories.forEach(function (story) {
      var $book = $(
        '<div class="ns-col" data-title="' + escapeAttr((story.title + " " + (story.genre || "")).toLowerCase()) + '">' +
          '<a class="ns-book" href="' + resolvePath("story.html?story=" + encodeURIComponent(story.id)) + '" aria-label="Open ' + escapeAttr(story.title) + '">' +
            '<img src="' + escapeAttr(resolvePath(story.cover)) + '" alt="' + escapeAttr(story.title) + ' cover" onerror="this.src=\'' + resolvePath("assets/default-cover.jpg") + '\'">' +
            '<div class="corner-fold"></div>' +
          "</a>" +
          '<div class="ns-book-meta">' +
            '<div class="title">' + escapeHtml(story.title) + "</div>" +
            '<div class="genre">' + escapeHtml(story.genre || "") + "</div>" +
          "</div>" +
        "</div>"
      );
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

  function initStoryPage() {
    initTheme();
    initFontControls();
    initProgressBar();

    var storyId = qs("story");
    if (!storyId) {
      window.location.href = "index.html";
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
      renderReaderView(story, idx);
      showStoryView("reader");
    } else {
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
      var $card = $(
        '<a class="ns-episode-card" href="' + resolvePath("story.html?story=" + encodeURIComponent(story.id) + '&ep=' + idx) + '" aria-label="Read ' + escapeAttr(ep.title) + '">' +
          '<div class="thumb">' +
            '<img src="' + escapeAttr(resolvePath(ep.cover)) + '" alt="' + escapeAttr(ep.title) + '" onerror="this.src=\'' + resolvePath("assets/default-cover.jpg") + '\'">' +
            '<div class="num">Ep. ' + (idx + 1) + "</div>" +
          "</div>" +
          '<div class="body">' +
            '<div class="title">' + escapeHtml(ep.title) + "</div>" +
            '<div class="excerpt">' + escapeHtml(excerpt) + "&hellip;</div>" +
            '<div class="read-badge-wrap">' + badge + "</div>" +
          "</div>" +
        "</a>"
      );
      $grid.append($card);
    });
  }

  function renderReaderView(story, episodeIndex) {
    var episodes = story.episodes;
    var ep = episodes[episodeIndex];
    if (!ep) return;

    document.title = ep.title + " — " + story.title;
    $("#readerStoryTitle").text(story.title);
    $("#readerCover").attr("src", resolvePath(ep.cover)).attr("alt", ep.title)
      .on("error", function () { $(this).attr("src", resolvePath("assets/default-cover.jpg")); });
    $("#readerKicker").text(
      "Episode " + (episodeIndex + 1) + " of " + episodes.length + " \u2014 " + readingTime(ep.text)
    );
    $("#readerTitle").text(ep.title);

    var $text = $("#readerText").empty();
    (ep.text || "").split(/\n\s*\n/).forEach(function (para) {
      if (para.trim()) $text.append($("<p>").text(para.trim()));
    });

    var $dots = $("#progressDots").empty();
    episodes.forEach(function (_, idx) {
      var cls = "dot";
      if (idx === episodeIndex) cls += " current";
      else if (idx < episodeIndex) cls += " read";
      $dots.append('<span class="' + cls + '" title="Episode ' + (idx + 1) + '"></span>');
    });

    var $prev = $("#prevBtn");
    if (episodeIndex > 0) {
      $prev.removeClass("invisible").prop("disabled", false)
        .find(".label").text(episodes[episodeIndex - 1].title);
      $prev.data("target", episodeIndex - 1);
    } else {
      $prev.addClass("invisible");
    }

    var $next = $("#nextBtn");
    if (episodeIndex < episodes.length - 1) {
      $next.removeClass("invisible").prop("disabled", false)
        .find(".label").text(episodes[episodeIndex + 1].title);
      $next.data("target", episodeIndex + 1);
    } else {
      $next.addClass("invisible");
    }

    saveContinue(story, episodeIndex);
    window.scrollTo({ top: 0, behavior: "auto" });
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
      navigate(resolvePath("story.html?story=" + encodeURIComponent(story.id) + "&ep=" + $(this).data("target")));
    });

    $("#nextBtn").on("click", function () {
      if ($(this).hasClass("invisible")) return;
      navigate(resolvePath("story.html?story=" + encodeURIComponent(story.id) + "&ep=" + $(this).data("target")));
    });

    function navigate(url) {
      window.history.pushState({}, "", url);
      route(story);
    }
  }

  function loadErrorHtml() {
    return '<div class="ns-error"><h4>Couldn\u2019t load the shelf</h4>' +
      "<p>A story data file failed to load. Check that <code>storyBooks/stories/stories-index.js</code> lists the " +
      "right file paths, and that each file it points to actually exists.</p></div>";
  }

  /* ---------------------------------------------------------
     Boot — detect which page we're on
     --------------------------------------------------------- */

  $(function () {
    if ($("#storyGrid").length) {
      initLandingPage();
    } else if ($("#view-story").length && $("#view-reader").length) {
      initStoryPage();
    }
  });

})(jQuery);
