/* =====================================================================
   Islamic Hub — app.js
   Global Prayer Times, Azan Player, Quran Player, Notifications
   ===================================================================== */
(function () {
  'use strict';

  /* ── Constants ────────────────────────────────────────────────────── */
  const DEFAULT_LAT  = 23.8103;
  const DEFAULT_LON  = 90.4125;
  const DEFAULT_CITY = 'Dhaka, Bangladesh';
  const RING_R       = 54;
  const RING_CIRC    = 2 * Math.PI * RING_R;   // ≈ 339.29

  const AZAN_SOURCES = {
    makkah  : 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',   // fallback tone if real url fails
    madinah : 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/2.mp3',
    aqsa    : 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/114.mp3',
  };

  // Real Azan MP3 URLs (archive.org — free, no CORS issues for most browsers)
  const AZAN_REAL = {
    makkah  : 'https://ia600305.us.archive.org/35/items/AzanMakkah/Azan-Makkah.mp3',
    madinah : 'https://ia800305.us.archive.org/10/items/AzanMadinah2/Azan-Madinah.mp3',
    aqsa    : 'https://ia800700.us.archive.org/2/items/AzanAqsa/Azan-Aqsa.mp3',
  };

  const QURAN_BASE = 'https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/';

  const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const PRAYER_ICONS = {
    Fajr   : 'bi-brightness-alt-high',
    Sunrise: 'bi-sunrise',
    Dhuhr  : 'bi-sun',
    Asr    : 'bi-cloud-sun',
    Maghrib: 'bi-sunset',
    Isha   : 'bi-moon-stars',
  };

  /* ── State ────────────────────────────────────────────────────────── */
  let state = {
    lat     : DEFAULT_LAT,
    lon     : DEFAULT_LON,
    city    : DEFAULT_CITY,
    method  : 1,
    madhab  : 0,
    timeFmt : 12,
    times   : null,    // { Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha } as Date objects
    rawTimes: null,    // API string values
    map     : null,
    marker  : null,
    notifEnabled: false,
    notifToggles: { Fajr:true, Sunrise:false, Dhuhr:true, Asr:true, Maghrib:true, Isha:true, Sehri:true, Iftar:true },
    notifTimers : [],
    currentSurah: null,
    surahsData  : [],
  };

  /* ── Helpers ──────────────────────────────────────────────────────── */
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('islamicHubSettings') || '{}');
      if (s.method)   state.method  = s.method;
      if (s.madhab !== undefined) state.madhab  = s.madhab;
      if (s.timeFmt)  state.timeFmt = s.timeFmt;
      if (s.lat)      state.lat     = s.lat;
      if (s.lon)      state.lon     = s.lon;
      if (s.city)     state.city    = s.city;
      if (s.notifToggles) state.notifToggles = { ...state.notifToggles, ...s.notifToggles };
    } catch(e) {}
  }

  function saveSettings() {
    localStorage.setItem('islamicHubSettings', JSON.stringify({
      method  : state.method,
      madhab  : state.madhab,
      timeFmt : state.timeFmt,
      lat     : state.lat,
      lon     : state.lon,
      city    : state.city,
      notifToggles: state.notifToggles,
    }));
  }

  function fmt(d, hr24) {
    if (!(d instanceof Date) || isNaN(d)) return '—';
    if (hr24 || state.timeFmt === 24) {
      return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', hour12: false });
    }
    return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12: true });
  }

  function pad(n) { return String(n).padStart(2,'0'); }

  function parseAPITime(str) {
    // str like "05:23 (BST)" or "05:23"
    const m = str.match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const now = new Date();
    const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], 0);
    return d;
  }

  /* ── Clock ────────────────────────────────────────────────────────── */
  const clockEl   = document.getElementById('clockDisplay');
  const dateEl    = document.getElementById('dateDisplay');
  const hijriEl   = document.getElementById('hijriDisplay');

  function tickClock() {
    const now = new Date();
    const hh  = pad(now.getHours());
    const mm  = pad(now.getMinutes());
    const ss  = pad(now.getSeconds());
    if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`;
    if (dateEl)  dateEl.textContent  = now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    updateCountdown(now);
  }

  function updateHijriDate() {
    try {
      const today = new Date();
      const hijri = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
        day:'numeric', month:'long', year:'numeric'
      }).format(today);
      if (hijriEl) hijriEl.textContent = hijri;
    } catch(e) {
      // Fallback: use aladhan hijri from prayer fetch
      if (hijriEl) hijriEl.textContent = '';
    }
  }

  /* ── Countdown Ring ───────────────────────────────────────────────── */
  const ringArc       = document.getElementById('ringArc');
  const nextNameEl    = document.getElementById('nextPrayerName');
  const nextAtEl      = document.getElementById('nextPrayerAt');
  const countdownEl   = document.getElementById('countdownDisplay');

  function updateCountdown(now) {
    if (!state.times) return;
    const prayerOrder = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];
    let nextPrayer = null;
    let nextTime   = null;
    let prevTime   = null;

    for (let i = 0; i < prayerOrder.length; i++) {
      const t = state.times[prayerOrder[i]];
      if (t && t > now) {
        nextPrayer = prayerOrder[i];
        nextTime   = t;
        prevTime   = i > 0 ? state.times[prayerOrder[i-1]] : null;
        break;
      }
    }
    // If no next prayer today → next is Fajr tomorrow
    if (!nextPrayer) {
      nextPrayer = 'Fajr';
      const fajr = state.times['Fajr'];
      if (fajr) {
        nextTime = new Date(fajr.getTime() + 86400000);
        prevTime = state.times['Isha'];
      }
    }

    if (!nextTime) return;

    const diff     = nextTime - now;
    const totalSec = prevTime ? Math.round((nextTime - prevTime) / 1000) : 0;
    const remSec   = Math.round(diff / 1000);
    const progress = totalSec > 0 ? Math.max(0, Math.min(1, remSec / totalSec)) : 0;

    const hh = pad(Math.floor(diff / 3600000));
    const mm = pad(Math.floor((diff % 3600000) / 60000));
    const ss = pad(Math.floor((diff % 60000)  / 1000));

    if (nextNameEl)  nextNameEl.textContent  = nextPrayer;
    if (nextAtEl)    nextAtEl.textContent     = fmt(nextTime);
    if (countdownEl) countdownEl.textContent  = `${hh}:${mm}:${ss}`;

    if (ringArc) {
      const offset = RING_CIRC * (1 - progress);
      ringArc.style.strokeDashoffset = offset;
    }
  }

  /* ── Prayer Times Fetch ───────────────────────────────────────────── */
  async function fetchPrayerTimes() {
    const today = new Date();
    const dateStr = `${pad(today.getDate())}-${pad(today.getMonth()+1)}-${today.getFullYear()}`;
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${state.lat}&longitude=${state.lon}&method=${state.method}&school=${state.madhab}`;

    try {
      const res  = await fetch(url);
      const json = await res.json();
      if (json.code !== 200) throw new Error('API error');
      const t = json.data.timings;
      state.rawTimes = t;

      state.times = {};
      for (const p of PRAYER_NAMES) {
        state.times[p] = parseAPITime(t[p]);
      }

      // Hijri date from API
      if (hijriEl && json.data.date && json.data.date.hijri) {
        const h = json.data.date.hijri;
        hijriEl.textContent = `${h.day} ${h.month.en} ${h.year} AH`;
      }

      renderPrayerGrid();
      renderExtraInfo(t);
      scheduleNotifications();
      fetchTemperature();
    } catch(err) {
      const grid = document.getElementById('prayerGrid');
      if (grid) grid.innerHTML = '<p class="text-center" style="color:var(--gold);padding:2rem">Failed to load prayer times. Please check your connection.</p>';
    }
  }

  /* ── Prayer Grid Render ───────────────────────────────────────────── */
  function renderPrayerGrid() {
    const grid = document.getElementById('prayerGrid');
    if (!grid || !state.times) return;

    const now   = new Date();
    const order = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'];

    // Find next prayer
    let nextIdx = -1;
    for (let i = 0; i < order.length; i++) {
      if (state.times[order[i]] > now) { nextIdx = i; break; }
    }

    let html = '';
    for (let i = 0; i < order.length; i++) {
      const name = order[i];
      const t    = state.times[name];
      let cls = 'prayer-card';
      if (t && t < now) cls += ' past';
      if (i === nextIdx) cls += ' next';
      const activeIdx = nextIdx > 0 ? nextIdx - 1 : (nextIdx === -1 ? order.length - 1 : -1);
      if (i === activeIdx && nextIdx !== -1) cls += ' active';

      const icon = PRAYER_ICONS[name] || 'bi-clock';
      let statusLabel = '';
      if (i === activeIdx && nextIdx !== -1) statusLabel = '<span class="prayer-status status-active">Now</span>';
      else if (i === nextIdx) statusLabel = '<span class="prayer-status status-next">Next</span>';
      else if (t && t < now) statusLabel = '<span class="prayer-status status-past">Done</span>';
      html += `
        <div class="${cls}">
          <i class="bi ${icon} prayer-icon"></i>
          <span class="prayer-name">${name}</span>
          <span class="prayer-time">${fmt(t)}</span>
          ${statusLabel}
        </div>`;
    }
    grid.innerHTML = html;

    const extra = document.getElementById('extraInfoRow');
    if (extra) extra.classList.remove('hidden');
  }

  function renderExtraInfo(t) {
    const sehriEl  = document.getElementById('sehriTime');
    const iftarEl  = document.getElementById('iftarTime');
    const jummahEl = document.getElementById('jummahTime');

    if (sehriEl  && t.Fajr)    sehriEl.textContent  = fmt(parseAPITime(t.Fajr));
    if (iftarEl  && t.Maghrib) iftarEl.textContent  = fmt(parseAPITime(t.Maghrib));
    if (jummahEl) {
      const today = new Date();
      if (today.getDay() === 5) { // Friday
        const dhuhrTime = parseAPITime(t.Dhuhr);
        // Jummah is typically 30 min after Dhuhr start — just show Dhuhr time
        jummahEl.textContent = fmt(dhuhrTime) + ' (Dhuhr)';
        document.getElementById('jummahInfo')?.classList.remove('hidden');
      } else {
        const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
        jummahEl.textContent = `In ${daysUntilFriday} day${daysUntilFriday>1?'s':''}`;
      }
    }
  }

  /* ── Temperature ──────────────────────────────────────────────────── */
  async function fetchTemperature() {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&current_weather=true`;
      const res  = await fetch(url);
      const json = await res.json();
      const temp = json.current_weather?.temperature;
      const el   = document.getElementById('tempDisplay');
      if (el && temp !== undefined) el.textContent = `${Math.round(temp)}°C`;
    } catch(e) {}
  }

  /* ── Location ─────────────────────────────────────────────────────── */
  function setLocation(lat, lon, city) {
    state.lat  = lat;
    state.lon  = lon;
    state.city = city;
    saveSettings();
    const locLabel = document.getElementById('locationLabel');
    if (locLabel) locLabel.textContent = city;
    fetchPrayerTimes();
    updateMap(lat, lon);
  }

  function detectGPS() {
    if (!navigator.geolocation) {
      setLocation(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const city = await reverseGeocode(lat, lon);
        setLocation(lat, lon, city);
      },
      () => setLocation(DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY),
      { timeout: 8000 }
    );
  }

  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const json = await res.json();
      const a    = json.address || {};
      return [a.city || a.town || a.village || a.county || 'Unknown', a.country].filter(Boolean).join(', ');
    } catch(e) {
      return 'Unknown Location';
    }
  }

  async function searchCity(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    return await res.json();
  }

  /* ── Map ──────────────────────────────────────────────────────────── */
  function initMap() {
    if (state.map) return;
    state.map = L.map('leafletMap').setView([state.lat, state.lon], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(state.map);
    state.marker = L.marker([state.lat, state.lon]).addTo(state.map)
      .bindPopup(state.city).openPopup();
  }

  function updateMap(lat, lon) {
    if (!state.map) { initMap(); return; }
    state.map.setView([lat, lon], 12);
    if (state.marker) {
      state.marker.setLatLng([lat, lon]).setPopupContent(state.city).openPopup();
    }
  }

  /* ── Azan Player ──────────────────────────────────────────────────── */
  const azanAudio  = document.getElementById('azanAudio');
  const playBtn    = document.getElementById('playAzanBtn');
  const stopBtn    = document.getElementById('stopAzanBtn');
  const volSlider  = document.getElementById('azanVolume');
  const statusMsg  = document.getElementById('azanStatusMsg');
  const typeSelect = document.getElementById('azanTypeSelect');

  function playAzan(type) {
    if (!azanAudio) return;
    type = type || (typeSelect ? typeSelect.value : 'makkah');
    const src = AZAN_REAL[type] || AZAN_REAL.makkah;
    azanAudio.src = src;
    azanAudio.volume = volSlider ? +volSlider.value : 0.9;
    azanAudio.play().catch(() => {
      if (statusMsg) statusMsg.textContent = 'Playback blocked. Click Play Azan to listen.';
    });
  }

  function stopAzan() {
    if (azanAudio) { azanAudio.pause(); azanAudio.currentTime = 0; }
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      playAzan();
      playBtn.classList.add('hidden');
      stopBtn?.classList.remove('hidden');
      if (statusMsg) statusMsg.textContent = 'Playing Azan…';
    });
  }
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopAzan();
      stopBtn.classList.add('hidden');
      playBtn?.classList.remove('hidden');
      if (statusMsg) statusMsg.textContent = '';
    });
  }
  if (azanAudio) {
    azanAudio.addEventListener('ended', () => {
      stopBtn?.classList.add('hidden');
      playBtn?.classList.remove('hidden');
      if (statusMsg) statusMsg.textContent = '';
    });
  }
  if (volSlider && azanAudio) {
    volSlider.addEventListener('input', () => { azanAudio.volume = +volSlider.value; });
  }

  /* ── Notifications ────────────────────────────────────────────────── */
  const notifBanner   = document.getElementById('notifPermBanner');
  const notifControls = document.getElementById('notifControls');
  const requestBtn    = document.getElementById('requestNotifBtn');
  const notifToggleBtn = document.getElementById('notifToggleBtn');

  function checkNotifPermission() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      state.notifEnabled = true;
      showNotifControls();
    }
  }

  function showNotifControls() {
    if (notifBanner)   notifBanner.classList.add('hidden');
    if (notifControls) notifControls.classList.remove('hidden');
    renderNotifToggles();
  }

  function renderNotifToggles() {
    const container = document.getElementById('notifToggles');
    if (!container) return;
    const items = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha','Sehri','Iftar'];
    container.innerHTML = items.map(name => `
      <label class="notif-toggle-row">
        <span>${name}</span>
        <div class="toggle-wrap">
          <input type="checkbox" class="toggle-input notif-chk" data-prayer="${name}" ${state.notifToggles[name] ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </div>
      </label>`).join('');
    container.querySelectorAll('.notif-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        state.notifToggles[chk.dataset.prayer] = chk.checked;
        saveSettings();
        scheduleNotifications();
      });
    });
  }

  function scheduleNotifications() {
    if (!state.notifEnabled || !state.times) return;
    state.notifTimers.forEach(clearTimeout);
    state.notifTimers = [];
    const now = new Date();
    const prayerPlayAzan = document.getElementById('notifPlayAzan');

    function schedule(name, time, message) {
      if (!state.notifToggles[name]) return;
      const diff = time - now;
      if (diff < 0 || diff > 86400000) return;
      const tid = setTimeout(() => {
        new Notification(`🕌 ${name}`, { body: message, icon: 'assets/img/favicon.png' });
        if (prayerPlayAzan?.checked && name !== 'Sehri' && name !== 'Iftar') {
          playAzan(typeSelect?.value || 'makkah');
        }
      }, diff);
      state.notifTimers.push(tid);
    }

    const t = state.times;
    if (t.Fajr)    schedule('Fajr',    t.Fajr,    `Fajr prayer time — ${fmt(t.Fajr)}`);
    if (t.Sunrise) schedule('Sunrise', t.Sunrise, `Sunrise — ${fmt(t.Sunrise)}`);
    if (t.Dhuhr)   schedule('Dhuhr',   t.Dhuhr,   `Dhuhr prayer time — ${fmt(t.Dhuhr)}`);
    if (t.Asr)     schedule('Asr',     t.Asr,     `Asr prayer time — ${fmt(t.Asr)}`);
    if (t.Maghrib) schedule('Maghrib', t.Maghrib, `Maghrib prayer time — Iftar! — ${fmt(t.Maghrib)}`);
    if (t.Isha)    schedule('Isha',    t.Isha,    `Isha prayer time — ${fmt(t.Isha)}`);

    // Sehri ends 5 min before Fajr
    if (t.Fajr) {
      const sehriWarn = new Date(t.Fajr.getTime() - 5 * 60000);
      schedule('Sehri', sehriWarn, `⚠️ Sehri ends in 5 minutes! (${fmt(t.Fajr)})`);
    }
    // Iftar = Maghrib
    if (t.Maghrib) schedule('Iftar', t.Maghrib, `🌙 Iftar time! — ${fmt(t.Maghrib)}`);
  }

  if (requestBtn) {
    requestBtn.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        state.notifEnabled = true;
        showNotifControls();
        scheduleNotifications();
      }
    });
  }

  if (notifToggleBtn) {
    notifToggleBtn.addEventListener('click', () => {
      const drawer = document.getElementById('settingsDrawer');
      drawer?.classList.toggle('open');
      document.getElementById('drawerOverlay')?.classList.toggle('hidden');
    });
  }

  /* ── Settings Drawer ──────────────────────────────────────────────── */
  const settingsBtn   = document.getElementById('settingsBtn');
  const settingsDrawer = document.getElementById('settingsDrawer');
  const closeSettings = document.getElementById('closeSettings');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const applySettings = document.getElementById('applySettings');
  const methodSelect  = document.getElementById('methodSelect');
  const madhabSelect  = document.getElementById('madhabSelect');
  const timeFmtSelect = document.getElementById('timeFormatSelect');

  function openDrawer() {
    settingsDrawer?.classList.add('open');
    drawerOverlay?.classList.remove('hidden');
  }
  function closeDrawer() {
    settingsDrawer?.classList.remove('open');
    drawerOverlay?.classList.add('hidden');
  }

  if (settingsBtn)  settingsBtn.addEventListener('click', openDrawer);
  if (closeSettings) closeSettings.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  // Sync selects to current state
  function syncSettingSelects() {
    if (methodSelect) methodSelect.value = state.method;
    if (madhabSelect) madhabSelect.value = state.madhab;
    if (timeFmtSelect) timeFmtSelect.value = state.timeFmt;
  }

  if (applySettings) {
    applySettings.addEventListener('click', () => {
      if (methodSelect)  state.method  = +methodSelect.value;
      if (madhabSelect)  state.madhab  = +madhabSelect.value;
      if (timeFmtSelect) state.timeFmt = +timeFmtSelect.value;
      saveSettings();
      closeDrawer();
      fetchPrayerTimes();
    });
  }

  /* ── Location Modal ───────────────────────────────────────────────── */
  const locationModal    = document.getElementById('locationModal');
  const changeLocBtn     = document.getElementById('changeLocBtn');
  const closeLocModal    = document.getElementById('closeLocationModal');
  const cityInput        = document.getElementById('cityInput');
  const citySearchBtn    = document.getElementById('citySearchBtn');
  const cityResults      = document.getElementById('cityResults');
  const useGpsBtn        = document.getElementById('useGpsBtn');

  function openLocModal() {
    locationModal?.classList.remove('hidden');
    drawerOverlay?.classList.remove('hidden');
    cityInput?.focus();
  }
  function closeLocModal2() {
    locationModal?.classList.add('hidden');
    drawerOverlay?.classList.add('hidden');
    if (cityResults) cityResults.innerHTML = '';
    if (cityInput)   cityInput.value = '';
  }

  if (changeLocBtn) changeLocBtn.addEventListener('click', openLocModal);
  if (closeLocModal) closeLocModal.addEventListener('click', closeLocModal2);

  async function doSearch() {
    const q = cityInput?.value.trim();
    if (!q || !cityResults) return;
    cityResults.innerHTML = '<div style="padding:8px;opacity:.6">Searching…</div>';
    try {
      const results = await searchCity(q);
      if (!results.length) { cityResults.innerHTML = '<div style="padding:8px;opacity:.6">No results found.</div>'; return; }
      cityResults.innerHTML = results.map((r, i) => {
        const label = r.display_name.split(',').slice(0,3).join(', ');
        return `<div class="city-result-item" data-i="${i}">${label}</div>`;
      }).join('');
      cityResults.querySelectorAll('.city-result-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          const r = results[i];
          const label = r.display_name.split(',').slice(0,3).join(', ');
          setLocation(+r.lat, +r.lon, label);
          closeLocModal2();
        });
      });
    } catch(e) {
      cityResults.innerHTML = '<div style="padding:8px;color:#f66">Search failed. Try again.</div>';
    }
  }

  if (citySearchBtn) citySearchBtn.addEventListener('click', doSearch);
  if (cityInput) {
    cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  }
  if (useGpsBtn) {
    useGpsBtn.addEventListener('click', () => {
      closeLocModal2();
      detectGPS();
    });
  }

  /* ── Map Collapsible ──────────────────────────────────────────────── */
  const mapBar     = document.getElementById('mapBar');
  const mapBody    = document.getElementById('mapBody');
  const mapChevron = document.getElementById('mapChevron');
  let mapExpanded  = true;

  if (mapBar) {
    mapBar.addEventListener('click', () => {
      mapExpanded = !mapExpanded;
      if (mapBody) mapBody.classList.toggle('collapsed', !mapExpanded);
      if (mapChevron) {
        mapChevron.className = mapExpanded ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
      }
      // Initialize map when first expanded
      if (mapExpanded && !state.map) {
        setTimeout(() => { initMap(); }, 100);
      } else if (mapExpanded && state.map) {
        setTimeout(() => state.map.invalidateSize(), 150);
      }
    });
  }

  /* ── Quran Data ───────────────────────────────────────────────────── */
  const SURAHS = [
    {n:1,en:"Al-Fatiha",ar:"الفاتحة",type:"Meccan",ayahs:7},
    {n:2,en:"Al-Baqarah",ar:"البقرة",type:"Medinan",ayahs:286},
    {n:3,en:"Ali 'Imran",ar:"آل عمران",type:"Medinan",ayahs:200},
    {n:4,en:"An-Nisa",ar:"النساء",type:"Medinan",ayahs:176},
    {n:5,en:"Al-Ma'idah",ar:"المائدة",type:"Medinan",ayahs:120},
    {n:6,en:"Al-An'am",ar:"الأنعام",type:"Meccan",ayahs:165},
    {n:7,en:"Al-A'raf",ar:"الأعراف",type:"Meccan",ayahs:206},
    {n:8,en:"Al-Anfal",ar:"الأنفال",type:"Medinan",ayahs:75},
    {n:9,en:"At-Tawbah",ar:"التوبة",type:"Medinan",ayahs:129},
    {n:10,en:"Yunus",ar:"يونس",type:"Meccan",ayahs:109},
    {n:11,en:"Hud",ar:"هود",type:"Meccan",ayahs:123},
    {n:12,en:"Yusuf",ar:"يوسف",type:"Meccan",ayahs:111},
    {n:13,en:"Ar-Ra'd",ar:"الرعد",type:"Medinan",ayahs:43},
    {n:14,en:"Ibrahim",ar:"إبراهيم",type:"Meccan",ayahs:52},
    {n:15,en:"Al-Hijr",ar:"الحجر",type:"Meccan",ayahs:99},
    {n:16,en:"An-Nahl",ar:"النحل",type:"Meccan",ayahs:128},
    {n:17,en:"Al-Isra",ar:"الإسراء",type:"Meccan",ayahs:111},
    {n:18,en:"Al-Kahf",ar:"الكهف",type:"Meccan",ayahs:110},
    {n:19,en:"Maryam",ar:"مريم",type:"Meccan",ayahs:98},
    {n:20,en:"Ta-Ha",ar:"طه",type:"Meccan",ayahs:135},
    {n:21,en:"Al-Anbiya",ar:"الأنبياء",type:"Meccan",ayahs:112},
    {n:22,en:"Al-Hajj",ar:"الحج",type:"Medinan",ayahs:78},
    {n:23,en:"Al-Mu'minun",ar:"المؤمنون",type:"Meccan",ayahs:118},
    {n:24,en:"An-Nur",ar:"النور",type:"Medinan",ayahs:64},
    {n:25,en:"Al-Furqan",ar:"الفرقان",type:"Meccan",ayahs:77},
    {n:26,en:"Ash-Shu'ara",ar:"الشعراء",type:"Meccan",ayahs:227},
    {n:27,en:"An-Naml",ar:"النمل",type:"Meccan",ayahs:93},
    {n:28,en:"Al-Qasas",ar:"القصص",type:"Meccan",ayahs:88},
    {n:29,en:"Al-'Ankabut",ar:"العنكبوت",type:"Meccan",ayahs:69},
    {n:30,en:"Ar-Rum",ar:"الروم",type:"Meccan",ayahs:60},
    {n:31,en:"Luqman",ar:"لقمان",type:"Meccan",ayahs:34},
    {n:32,en:"As-Sajdah",ar:"السجدة",type:"Meccan",ayahs:30},
    {n:33,en:"Al-Ahzab",ar:"الأحزاب",type:"Medinan",ayahs:73},
    {n:34,en:"Saba",ar:"سبأ",type:"Meccan",ayahs:54},
    {n:35,en:"Fatir",ar:"فاطر",type:"Meccan",ayahs:45},
    {n:36,en:"Ya-Sin",ar:"يس",type:"Meccan",ayahs:83},
    {n:37,en:"As-Saffat",ar:"الصافات",type:"Meccan",ayahs:182},
    {n:38,en:"Sad",ar:"ص",type:"Meccan",ayahs:88},
    {n:39,en:"Az-Zumar",ar:"الزمر",type:"Meccan",ayahs:75},
    {n:40,en:"Ghafir",ar:"غافر",type:"Meccan",ayahs:85},
    {n:41,en:"Fussilat",ar:"فصلت",type:"Meccan",ayahs:54},
    {n:42,en:"Ash-Shura",ar:"الشورى",type:"Meccan",ayahs:53},
    {n:43,en:"Az-Zukhruf",ar:"الزخرف",type:"Meccan",ayahs:89},
    {n:44,en:"Ad-Dukhan",ar:"الدخان",type:"Meccan",ayahs:59},
    {n:45,en:"Al-Jathiyah",ar:"الجاثية",type:"Meccan",ayahs:37},
    {n:46,en:"Al-Ahqaf",ar:"الأحقاف",type:"Meccan",ayahs:35},
    {n:47,en:"Muhammad",ar:"محمد",type:"Medinan",ayahs:38},
    {n:48,en:"Al-Fath",ar:"الفتح",type:"Medinan",ayahs:29},
    {n:49,en:"Al-Hujurat",ar:"الحجرات",type:"Medinan",ayahs:18},
    {n:50,en:"Qaf",ar:"ق",type:"Meccan",ayahs:45},
    {n:51,en:"Adh-Dhariyat",ar:"الذاريات",type:"Meccan",ayahs:60},
    {n:52,en:"At-Tur",ar:"الطور",type:"Meccan",ayahs:49},
    {n:53,en:"An-Najm",ar:"النجم",type:"Meccan",ayahs:62},
    {n:54,en:"Al-Qamar",ar:"القمر",type:"Meccan",ayahs:55},
    {n:55,en:"Ar-Rahman",ar:"الرحمن",type:"Medinan",ayahs:78},
    {n:56,en:"Al-Waqi'ah",ar:"الواقعة",type:"Meccan",ayahs:96},
    {n:57,en:"Al-Hadid",ar:"الحديد",type:"Medinan",ayahs:29},
    {n:58,en:"Al-Mujadila",ar:"المجادلة",type:"Medinan",ayahs:22},
    {n:59,en:"Al-Hashr",ar:"الحشر",type:"Medinan",ayahs:24},
    {n:60,en:"Al-Mumtahanah",ar:"الممتحنة",type:"Medinan",ayahs:13},
    {n:61,en:"As-Saf",ar:"الصف",type:"Medinan",ayahs:14},
    {n:62,en:"Al-Jumu'ah",ar:"الجمعة",type:"Medinan",ayahs:11},
    {n:63,en:"Al-Munafiqun",ar:"المنافقون",type:"Medinan",ayahs:11},
    {n:64,en:"At-Taghabun",ar:"التغابن",type:"Medinan",ayahs:18},
    {n:65,en:"At-Talaq",ar:"الطلاق",type:"Medinan",ayahs:12},
    {n:66,en:"At-Tahrim",ar:"التحريم",type:"Medinan",ayahs:12},
    {n:67,en:"Al-Mulk",ar:"الملك",type:"Meccan",ayahs:30},
    {n:68,en:"Al-Qalam",ar:"القلم",type:"Meccan",ayahs:52},
    {n:69,en:"Al-Haqqah",ar:"الحاقة",type:"Meccan",ayahs:52},
    {n:70,en:"Al-Ma'arij",ar:"المعارج",type:"Meccan",ayahs:44},
    {n:71,en:"Nuh",ar:"نوح",type:"Meccan",ayahs:28},
    {n:72,en:"Al-Jinn",ar:"الجن",type:"Meccan",ayahs:28},
    {n:73,en:"Al-Muzzammil",ar:"المزمل",type:"Meccan",ayahs:20},
    {n:74,en:"Al-Muddaththir",ar:"المدثر",type:"Meccan",ayahs:56},
    {n:75,en:"Al-Qiyamah",ar:"القيامة",type:"Meccan",ayahs:40},
    {n:76,en:"Al-Insan",ar:"الإنسان",type:"Medinan",ayahs:31},
    {n:77,en:"Al-Mursalat",ar:"المرسلات",type:"Meccan",ayahs:50},
    {n:78,en:"An-Naba",ar:"النبأ",type:"Meccan",ayahs:40},
    {n:79,en:"An-Nazi'at",ar:"النازعات",type:"Meccan",ayahs:46},
    {n:80,en:"Abasa",ar:"عبس",type:"Meccan",ayahs:42},
    {n:81,en:"At-Takwir",ar:"التكوير",type:"Meccan",ayahs:29},
    {n:82,en:"Al-Infitar",ar:"الإنفطار",type:"Meccan",ayahs:19},
    {n:83,en:"Al-Mutaffifin",ar:"المطففين",type:"Meccan",ayahs:36},
    {n:84,en:"Al-Inshiqaq",ar:"الإنشقاق",type:"Meccan",ayahs:25},
    {n:85,en:"Al-Buruj",ar:"البروج",type:"Meccan",ayahs:22},
    {n:86,en:"At-Tariq",ar:"الطارق",type:"Meccan",ayahs:17},
    {n:87,en:"Al-A'la",ar:"الأعلى",type:"Meccan",ayahs:19},
    {n:88,en:"Al-Ghashiyah",ar:"الغاشية",type:"Meccan",ayahs:26},
    {n:89,en:"Al-Fajr",ar:"الفجر",type:"Meccan",ayahs:30},
    {n:90,en:"Al-Balad",ar:"البلد",type:"Meccan",ayahs:20},
    {n:91,en:"Ash-Shams",ar:"الشمس",type:"Meccan",ayahs:15},
    {n:92,en:"Al-Layl",ar:"الليل",type:"Meccan",ayahs:21},
    {n:93,en:"Ad-Duha",ar:"الضحى",type:"Meccan",ayahs:11},
    {n:94,en:"Ash-Sharh",ar:"الشرح",type:"Meccan",ayahs:8},
    {n:95,en:"At-Tin",ar:"التين",type:"Meccan",ayahs:8},
    {n:96,en:"Al-'Alaq",ar:"العلق",type:"Meccan",ayahs:19},
    {n:97,en:"Al-Qadr",ar:"القدر",type:"Meccan",ayahs:5},
    {n:98,en:"Al-Bayyinah",ar:"البينة",type:"Medinan",ayahs:8},
    {n:99,en:"Az-Zalzalah",ar:"الزلزلة",type:"Medinan",ayahs:8},
    {n:100,en:"Al-'Adiyat",ar:"العاديات",type:"Meccan",ayahs:11},
    {n:101,en:"Al-Qari'ah",ar:"القارعة",type:"Meccan",ayahs:11},
    {n:102,en:"At-Takathur",ar:"التكاثر",type:"Meccan",ayahs:8},
    {n:103,en:"Al-'Asr",ar:"العصر",type:"Meccan",ayahs:3},
    {n:104,en:"Al-Humazah",ar:"الهمزة",type:"Meccan",ayahs:9},
    {n:105,en:"Al-Fil",ar:"الفيل",type:"Meccan",ayahs:5},
    {n:106,en:"Quraysh",ar:"قريش",type:"Meccan",ayahs:4},
    {n:107,en:"Al-Ma'un",ar:"الماعون",type:"Meccan",ayahs:7},
    {n:108,en:"Al-Kawthar",ar:"الكوثر",type:"Meccan",ayahs:3},
    {n:109,en:"Al-Kafirun",ar:"الكافرون",type:"Meccan",ayahs:6},
    {n:110,en:"An-Nasr",ar:"النصر",type:"Medinan",ayahs:3},
    {n:111,en:"Al-Masad",ar:"المسد",type:"Meccan",ayahs:5},
    {n:112,en:"Al-Ikhlas",ar:"الإخلاص",type:"Meccan",ayahs:4},
    {n:113,en:"Al-Falaq",ar:"الفلق",type:"Meccan",ayahs:5},
    {n:114,en:"An-Nas",ar:"الناس",type:"Meccan",ayahs:6},
  ];

  state.surahsData = SURAHS;

  /* ── Quran Player ─────────────────────────────────────────────────── */
  const quranAudio  = document.getElementById('quranAudio');
  const qpPlayPause = document.getElementById('qpPlayPause');
  const qpIcon      = document.getElementById('qpIcon');
  const qpPrev      = document.getElementById('qpPrev');
  const qpNext      = document.getElementById('qpNext');
  const qpSeek      = document.getElementById('qpSeek');
  const qpCurrTime  = document.getElementById('qpCurrTime');
  const qpTotalTime = document.getElementById('qpTotalTime');
  const qpVolume    = document.getElementById('qpVolume');
  const qpRepeat    = document.getElementById('qpRepeat');
  const qpNum       = document.getElementById('qpNum');
  const qpEnName    = document.getElementById('qpEnName');
  const qpDetail    = document.getElementById('qpDetail');
  const qpArName    = document.getElementById('qpArName');

  function fmtAudioTime(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${pad(s)}`;
  }

  function loadSurah(surah) {
    if (!quranAudio || !surah) return;
    state.currentSurah = surah;
    const src = `${QURAN_BASE}${surah.n}.mp3`;
    quranAudio.src = src;
    quranAudio.load();

    if (qpNum)    qpNum.textContent    = String(surah.n).padStart(3,'0');
    if (qpEnName) qpEnName.textContent = surah.en;
    if (qpArName) qpArName.textContent = surah.ar;
    if (qpDetail) qpDetail.textContent = `${surah.ayahs} verses · ${surah.type}`;
    if (qpSeek)   { qpSeek.value = 0; }
    if (qpCurrTime)  qpCurrTime.textContent  = '0:00';
    if (qpTotalTime) qpTotalTime.textContent = '0:00';

    // Highlight active in list
    document.querySelectorAll('.surah-item').forEach(el => {
      el.classList.toggle('playing', +el.dataset.n === surah.n);
    });
  }

  function playSurah(surah) {
    loadSurah(surah);
    quranAudio.play().catch(() => {});
    setQpPlaying(true);
  }

  function setQpPlaying(playing) {
    if (qpIcon) qpIcon.className = playing ? 'bi bi-pause-fill' : 'bi bi-play-fill';
  }

  if (qpPlayPause && quranAudio) {
    qpPlayPause.addEventListener('click', () => {
      if (quranAudio.paused) {
        if (!quranAudio.src && state.currentSurah) loadSurah(state.currentSurah);
        quranAudio.play().catch(()=>{});
        setQpPlaying(true);
      } else {
        quranAudio.pause();
        setQpPlaying(false);
      }
    });
  }

  if (qpPrev && quranAudio) {
    qpPrev.addEventListener('click', () => {
      if (!state.currentSurah) return;
      const idx = SURAHS.findIndex(s => s.n === state.currentSurah.n);
      if (idx > 0) playSurah(SURAHS[idx - 1]);
    });
  }
  if (qpNext && quranAudio) {
    qpNext.addEventListener('click', () => {
      if (!state.currentSurah) return;
      const idx = SURAHS.findIndex(s => s.n === state.currentSurah.n);
      if (idx < SURAHS.length - 1) playSurah(SURAHS[idx + 1]);
    });
  }

  if (quranAudio) {
    quranAudio.addEventListener('timeupdate', () => {
      if (qpCurrTime)  qpCurrTime.textContent  = fmtAudioTime(quranAudio.currentTime);
      if (qpTotalTime && isFinite(quranAudio.duration)) qpTotalTime.textContent = fmtAudioTime(quranAudio.duration);
      if (qpSeek && isFinite(quranAudio.duration) && quranAudio.duration > 0) {
        qpSeek.value = (quranAudio.currentTime / quranAudio.duration) * 100;
      }
    });
    quranAudio.addEventListener('ended', () => {
      if (qpRepeat?.checked) {
        quranAudio.currentTime = 0;
        quranAudio.play().catch(()=>{});
      } else {
        setQpPlaying(false);
        const idx = SURAHS.findIndex(s => s.n === state.currentSurah?.n);
        if (idx >= 0 && idx < SURAHS.length - 1) playSurah(SURAHS[idx + 1]);
      }
    });
    quranAudio.addEventListener('loadedmetadata', () => {
      if (qpTotalTime) qpTotalTime.textContent = fmtAudioTime(quranAudio.duration);
    });
    quranAudio.addEventListener('play',  () => setQpPlaying(true));
    quranAudio.addEventListener('pause', () => setQpPlaying(false));
  }

  if (qpSeek && quranAudio) {
    qpSeek.addEventListener('input', () => {
      if (quranAudio.duration) {
        quranAudio.currentTime = (+qpSeek.value / 100) * quranAudio.duration;
      }
    });
  }
  if (qpVolume && quranAudio) {
    qpVolume.addEventListener('input', () => { quranAudio.volume = +qpVolume.value; });
  }

  /* ── Surah List ───────────────────────────────────────────────────── */
  const surahListEl  = document.getElementById('surahList');
  const surahSearch  = document.getElementById('surahSearch');
  const surahFilter  = document.getElementById('surahFilter');

  function renderSurahList(filter) {
    if (!surahListEl) return;
    let list = SURAHS;
    const q = (surahSearch?.value || '').trim().toLowerCase();
    const f = surahFilter?.value || 'all';
    if (q) list = list.filter(s => s.en.toLowerCase().includes(q) || String(s.n).includes(q));
    if (f !== 'all') list = list.filter(s => s.type === f);

    surahListEl.innerHTML = list.map(s => `
      <div class="surah-item${state.currentSurah?.n === s.n ? ' playing' : ''}" data-n="${s.n}">
        <span class="surah-num">${s.n}</span>
        <div class="surah-info">
          <span class="surah-en">${s.en}</span>
          <span class="surah-trans">${s.ayahs} ayahs · ${s.type}</span>
        </div>
        <span class="surah-ar">${s.ar}</span>
      </div>`).join('');

    surahListEl.querySelectorAll('.surah-item').forEach(el => {
      el.addEventListener('click', () => {
        const surah = SURAHS.find(s => s.n === +el.dataset.n);
        if (surah) playSurah(surah);
      });
    });
  }

  if (surahSearch) surahSearch.addEventListener('input', () => renderSurahList());
  if (surahFilter) surahFilter.addEventListener('change', () => renderSurahList());

  /* ── Back to Top ──────────────────────────────────────────────────── */
  const backTopBtn = document.getElementById('islamicBackTop');
  if (backTopBtn) {
    window.addEventListener('scroll', () => {
      backTopBtn.classList.toggle('hidden', window.scrollY < 300);
    });
    backTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ── Init ─────────────────────────────────────────────────────────── */
  function init() {
    loadSettings();
    syncSettingSelects();

    // Apply saved location label immediately
    const locLabel = document.getElementById('locationLabel');
    if (locLabel) locLabel.textContent = state.city;

    // Ring circumference
    if (ringArc) {
      ringArc.style.strokeDasharray  = RING_CIRC;
      ringArc.style.strokeDashoffset = RING_CIRC;
    }

    // Clock
    tickClock();
    setInterval(tickClock, 1000);
    updateHijriDate();

    // Prayer times
    fetchPrayerTimes();

    // Map (lazy — init when section is visible)
    const mapObs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !state.map) {
        setTimeout(initMap, 100);
        mapObs.disconnect();
      }
    }, { threshold: 0.1 });
    const mapSection = document.getElementById('mapBody');
    if (mapSection) mapObs.observe(mapSection);

    // Notification check
    checkNotifPermission();

    // Surah list
    renderSurahList();

    // Refresh prayer times at midnight
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1) - now;
    setTimeout(() => {
      fetchPrayerTimes();
      setInterval(fetchPrayerTimes, 86400000);
    }, msToMidnight);
  }

  // Ask for location on first visit if no saved coords
  const hasLocation = !!(localStorage.getItem('islamicHubSettings') &&
    JSON.parse(localStorage.getItem('islamicHubSettings') || '{}').lat);

  if (!hasLocation) {
    // Try GPS silently first, then fall back to Dhaka
    navigator.geolocation
      ? navigator.geolocation.getCurrentPosition(
          async pos => {
            const { latitude: lat, longitude: lon } = pos.coords;
            const city = await reverseGeocode(lat, lon);
            state.lat  = lat;
            state.lon  = lon;
            state.city = city;
            saveSettings();
            init();
          },
          () => init(),
          { timeout: 6000 }
        )
      : init();
  } else {
    init();
  }

})();
