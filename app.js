(async () => {
  try {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const profileSwitch = $('.profile-switch');
    if (profileSwitch) profileSwitch.style.display = 'none';

    const [bootstrapResponse, cDo, rDo, cEat, rEat] = await Promise.all([
      fetch('/api/bootstrap', { headers: { Accept: 'application/json' } }),
      fetch('./cancun-yucatan-experiences.seed.json').then(response => response.json()),
      fetch('./rio-beyond-experiences.seed.json').then(response => response.json()),
      fetch('./cancun-yucatan-eat-drink.seed.json').then(response => response.json()),
      fetch('./rio-eat-drink.seed.json').then(response => response.json()),
    ]);

    if (!bootstrapResponse.ok) {
      throw new Error(`Could not load account (${bootstrapResponse.status})`);
    }

    const bootstrap = await bootstrapResponse.json();
    const DATA = {
      do: {
        'cancun-yucatan': cDo.experiences,
        'rio-beyond': rDo.experiences,
      },
      eat: {
        'cancun-yucatan': cEat.items,
        'rio-beyond': rEat.items,
      },
    };

    const prefs = {};
    for (const row of bootstrap.preferences || []) {
      prefs[`${row.profile}:${row.item_key}`] = row.value;
    }

    const state = {
      destination: localStorage.getItem('cr-destination') || 'cancun-yucatan',
      content: localStorage.getItem('cr-content') || 'do',
      profile: bootstrap.profile,
      search: '',
      quick: new Set(),
      budget: 'all',
      cheapMode: false,
      picksOnly: false,
      prefs,
    };

    const saveChains = new Map();

    const images = {
      cancunHero: 'https://images.unsplash.com/photo-1745874589259-768dcc79a0ef?auto=format&fit=crop&w=1400&q=78',
      cancunWater: 'https://commons.wikimedia.org/wiki/Special:FilePath/Personas%20practicando%20snorkel%20en%20arrecife%20de%20Puerto%20Morelos%201.jpg?width=1200',
      cancunWildlife: 'https://commons.wikimedia.org/wiki/Special:FilePath/Green%20Sea%20Turtle%20grazing%20seagrass.jpg?width=1200',
      cancunIsland: 'https://commons.wikimedia.org/wiki/Special:FilePath/Isla%20Mujeres%20aerial%20%2829729604048%29.jpg?width=1200',
      chichen: 'https://commons.wikimedia.org/wiki/Special:FilePath/Chichen-Itza.jpg?width=1200',
      cenote: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rio%20Secreto%20Quintana%20Roo%20visit%2020%20June%202024%20-%2005.jpg?width=1200',
      cancunCulture: 'https://commons.wikimedia.org/wiki/Special:FilePath/Valladolid%20Yucatan.JPG?width=1200',
      rioHero: 'https://images.unsplash.com/photo-1743443924554-9b7630c2ff46?auto=format&fit=crop&w=1400&q=78',
      rioMountain: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dois%20Irmaos%2C%20Rio%20%2820160307%20171536%29.jpg?width=1200',
      rioCulture: 'https://commons.wikimedia.org/wiki/Special:FilePath/Carnival%20Rehearsal%20at%20a%20Samba%20School.jpg?width=1200',
      rioForest: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rio%20de%20Janeiro%20Tijuca%20Forest%20%282%29.jpg?width=1200',
      rioWater: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sailboats%20in%20a%20bay%20of%20Rio%20de%20Janeiro%2C%20Brazil.jpg?width=1200',
      rioBeach: 'https://commons.wikimedia.org/wiki/Special:FilePath/Arpoador%20-%20Rio.jpg?width=1200',
      rioFootball: 'https://commons.wikimedia.org/wiki/Special:FilePath/Maracana%20Stadium.jpg?width=1200',
      cancunFood: 'https://commons.wikimedia.org/wiki/Special:FilePath/Cochinita%20pibil.jpg?width=1200',
      cancunDessert: 'https://commons.wikimedia.org/wiki/Special:FilePath/Marquesitas.jpg?width=1200',
      cancunDrink: 'https://commons.wikimedia.org/wiki/Special:FilePath/Xtabent%C3%BAn.jpg?width=1200',
      rioFood: 'https://commons.wikimedia.org/wiki/Special:FilePath/FeijoadaBrasileira.jpg?width=1200',
      rioSnack: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coxinha.jpg?width=1200',
      rioDrink: 'https://commons.wikimedia.org/wiki/Special:FilePath/Caipirinha.jpg?width=1200',
      rioBeachFood: 'https://commons.wikimedia.org/wiki/Special:FilePath/Vendedor%20de%20Mate%20do%20Rio%20de%20Janeiro.jpg?width=1200',
    };

    const featured = {
      'cancun-yucatan:do': ['punta-laguna', 'muyil-sian-kaan', 'musa-punta-nizuc', 'coba', 'nichupte-sunset-kayak', 'xyaat'],
      'cancun-yucatan:eat': ['parque-palapas-food-night', 'cochinita-pibil-hunt', 'el-pocito', 'xtabentun-hunt', 'mumma-rooftop', 'ancestral-cooking-valladolid'],
      'rio-beyond:do': ['hang-glide-pedra-bonita', 'pedra-da-gavea', 'samba-school-rehearsal', 'arpoador-surf', 'morro-da-urca-trail', 'carnival-backstage'],
      'rio-beyond:eat': ['beco-rato-samba', 'mureta-urca', 'adega-perola', 'mate-biscoito-globo', 'bar-do-omar', 'feijoada-hunt'],
    };

    const quickConfig = {
      'cancun-yucatan:do': [
        ['Water', 'water'], ['Wildlife', 'wildlife'], ['Maya', 'maya-ancient'], ['Adrenaline', 'adrenaline'],
        ['Hands-on', 'hands-on'], ['Night', 'night'], ['No car', 'public-transport'], ['Overnight', 'overnight'],
      ],
      'cancun-yucatan:eat': [
        ['Near base', 'easy-from-base'], ['Cheap', 'cheap'], ['Local', 'local'], ['Street food', 'street-food'],
        ['Yucatecan', 'yucatecan'], ['Rooftop', 'rooftop'], ['Night', 'night'], ['Hands-on', 'hands-on'],
      ],
      'rio-beyond:do': [
        ['Hike', 'hiking'], ['Water', 'water'], ['Adrenaline', 'adrenaline'], ['Culture', 'culture'],
        ['Night', 'night'], ['Learn', 'learn'], ['Rainy day', 'rainy-day'], ['Beyond Rio', 'beyond-rio'],
      ],
      'rio-beyond:eat': [
        ['Cheap', 'cheap'], ['Boteco', 'boteco'], ['Samba', 'samba'], ['Beach', 'beach'],
        ['Local', 'local'], ['Sunset', 'sunset'], ['Cachaça', 'cachaca'], ['Rooftop', 'rooftop'],
      ],
    };

    const heroText = {
      'cancun-yucatan': {
        title: 'Cancún <span>+</span> Yucatán',
        copy: 'Cenotes, Maya cities, islands, reefs, jungle missions, local culture and excellent cheap food — without pretending every good day needs a tour bus.',
      },
      'rio-beyond': {
        title: 'Rio <span>+</span> Beyond',
        copy: 'Mountains above the city, Atlantic rainforest, surf, samba, flying, football, island escapes and boteco nights — with plenty that costs almost nothing.',
      },
    };

    function mountIdentity() {
      const actions = $('.topbar-actions');
      if (!actions || actions.querySelector('.identity-chip')) return;

      const style = document.createElement('style');
      style.textContent = `
        .profile-switch{display:none!important}
        .identity-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(20,33,32,.12);background:rgba(255,255,255,.9);border-radius:999px;padding:9px 12px;font-size:13px;font-weight:800;line-height:1;white-space:nowrap}
        .identity-chip::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent,#10b9a5);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#10b9a5) 15%,transparent)}
        @media(max-width:640px){.identity-chip{padding:8px 10px;font-size:12px}}
      `;
      document.head.appendChild(style);

      const displayName = state.profile === 'hannah' ? 'Hannah' : 'Emrys';
      const chip = document.createElement('span');
      chip.className = 'identity-chip';
      chip.textContent = displayName;
      chip.title = `Signed in as ${displayName}`;
      chip.setAttribute('aria-label', `Signed in as ${displayName}`);
      const picks = $('#picksBtn');
      if (picks) actions.insertBefore(chip, picks);
      else actions.prepend(chip);
    }

    function currentItems() {
      return DATA[state.content][state.destination] || [];
    }

    function labelize(value) {
      return String(value || '').replaceAll('-', ' ').replace(/\b\w/g, match => match.toUpperCase());
    }

    function money(value) {
      if (!value || typeof value.amount !== 'number') return null;
      const symbol = value.currency === 'MXN' ? 'MX$' : value.currency === 'BRL' ? 'R$' : value.currency === 'AUD' ? 'A$' : `${value.currency} `;
      return `${symbol}${Math.round(value.amount).toLocaleString()}`;
    }

    function getPrice(raw) {
      const budget = raw.budget || {};
      if (state.content === 'do') {
        if (budget.mission_price_pp_estimate) return `${money(budget.mission_price_pp_estimate)} <small>mission pp</small>`;
        if (budget.activity_price_pp) return `${money(budget.activity_price_pp)} <small>activity pp</small>`;
        if (budget.band === 'price-on-request') return 'Price on request';
        return labelize(budget.band || 'Check price');
      }
      if (budget.expected_spend_pp) return `${money(budget.expected_spend_pp)} <small>pp</small>`;
      if (budget.range_low_pp && budget.range_high_pp) return `${money(budget.range_low_pp)}–${money(budget.range_high_pp)} <small>pp</small>`;
      return labelize(budget.band || 'Variable');
    }

    function getFallbackImage(raw) {
      const id = raw.id || '';
      const tags = [...(raw.tags || []), ...(raw.categories || []), ...(raw.vibe || [])].join(' ').toLowerCase();
      const hay = `${id} ${tags}`;

      if (state.content === 'eat') {
        if (state.destination === 'cancun-yucatan') {
          if (/marques|dessert|sweet/.test(hay)) return images.cancunDessert;
          if (/drink|xtab|bar|rooftop|beer|cocktail|night/.test(hay)) return images.cancunDrink;
          return images.cancunFood;
        }
        if (/beach|kiosk|mate|acai|juice/.test(hay)) return images.rioBeachFood;
        if (/drink|cach|caip|bar|rooftop|beer|cocktail|night/.test(hay)) return images.rioDrink;
        if (/snack|boteco|coxinha|pastel/.test(hay)) return images.rioSnack;
        return images.rioFood;
      }

      if (state.destination === 'cancun-yucatan') {
        if (/chichen|coba|ek-balam|ichkabal|maya-ancient/.test(hay)) return images.chichen;
        if (/cenote|secreto|cav|dos-ojos|underground|xplor/.test(hay)) return images.cenote;
        if (/wildlife|turtle|monkey|bird|crocodile/.test(hay)) return images.cancunWildlife;
        if (/island|holbox|cozumel|contoy/.test(hay)) return images.cancunIsland;
        if (/snork|diving|reef|water|kayak|paddl|kitesurf|fishing/.test(hay)) return images.cancunWater;
        if (/culture|hands-on|workshop|local|history/.test(hay)) return images.cancunCulture;
        return images.cancunHero;
      }

      if (/maracana|football/.test(hay)) return images.rioFootball;
      if (/tijuca|forest|waterfall/.test(hay)) return images.rioForest;
      if (/surf|beach|arpoador|sup|footvolley/.test(hay)) return images.rioBeach;
      if (/sail|water|canoe|island|dive|cagarras/.test(hay)) return images.rioWater;
      if (/hike|pedra|morro|mountain|gávea|gavea|dois|corcovado|serra/.test(hay)) return images.rioMountain;
      if (/carnival|samba|capoeira|africa|santa|culture|museum/.test(hay)) return images.rioCulture;
      return images.rioHero;
    }

    function getImage(raw) {
      return raw.image_url || getFallbackImage(raw);
    }

    function normalize(raw) {
      const isDo = state.content === 'do';
      const location = raw.location || {};
      const budget = raw.budget || {};
      const tags = new Set(
        [...(raw.tags || []), ...(raw.categories || []), ...(raw.best_for || []), ...(raw.vibe || [])]
          .filter(Boolean)
          .map(tag => String(tag).toLowerCase())
      );

      if (!isDo) {
        if (location.base_relevance) tags.add(String(location.base_relevance).toLowerCase());
        if (raw.record_type) tags.add(String(raw.record_type).toLowerCase());
        if (budget.band) tags.add(String(budget.band).toLowerCase());
      }
      if (isDo && raw.transport?.public_transport_viable) tags.add('public-transport');
      if (isDo && raw.mission_type === 'overnight-unlock') tags.add('overnight');

      // Seed-level preferences are legacy prototype data. D1 is the preference source of truth.
      const { preference: _legacyPreference, ...content } = raw;
      return {
        ...content,
        area: location.area || '',
        budgetBand: budget.band || 'variable',
        tags: [...tags],
        summary: raw.summary || '',
        typeLabel: isDo ? labelize(raw.mission_type || 'experience') : labelize(raw.record_type || 'food'),
        priceText: getPrice(raw),
        image: getImage(raw),
        fallbackImage: getFallbackImage(raw),
        imagePosition: raw.image_position || 'center',
        imageCredit: raw.image_credit || null,
        imageCreditUrl: raw.image_credit_url || null,
      };
    }

    function itemKey(id) {
      return `${state.content}:${state.destination}:${id}`;
    }

    function prefKey(id, profile = state.profile) {
      return `${profile}:${itemKey(id)}`;
    }

    function getPref(id, profile = state.profile) {
      return state.prefs[prefKey(id, profile)] || null;
    }

    function isPick(id, profile = state.profile) {
      const pref = getPref(id, profile);
      return pref === 'want' || pref === 'maybe';
    }

    function bothWant(id) {
      return getPref(id, 'emrys') === 'want' && getPref(id, 'hannah') === 'want';
    }

    function queuePreferenceSave(key, value, previous, stateKey) {
      const priorChain = saveChains.get(key) || Promise.resolve();
      const nextChain = priorChain
        .catch(() => {})
        .then(async () => {
          const response = await fetch('/api/preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_key: key, value }),
          });
          if (!response.ok) throw new Error(`Preference save failed (${response.status})`);
        })
        .catch(error => {
          console.error(error);
          const current = state.prefs[stateKey] || null;
          if (current === value) {
            if (previous === null) delete state.prefs[stateKey];
            else state.prefs[stateKey] = previous;
            render();
          }
          toast('Couldn’t save that pick. Try again.');
        });
      saveChains.set(key, nextChain);
    }

    function setPref(id, requestedValue) {
      const key = itemKey(id);
      const stateKey = prefKey(id);
      const previous = state.prefs[stateKey] || null;
      const value = previous === requestedValue ? null : requestedValue;

      if (value === null) delete state.prefs[stateKey];
      else state.prefs[stateKey] = value;

      render();
      queuePreferenceSave(key, value, previous, stateKey);

      const name = state.profile === 'hannah' ? 'Hannah' : 'Emrys';
      if (value === null) toast(`${name}: cleared`);
      else toast(`${name}: ${value === 'want' ? '🔥 want this' : value === 'maybe' ? '🤔 maybe' : '❌ skip'}`);
    }

    function budgetRank(band) {
      return ({ free: 0, cheap: 1, normal: 2, variable: 2, treat: 3, splurge: 4, 'price-on-request': 3 })[band] ?? 2;
    }

    function matches(item) {
      const query = state.search.trim().toLowerCase();
      if (query) {
        const hay = [item.name, item.summary, item.area, item.typeLabel, ...item.tags].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (state.budget !== 'all' && item.budgetBand !== state.budget) return false;
      if (state.quick.size && ![...state.quick].every(filter => item.tags.includes(filter))) return false;
      if (state.picksOnly && !isPick(item.id)) return false;
      return true;
    }

    function sorted(items) {
      const ids = featured[`${state.destination}:${state.content}`] || [];
      return [...items].sort((a, b) => {
        if (state.cheapMode) {
          const difference = budgetRank(a.budgetBand) - budgetRank(b.budgetBand);
          if (difference) return difference;
        }
        const aIndex = ids.indexOf(a.id);
        const bIndex = ids.indexOf(b.id);
        if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
        return a.name.localeCompare(b.name);
      });
    }

    function card(item, feature = false) {
      const pref = getPref(item.id);
      const badge = item.budgetBand === 'price-on-request' ? 'POR' : labelize(item.budgetBand);
      const tagHtml = item.tags.slice(0, 4).map(tag => `<span class="mini-tag">${labelize(tag)}</span>`).join('');
      const meta = `${item.typeLabel} · ${item.area}`;
      const mark = bothWant(item.id)
        ? '💥'
        : pref === 'want' ? '🔥' : pref === 'maybe' ? '🤔' : pref === 'skip' ? '❌' : '＋';

      return `
        <article class="card ${feature ? 'feature-card' : ''}" data-id="${item.id}">
          <div class="card-image" data-open="${item.id}" data-image="${encodeURIComponent(item.image)}" data-fallback="${encodeURIComponent(item.fallbackImage)}" style="background-image:url('${item.fallbackImage}');background-position:${item.imagePosition}">
            <div class="card-badges">
              <span class="badge budget-${item.budgetBand}">${badge}</span>
              <span class="preference-mark" title="${bothWant(item.id) ? 'You both want this' : 'Preference'}">${mark}</span>
            </div>
          </div>
          <div class="card-body" data-open="${item.id}">
            <div class="card-meta">${meta}</div>
            <h4>${item.name}</h4>
            <p class="card-copy">${item.summary}</p>
            <div class="card-tags">${tagHtml}</div>
          </div>
          <div class="card-footer">
            <div class="price">${item.priceText}</div>
            <div class="pref-actions" aria-label="Preference">
              <button class="pref-btn ${pref === 'want' ? 'selected' : ''}" data-pref="want" data-id="${item.id}" title="Want this">🔥</button>
              <button class="pref-btn ${pref === 'maybe' ? 'selected' : ''}" data-pref="maybe" data-id="${item.id}" title="Maybe">🤔</button>
              <button class="pref-btn ${pref === 'skip' ? 'selected' : ''}" data-pref="skip" data-id="${item.id}" title="Skip">❌</button>
              <button class="open-btn" data-open="${item.id}">Open</button>
            </div>
          </div>
        </article>`;
    }

    function renderHero(items) {
      const hero = heroText[state.destination];
      $('#heroTitle').innerHTML = hero.title;
      $('#heroCopy').textContent = hero.copy;
      const doCount = DATA.do[state.destination].length;
      const eatCount = DATA.eat[state.destination].length;
      const chosen = items.filter(item => getPref(item.id) === 'want').length;
      $('#heroStats').innerHTML = `
        <span class="hero-stat"><strong>${doCount}</strong> things to do</span>
        <span class="hero-stat"><strong>${eatCount}</strong> eat & drink ideas</span>
        <span class="hero-stat"><strong>${chosen}</strong> ${state.profile === 'hannah' ? 'Hannah' : 'Emrys'} wants</span>`;
      document.body.classList.toggle('destination-rio', state.destination === 'rio-beyond');
      document.body.classList.toggle('destination-cancun', state.destination === 'cancun-yucatan');
    }

    function renderQuickFilters() {
      const config = quickConfig[`${state.destination}:${state.content}`] || [];
      $('#quickFilters').innerHTML = config
        .map(([label, key]) => `<button class="chip ${state.quick.has(key) ? 'active' : ''}" data-quick="${key}">${label}</button>`)
        .join('');
    }

    function render() {
      localStorage.setItem('cr-destination', state.destination);
      localStorage.setItem('cr-content', state.content);

      $$('.destination-switch .segment').forEach(button => button.classList.toggle('active', button.dataset.destination === state.destination));
      $$('.content-switch .segment').forEach(button => button.classList.toggle('active', button.dataset.content === state.content));
      $$('#budgetFilters .chip').forEach(button => button.classList.toggle('active', button.dataset.budget === state.budget));
      $('#cheapToggle').checked = state.cheapMode;
      $('#picksBtn').classList.toggle('active', state.picksOnly);
      $('#picksBtn').innerHTML = `<span>${state.picksOnly ? '←' : '🔥'}</span> ${state.picksOnly ? 'Explore' : 'Picks'} <b id="pickCount">0</b>`;
      renderQuickFilters();

      const all = currentItems().map(normalize);
      renderHero(all);
      $('#pickCount').textContent = all.filter(item => isPick(item.id)).length;

      $('#sectionKicker').textContent = state.picksOnly ? `${state.profile.toUpperCase()}'S PICKS` : 'EXPLORE';
      $('#sectionTitle').textContent = state.picksOnly
        ? 'Things worth remembering'
        : state.content === 'do' ? 'What are we in the mood for?' : 'What do we want to eat, drink or hunt down?';
      $('#searchInput').placeholder = state.content === 'do'
        ? 'Search cenotes, wildlife, cheap missions…'
        : 'Search tacos, samba, rooftops, cheap food…';

      const filtered = sorted(all.filter(matches));
      const featuredIds = featured[`${state.destination}:${state.content}`] || [];
      const featureItems = state.picksOnly || state.search || state.quick.size || state.budget !== 'all'
        ? filtered.slice(0, Math.min(6, filtered.length))
        : featuredIds.map(id => all.find(item => item.id === id)).filter(Boolean);

      $('#featuredSection').hidden = !featureItems.length;
      $('#featuredGrid').innerHTML = featureItems.map(item => card(item, true)).join('');
      $('#resultCount').textContent = filtered.length;
      $('#cardGrid').innerHTML = filtered.map(item => card(item)).join('');
      $('#emptyState').hidden = filtered.length > 0;

      const active = [];
      if (state.quick.size) active.push([...state.quick].map(labelize).join(' + '));
      if (state.budget !== 'all') active.push(labelize(state.budget));
      if (state.search) active.push(`“${state.search}”`);
      if (state.cheapMode) active.push('cheap-first');
      $('#activeFilterText').textContent = active.length ? active.join(' · ') : 'Browse everything or narrow it down.';

      bindDynamic();
    }

    function bindDynamic() {
      $$('[data-image]').forEach(element => {
        const source = decodeURIComponent(element.dataset.image || '');
        const fallback = decodeURIComponent(element.dataset.fallback || '');
        if (!source || source === fallback) return;
        const probe = new Image();
        probe.onload = () => { element.style.backgroundImage = 'url("' + source.replace(/"/g, '\\\"') + '")'; };
        probe.onerror = () => { element.style.backgroundImage = 'url("' + fallback.replace(/"/g, '\\\"') + '")'; };
        probe.src = source;
      });

      $$('[data-pref]').forEach(button => {
        button.onclick = event => {
          event.stopPropagation();
          setPref(button.dataset.id, button.dataset.pref);
        };
      });

      $$('[data-open]').forEach(element => {
        element.onclick = () => openDetail(element.dataset.open);
      });

      $$('[data-quick]').forEach(button => {
        button.onclick = () => {
          const key = button.dataset.quick;
          state.quick.has(key) ? state.quick.delete(key) : state.quick.add(key);
          render();
        };
      });
    }

    function openDetail(id) {
      const raw = currentItems().find(item => item.id === id);
      if (!raw) return;

      const item = normalize(raw);
      const pref = getPref(id);
      const sheetImage = $('#sheetImage');
      sheetImage.style.backgroundImage = `url('${item.fallbackImage}')`;
      sheetImage.style.backgroundPosition = item.imagePosition;
      sheetImage.innerHTML = '';

      if (item.image && item.image !== item.fallbackImage) {
        const probe = new Image();
        probe.onload = () => {
          sheetImage.style.backgroundImage = 'url("' + item.image.replace(/"/g, '\\\"') + '")';
          sheetImage.innerHTML = item.imageCredit
            ? `<a class="sheet-photo-credit" href="${item.imageCreditUrl || '#'}" ${item.imageCreditUrl ? 'target="_blank" rel="noopener"' : ''}>📷 ${item.imageCredit}</a>`
            : '';
        };
        probe.onerror = () => { sheetImage.innerHTML = ''; };
        probe.src = item.image;
      }

      const isDo = state.content === 'do';
      const details = [];
      if (isDo) {
        if (raw.time?.duration_label) details.push(['Time', raw.time.duration_label]);
        if (raw.difficulty) details.push(['Effort', labelize(raw.difficulty)]);
        if (raw.seasonality?.november_fit) details.push(['November', labelize(raw.seasonality.november_fit)]);
        if (raw.transport?.car_helpfulness) details.push(['Car', labelize(raw.transport.car_helpfulness)]);
      } else {
        if (raw.location?.base_relevance) details.push(['From base', labelize(raw.location.base_relevance)]);
        if (raw.record_type) details.push(['Type', labelize(raw.record_type)]);
        if (raw.evening_friendly) details.push(['Evening', 'Good option']);
        if (raw.alcohol_focus) details.push(['Drinks', 'Alcohol-focused']);
      }
      details.unshift(['Budget', labelize(item.budgetBand)]);
      details.push(['Price', item.priceText.replace(/<[^>]*>/g, '')]);

      const transport = isDo && raw.transport?.options?.length
        ? `<div class="sheet-section"><h3>Getting there</h3><ul>${raw.transport.options.map(option => `<li><strong>${labelize(option.mode)}</strong> — ${option.label}${option.notes ? ` · ${option.notes}` : ''}</li>`).join('')}</ul></div>`
        : '';
      const powers = isDo && raw.power_ups?.length
        ? `<div class="sheet-section"><h3>Power-ups</h3><div class="tag-cloud">${raw.power_ups.map(tag => `<span class="mini-tag">⚡ ${labelize(tag)}</span>`).join('')}</div></div>`
        : '';
      const combos = isDo ? raw.smart_combos : raw.pair_with;
      const comboHtml = combos?.length
        ? `<div class="sheet-section"><h3>Pairs well with</h3><div class="tag-cloud">${combos.map(tag => `<span class="mini-tag">↔ ${labelize(tag)}</span>`).join('')}</div></div>`
        : '';
      const order = !isDo && raw.order_this?.length
        ? `<div class="sheet-section"><h3>Try / order</h3><div class="tag-cloud">${raw.order_this.map(tag => `<span class="mini-tag">🍴 ${labelize(tag)}</span>`).join('')}</div></div>`
        : '';
      const sources = raw.sources?.length
        ? `<div class="sheet-section"><h3>Research trail</h3>${raw.sources.filter(source => source.url).map(source => `<a class="source-link" href="${source.url}" target="_blank" rel="noopener">↗ ${source.label}</a>`).join('')}</div>`
        : '';
      const shared = bothWant(id) ? '<div class="sheet-section"><strong>💥 You both want this.</strong></div>' : '';

      $('#sheetBody').innerHTML = `
        <div class="eyebrow">${item.typeLabel} · ${item.area}</div>
        <h2>${item.name}</h2>
        <p>${item.summary}</p>
        ${shared}
        <div class="sheet-pref">
          <button data-sheet-pref="want" class="${pref === 'want' ? 'selected' : ''}">🔥 Want this</button>
          <button data-sheet-pref="maybe" class="${pref === 'maybe' ? 'selected' : ''}">🤔 Maybe</button>
          <button data-sheet-pref="skip" class="${pref === 'skip' ? 'selected' : ''}">❌ Skip</button>
        </div>
        <div class="info-grid">${details.map(([key, value]) => `<div class="info-box"><small>${key}</small><strong>${value}</strong></div>`).join('')}</div>
        <div class="sheet-section"><h3>Tags</h3><div class="tag-cloud">${item.tags.slice(0, 14).map(tag => `<span class="mini-tag">${labelize(tag)}</span>`).join('')}</div></div>
        ${transport}${powers}${comboHtml}${order}${sources}
      `;

      $$('[data-sheet-pref]').forEach(button => {
        button.onclick = () => {
          setPref(id, button.dataset.sheetPref);
          openDetail(id);
        };
      });

      $('#modalBackdrop').hidden = false;
      $('#detailSheet').classList.add('open');
      $('#detailSheet').setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeDetail() {
      $('#detailSheet').classList.remove('open');
      $('#detailSheet').setAttribute('aria-hidden', 'true');
      $('#modalBackdrop').hidden = true;
      document.body.style.overflow = '';
    }

    let toastTimer;
    function toast(message) {
      const element = $('#toast');
      element.textContent = message;
      element.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => element.classList.remove('show'), 1300);
    }

    $$('.destination-switch .segment').forEach(button => {
      button.onclick = () => {
        state.destination = button.dataset.destination;
        state.quick.clear();
        state.budget = 'all';
        state.search = '';
        $('#searchInput').value = '';
        render();
      };
    });

    $$('.content-switch .segment').forEach(button => {
      button.onclick = () => {
        state.content = button.dataset.content;
        state.quick.clear();
        state.budget = 'all';
        state.search = '';
        $('#searchInput').value = '';
        render();
      };
    });

    $('#searchInput').addEventListener('input', event => { state.search = event.target.value; render(); });
    $('#cheapToggle').addEventListener('change', event => { state.cheapMode = event.target.checked; render(); });
    $$('#budgetFilters .chip').forEach(button => { button.onclick = () => { state.budget = button.dataset.budget; render(); }; });
    $('#resetBtn').onclick = () => {
      state.search = '';
      state.quick.clear();
      state.budget = 'all';
      state.cheapMode = false;
      state.picksOnly = false;
      $('#searchInput').value = '';
      render();
    };
    $('#picksBtn').onclick = () => { state.picksOnly = !state.picksOnly; render(); };
    $('#sheetClose').onclick = closeDetail;
    $('#modalBackdrop').onclick = closeDetail;
    window.addEventListener('keydown', event => { if (event.key === 'Escape') closeDetail(); });

    mountIdentity();
    render();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main style="font-family:system-ui;padding:2rem;max-width:760px;margin:auto"><h1>Cancúnio hit an error</h1><p>${error?.message || String(error)}</p></main>`;
  }
})();
