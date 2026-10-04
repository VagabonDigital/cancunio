(() => {
  const grid = document.getElementById('cardGrid');
  const allSection = document.querySelector('.all-section');
  if (!grid || !allSection || !window.L) return;

  const listHead = allSection.querySelector('.list-head');
  const emptyState = document.getElementById('emptyState');

  const shell = document.createElement('div');
  shell.className = 'spatial-shell';
  shell.dataset.view = 'list';

  const listPane = document.createElement('div');
  listPane.className = 'spatial-list-pane';

  const mapPane = document.createElement('aside');
  mapPane.className = 'spatial-map-pane';
  mapPane.setAttribute('aria-label', 'Map of visible ideas');
  mapPane.innerHTML = `
    <div class="map-toolbar">
      <div><span class="map-kicker">MAP</span><strong id="mapCount">0 visible</strong></div>
      <button class="map-fit-btn" id="mapFitBtn" type="button">Fit pins</button>
    </div>
    <div id="tripMap" class="trip-map" aria-label="Interactive map"></div>
    <p class="map-note">Pins use place or area centres where exact coordinates are not in the seed data.</p>`;

  const viewToggle = document.createElement('div');
  viewToggle.className = 'spatial-view-toggle';
  viewToggle.setAttribute('aria-label', 'Choose board view');
  viewToggle.innerHTML = `
    <button type="button" class="active" data-spatial-view="list">List</button>
    <button type="button" data-spatial-view="map">Map</button>
    <button type="button" data-spatial-view="split">Split</button>`;

  if (listHead) listHead.insertAdjacentElement('afterend', viewToggle);
  else allSection.prepend(viewToggle);

  grid.parentNode.insertBefore(shell, grid);
  listPane.appendChild(grid);
  if (emptyState) listPane.appendChild(emptyState);
  shell.append(listPane, mapPane);

  const DESTINATIONS = {
    'cancun-yucatan': { center: [20.85, -87.35], zoom: 8 },
    'rio-beyond': { center: [-22.93, -43.22], zoom: 10 },
  };

  const PLACE_RULES = {
    'cancun-yucatan': [
      [/bacalar/, 18.678, -88.392, .010],
      [/mahahual/, 18.716, -87.709, .007],
      [/m[eé]rida|merida/, 20.967, -89.623, .010],
      [/progreso/, 21.282, -89.665, .006],
      [/izamal/, 20.932, -89.018, .006],
      [/chich[eé]n|chichen/, 20.684, -88.568, .003],
      [/ek.?balam/, 20.892, -88.136, .004],
      [/valladolid/, 20.690, -88.202, .006],
      [/r[ií]o lagartos|rio lagartos/, 21.596, -88.157, .006],
      [/coloradas/, 21.607, -87.991, .005],
      [/holbox/, 21.523, -87.379, .008],
      [/isla contoy|contoy/, 21.480, -86.789, .005],
      [/isla mujeres|mujeres/, 21.233, -86.732, .006],
      [/cozumel/, 20.423, -86.922, .010],
      [/puerto morelos/, 20.848, -86.875, .006],
      [/playa del carmen|playa\b/, 20.629, -87.073, .008],
      [/xcaret|xplor/, 20.580, -87.119, .004],
      [/r[ií]o secreto|rio secreto/, 20.588, -87.135, .003],
      [/xel.?h[aá]/, 20.320, -87.359, .004],
      [/dos ojos/, 20.325, -87.391, .003],
      [/akumal|yal.?ku/, 20.397, -87.314, .005],
      [/tulum/, 20.211, -87.465, .010],
      [/muyil|sian.?ka.?an/, 20.067, -87.613, .008],
      [/punta laguna/, 20.648, -87.639, .005],
      [/cob[aá]/, 20.491, -87.732, .005],
      [/punta nizuc|nizuc|musa/, 21.034, -86.788, .004],
      [/nichupt[eé]|nichupte/, 21.103, -86.774, .006],
      [/hotel zone|zona hotelera/, 21.119, -86.758, .008],
      [/canc[uú]n|cancun/, 21.161, -86.851, .012],
    ],
    'rio-beyond': [
      [/paraty/, -23.219, -44.717, .010],
      [/ilha grande|abra[aã]o/, -23.140, -44.170, .012],
      [/b[uú]zios|buzios/, -22.748, -41.881, .010],
      [/arraial do cabo/, -22.966, -42.027, .009],
      [/petr[oó]polis|petropolis/, -22.505, -43.179, .010],
      [/teres[oó]polis|teresopolis/, -22.417, -42.975, .010],
      [/paquet[aá]/, -22.759, -43.109, .006],
      [/niter[oó]i|niteroi/, -22.906, -43.126, .008],
      [/cagarras/, -23.029, -43.191, .005],
      [/barra da tijuca|barra\b/, -23.000, -43.365, .010],
      [/recreio/, -23.025, -43.477, .009],
      [/pedra bonita|hang.?glid|paraglid/, -22.989, -43.284, .004],
      [/pedra da g[aá]vea|pedra da gavea/, -23.003, -43.284, .004],
      [/dois irm[aã]os|dois irmaos/, -22.991, -43.247, .004],
      [/tijuca|floresta da tijuca/, -22.964, -43.284, .010],
      [/maracan[aã]|maracana|football|futebol/, -22.913, -43.230, .004],
      [/samb[oó]dromo|sambodromo|cidade do samba|carnival backstage|samba school/, -22.902, -43.199, .006],
      [/santa teresa/, -22.921, -43.188, .006],
      [/lapa/, -22.914, -43.180, .005],
      [/centro|downtown/, -22.907, -43.176, .007],
      [/urca|p[aã]o de a[cç][uú]car|sugarloaf|morro da urca/, -22.950, -43.165, .005],
      [/botafogo/, -22.951, -43.181, .006],
      [/flamengo/, -22.934, -43.175, .006],
      [/copacabana/, -22.971, -43.182, .007],
      [/arpoador/, -22.988, -43.191, .003],
      [/ipanema/, -22.984, -43.205, .006],
      [/leblon/, -22.985, -43.223, .006],
      [/g[aá]vea|gavea/, -22.979, -43.232, .006],
      [/rio de janeiro|rio\b/, -22.929, -43.196, .014],
    ],
  };

  function destinationKey() {
    return document.body.classList.contains('destination-rio') ? 'rio-beyond' : 'cancun-yucatan';
  }

  function hashOffset(value, scale) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    const x = (((hash & 0xffff) / 0xffff) - .5) * scale;
    const y = ((((hash >>> 16) & 0xffff) / 0xffff) - .5) * scale;
    return [x, y];
  }

  function cardData(card) {
    const id = card.dataset.id || '';
    const content = card.dataset.content || '';
    const name = card.querySelector('h4')?.textContent?.trim() || id;
    const metaBits = [...card.querySelectorAll('.card-meta span')].map(node => node.textContent.trim()).filter(Boolean);
    const area = metaBits[0] || '';
    const combined = `${id} ${name} ${area}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return { id, content, name, area, combined, key: `${content}:${id}` };
  }

  function resolvePoint(card) {
    const data = cardData(card);
    const destination = destinationKey();
    const rules = PLACE_RULES[destination] || [];
    for (const [pattern, lat, lng, spread] of rules) {
      if (!pattern.test(data.combined)) continue;
      const [latJitter, lngJitter] = hashOffset(data.key, spread);
      return { ...data, lat: lat + latJitter, lng: lng + lngJitter, approximate: true };
    }
    const fallback = DESTINATIONS[destination];
    const [latJitter, lngJitter] = hashOffset(data.key, destination === 'rio-beyond' ? .06 : .12);
    return { ...data, lat: fallback.center[0] + latJitter, lng: fallback.center[1] + lngJitter, approximate: true };
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
  }

  const map = L.map('tripMap', { zoomControl: true, attributionControl: true, preferCanvas: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  const markers = new Map();
  let lastKeys = '';
  let latestBounds = null;
  let refreshQueued = false;

  function markerIcon(card, data) {
    const match = card.classList.contains('match-card');
    const picked = !!card.querySelector('.pref-btn.selected');
    const symbol = match ? '💥' : data.content === 'eat' ? '🍜' : '⚡';
    const className = match ? 'map-pin match' : picked ? 'map-pin picked' : 'map-pin';
    return L.divIcon({
      className: 'cancunio-marker-wrap',
      html: `<span class="${className}" aria-hidden="true"><span>${symbol}</span></span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }

  function setActive(key, active) {
    document.querySelectorAll('#cardGrid .card.map-linked').forEach(card => card.classList.remove('map-linked'));
    markers.forEach(marker => marker.getElement()?.classList.remove('map-linked'));
    if (!active) return;
    const card = [...grid.querySelectorAll('.card')].find(candidate => `${candidate.dataset.content}:${candidate.dataset.id}` === key);
    card?.classList.add('map-linked');
    markers.get(key)?.getElement()?.classList.add('map-linked');
  }

  function fitVisible() {
    if (!latestBounds || !latestBounds.isValid()) {
      const destination = DESTINATIONS[destinationKey()];
      map.setView(destination.center, destination.zoom);
      return;
    }
    map.fitBounds(latestBounds, { padding: [42, 42], maxZoom: 13, animate: false });
  }

  function refreshMap() {
    refreshQueued = false;
    markerLayer.clearLayers();
    markers.clear();

    const cards = [...grid.querySelectorAll(':scope > .card')];
    const points = cards.map(card => ({ card, data: resolvePoint(card) }));
    const keys = points.map(({ data }) => data.key).sort().join('|');
    const shouldFit = keys !== lastKeys;
    lastKeys = keys;

    const bounds = L.latLngBounds([]);
    points.forEach(({ card, data }) => {
      const marker = L.marker([data.lat, data.lng], { icon: markerIcon(card, data), title: data.name });
      marker.addTo(markerLayer);
      marker.bindTooltip(
        `<div class="map-tooltip"><strong>${escapeHtml(data.name)}</strong><span>${escapeHtml(data.area || (data.content === 'eat' ? 'Eat & Drink' : 'Experience'))}</span><small>Approximate area</small></div>`,
        { direction: 'top', offset: [0, -11], opacity: .96 }
      );
      marker.on('mouseover', () => setActive(data.key, true));
      marker.on('mouseout', () => setActive(data.key, false));
      marker.on('click', () => {
        setActive(data.key, true);
        card.querySelector('[data-open]')?.click();
      });
      markers.set(data.key, marker);
      bounds.extend([data.lat, data.lng]);
    });

    latestBounds = bounds;
    const count = document.getElementById('mapCount');
    if (count) count.textContent = `${points.length} visible`;

    if (shouldFit && shell.dataset.view !== 'list') requestAnimationFrame(() => {
      map.invalidateSize(false);
      fitVisible();
    });
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refreshMap);
  }

  grid.addEventListener('mouseover', event => {
    const card = event.target.closest('.card');
    if (!card || !grid.contains(card)) return;
    const key = `${card.dataset.content}:${card.dataset.id}`;
    setActive(key, true);
    markers.get(key)?.openTooltip();
  });

  grid.addEventListener('mouseout', event => {
    const card = event.target.closest('.card');
    if (!card || !grid.contains(card)) return;
    const key = `${card.dataset.content}:${card.dataset.id}`;
    markers.get(key)?.closeTooltip();
    setActive(key, false);
  });

  document.getElementById('mapFitBtn')?.addEventListener('click', () => {
    map.invalidateSize(false);
    fitVisible();
  });

  viewToggle.querySelectorAll('[data-spatial-view]').forEach(button => {
    button.addEventListener('click', () => {
      const view = button.dataset.spatialView;
      shell.dataset.view = view;
      viewToggle.querySelectorAll('button').forEach(candidate => candidate.classList.toggle('active', candidate === button));
      if (view !== 'list') requestAnimationFrame(() => {
        map.invalidateSize(false);
        fitVisible();
      });
    });
  });

  const observer = new MutationObserver(queueRefresh);
  observer.observe(grid, { childList: true });

  const bodyObserver = new MutationObserver(queueRefresh);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => {
    if (shell.dataset.view !== 'list') map.invalidateSize(false);
  });
  queueRefresh();
})();