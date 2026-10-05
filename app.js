(async () => {
  try {
    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];

    const [bootstrapResponse, cDo, rDo, cEat, rEat] = await Promise.all([
      fetch('/api/bootstrap', { headers: { Accept: 'application/json' } }),
      fetch('./cancun-yucatan-experiences.seed.json').then(response => response.json()),
      fetch('./rio-beyond-experiences.seed.json').then(response => response.json()),
      fetch('./cancun-yucatan-eat-drink.seed.json').then(response => response.json()),
      fetch('./rio-eat-drink.seed.json').then(response => response.json()),
    ]);

    if (!bootstrapResponse.ok) throw new Error(`Could not load account (${bootstrapResponse.status})`);

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

    const savedContent = localStorage.getItem('cr-content');
    const state = {
      destination: ['cancun-yucatan', 'rio-beyond'].includes(localStorage.getItem('cr-destination')) ? localStorage.getItem('cr-destination') : 'cancun-yucatan',
      content: ['all', 'do', 'eat'].includes(savedContent) ? savedContent : 'all',
      mode: 'explore',
      profile: bootstrap.profile,
      search: '',
      quick: new Set(),
      budget: 'all',
      cheapMode: false,
      prefs,
    };

    const saveChains = new Map();
    let detailKey = null;
    let detailOpener = null;
    let detailImageVersion = 0;

    const escapeAttribute = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
      'cancun-yucatan:all': [['Cheap', 'cheap'], ['Local', 'local'], ['Night', 'night'], ['Water', 'water'], ['Hands-on', 'hands-on'], ['Maya', 'maya-ancient']],
      'cancun-yucatan:do': [['Water', 'water'], ['Wildlife', 'wildlife'], ['Maya', 'maya-ancient'], ['Adrenaline', 'adrenaline'], ['Hands-on', 'hands-on'], ['Night', 'night'], ['No car', 'public-transport'], ['Overnight', 'overnight']],
      'cancun-yucatan:eat': [['Near base', 'easy-from-base'], ['Cheap', 'cheap'], ['Local', 'local'], ['Street food', 'street-food'], ['Yucatecan', 'yucatecan'], ['Rooftop', 'rooftop'], ['Night', 'night'], ['Hands-on', 'hands-on']],
      'rio-beyond:all': [['Cheap', 'cheap'], ['Local', 'local'], ['Night', 'night'], ['Beach', 'beach'], ['Culture', 'culture'], ['Adrenaline', 'adrenaline']],
      'rio-beyond:do': [['Hike', 'hiking'], ['Water', 'water'], ['Adrenaline', 'adrenaline'], ['Culture', 'culture'], ['Night', 'night'], ['Learn', 'learn'], ['Rainy day', 'rainy-day'], ['Beyond Rio', 'beyond-rio']],
      'rio-beyond:eat': [['Cheap', 'cheap'], ['Boteco', 'boteco'], ['Samba', 'samba'], ['Beach', 'beach'], ['Local', 'local'], ['Sunset', 'sunset'], ['Cachaça', 'cachaca'], ['Rooftop', 'rooftop']],
    };

    const destinationText = {
      'cancun-yucatan': {
        title: 'Cancún + Yucatán',
        copy: 'Cenotes, Maya cities, islands, reefs, jungle missions, local culture and excellent cheap food.',
        photo: './assets/cancun-hero.jpg',
      },
      'rio-beyond': {
        title: 'Rio + Beyond',
        copy: 'Mountains, Atlantic rainforest, surf, samba, flying, football, island escapes and boteco nights.',
        photo: './assets/rio-hero.jpg',
      },
    };

    const reactionInfo = {
      want: { icon: '🔥', label: 'Want' },
      maybe: { icon: '🤔', label: 'Maybe' },
      skip: { icon: '❌', label: 'Skip' },
      none: { icon: '—', label: 'No call' },
    };

    function mountIdentity() {
      const actions = $('.topbar-actions');
      if (!actions || actions.querySelector('.identity-chip')) return;
      const displayName = state.profile === 'hannah' ? 'Hannah' : 'Emrys';
      const chip = document.createElement('span');
      chip.className = 'identity-chip';
      chip.textContent = displayName;
      chip.title = `Signed in as ${displayName}`;
      chip.setAttribute('aria-label', `Signed in as ${displayName}`);
      actions.appendChild(chip);
    }

    function labelize(value) {
      return String(value || '').replaceAll('-', ' ').replace(/\b\w/g, match => match.toUpperCase());
    }

    function money(value) {
      if (!value || typeof value.amount !== 'number') return null;
      const symbol = value.currency === 'MXN' ? 'MX$' : value.currency === 'BRL' ? 'R$' : value.currency === 'AUD' ? 'A$' : `${value.currency} `;
      return `${symbol}${Math.round(value.amount).toLocaleString()}`;
    }

    function getPrice(raw, content) {
      const budget = raw.budget || {};
      if (content === 'do') {
        if (budget.mission_price_pp_estimate) return `${money(budget.mission_price_pp_estimate)} <small>mission pp</small>`;
        if (budget.activity_price_pp) return `${money(budget.activity_price_pp)} <small>activity pp</small>`;
        if (budget.band === 'price-on-request') return 'Price on request';
        return labelize(budget.band || 'Check price');
      }
      if (budget.expected_spend_pp) return `${money(budget.expected_spend_pp)} <small>pp</small>`;
      if (budget.range_low_pp && budget.range_high_pp) return `${money(budget.range_low_pp)}–${money(budget.range_high_pp)} <small>pp</small>`;
      return labelize(budget.band || 'Variable');
    }

    function getFallbackImage(raw, content) {
      const id = raw.id || '';
      const tags = [...(raw.tags || []), ...(raw.categories || []), ...(raw.vibe || [])].join(' ').toLowerCase();
      const hay = `${id} ${tags}`;

      if (content === 'eat') {
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

    function normalize(raw, content) {
      const isDo = content === 'do';
      const location = raw.location || {};
      const budget = raw.budget || {};
      const tags = new Set(
        [...(raw.tags || []), ...(raw.categories || []), ...(raw.best_for || []), ...(raw.vibe || [])]
          .filter(Boolean)
          .map(tag => String(tag).toLowerCase())
      );
      if (budget.band) tags.add(String(budget.band).toLowerCase());
      if (!isDo) {
        if (location.base_relevance) tags.add(String(location.base_relevance).toLowerCase());
        if (raw.record_type) tags.add(String(raw.record_type).toLowerCase());
      }
      if (isDo && raw.transport?.public_transport_viable) tags.add('public-transport');
      if (isDo && raw.mission_type === 'overnight-unlock') tags.add('overnight');

      const fallbackImage = getFallbackImage(raw, content);
      return {
        ...raw,
        content,
        area: location.area || '',
        budgetBand: budget.band || 'variable',
        tags: [...tags],
        summary: raw.summary || '',
        typeLabel: isDo ? labelize(raw.mission_type || 'experience') : labelize(raw.record_type || 'food'),
        priceText: getPrice(raw, content),
        image: raw.image_url || fallbackImage,
        fallbackImage,
        imagePosition: raw.image_position || 'center',
        imageCredit: raw.image_credit || null,
        imageCreditUrl: raw.image_credit_url || null,
      };
    }

    function allDestinationItems() {
      return [
        ...(DATA.do[state.destination] || []).map(raw => normalize(raw, 'do')),
        ...(DATA.eat[state.destination] || []).map(raw => normalize(raw, 'eat')),
      ];
    }

    function currentItems() {
      const all = allDestinationItems();
      return state.content === 'all' ? all : all.filter(item => item.content === state.content);
    }

    function itemKey(id, content) {
      return `${content}:${state.destination}:${id}`;
    }

    function prefKey(id, content, profile = state.profile) {
      return `${profile}:${itemKey(id, content)}`;
    }

    function getPref(item, profile = state.profile) {
      return state.prefs[prefKey(item.id, item.content, profile)] || null;
    }

    function isPick(item, profile = state.profile) {
      const pref = getPref(item, profile);
      return pref === 'want' || pref === 'maybe';
    }

    function bothWant(item) {
      return getPref(item, 'emrys') === 'want' && getPref(item, 'hannah') === 'want';
    }

    function reaction(item, profile) {
      const value = getPref(item, profile);
      return { value, ...(reactionInfo[value || 'none']) };
    }

    function reactionChip(item, profile, fullName = false) {
      const result = reaction(item, profile);
      const name = profile === 'emrys' ? 'Emrys' : 'Hannah';
      const label = fullName ? name : name[0];
      return `<span class="person-reaction reaction-${result.value || 'none'}" title="${name}: ${result.label}"><b>${label}</b><span>${result.icon}</span>${fullName ? `<small>${result.label}</small>` : ''}</span>`;
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
            if (detailKey) openDetail(detailKey);
          }
          toast('Couldn’t save that pick. Try again.');
        });
      saveChains.set(key, nextChain);
    }

    function setPref(id, content, requestedValue) {
      const focusedPreference = document.activeElement?.dataset.pref;
      const key = itemKey(id, content);
      const stateKey = prefKey(id, content);
      const previous = state.prefs[stateKey] || null;
      const value = previous === requestedValue ? null : requestedValue;

      if (value === null) delete state.prefs[stateKey];
      else state.prefs[stateKey] = value;

      render();
      if (focusedPreference) {
        const replacement = [...document.querySelectorAll('#cardGrid [data-pref]')].find(button => button.dataset.id === id && button.dataset.content === content && button.dataset.pref === focusedPreference);
        (replacement || $('#emptyAction')).focus({ preventScroll: true });
      }
      queuePreferenceSave(key, value, previous, stateKey);

      const name = state.profile === 'hannah' ? 'Hannah' : 'Emrys';
      if (value === null) toast(`${name}: cleared`);
      else toast(`${name}: ${reactionInfo[value].icon} ${reactionInfo[value].label.toLowerCase()}`);
    }

    function budgetRank(band) {
      return ({ free: 0, cheap: 1, normal: 2, variable: 2, treat: 3, splurge: 4, 'price-on-request': 3 })[band] ?? 2;
    }

    function itemMatches(item) {
      const query = state.search.trim().toLowerCase();
      if (query) {
        const hay = [item.name, item.summary, item.area, item.typeLabel, item.content, ...item.tags].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (state.budget !== 'all' && item.budgetBand !== state.budget) return false;
      if (state.quick.size && ![...state.quick].every(filter => item.tags.includes(filter))) return false;
      if (state.mode === 'picks' && !isPick(item)) return false;
      if (state.mode === 'matches' && !bothWant(item)) return false;
      return true;
    }

    function featuredIdsForView() {
      if (state.content === 'do' || state.content === 'eat') {
        return (featured[`${state.destination}:${state.content}`] || []).map(id => `${state.content}:${id}`);
      }
      const doIds = (featured[`${state.destination}:do`] || []).slice(0, 3).map(id => `do:${id}`);
      const eatIds = (featured[`${state.destination}:eat`] || []).slice(0, 3).map(id => `eat:${id}`);
      return doIds.flatMap((id, index) => [id, eatIds[index]]).filter(Boolean);
    }

    function sorted(items) {
      const featuredIds = featuredIdsForView();
      return [...items].sort((a, b) => {
        if (state.mode === 'picks') {
          const prefScore = value => value === 'want' ? 0 : value === 'maybe' ? 1 : 2;
          const mutual = Number(bothWant(b)) - Number(bothWant(a));
          if (mutual) return mutual;
          const diff = prefScore(getPref(a)) - prefScore(getPref(b));
          if (diff) return diff;
        }
        if (state.cheapMode) {
          const difference = budgetRank(a.budgetBand) - budgetRank(b.budgetBand);
          if (difference) return difference;
        }
        const aKey = `${a.content}:${a.id}`;
        const bKey = `${b.content}:${b.id}`;
        const aIndex = featuredIds.indexOf(aKey);
        const bIndex = featuredIds.indexOf(bKey);
        if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
        return a.name.localeCompare(b.name);
      });
    }

    function card(item) {
      const pref = getPref(item);
      const match = bothWant(item);
      const badge = item.budgetBand === 'price-on-request' ? 'POR' : labelize(item.budgetBand);
      const tagHtml = item.tags.slice(0, 2).map(tag => `<span class="mini-tag">${labelize(tag)}</span>`).join('');
      const contentLabel = item.content === 'do' ? '⚡ Do' : '🍜 Eat';
      const openKey = `${item.content}:${item.id}`;

      return `
        <article class="card decision-card ${match ? 'match-card' : ''}" data-id="${item.id}" data-content="${item.content}">
          <div class="card-image" data-open="${openKey}">
            <img src="${escapeAttribute(item.image)}" data-fallback="${escapeAttribute(item.fallbackImage)}" alt="" loading="lazy" decoding="async" style="object-position:${escapeAttribute(item.imagePosition)}" />
            <div class="card-badges">
              <span class="badge content-badge">${contentLabel}</span>
              ${match ? '<span class="match-badge">💥 Match</span>' : `<span class="badge budget-${item.budgetBand}">${badge}</span>`}
            </div>
          </div>
          <div class="card-body" data-open="${openKey}" role="button" tabindex="0" aria-label="View ${escapeAttribute(item.name)} details">
            <div class="card-meta"><span>${item.area || item.typeLabel}</span><span>·</span><span>${item.typeLabel}</span></div>
            <h4>${item.name}</h4>
            <p class="card-copy">${item.summary}</p>
            <div class="decision-row" aria-label="Emrys and Hannah reactions">
              <div class="people-reactions">${reactionChip(item, 'emrys')}${reactionChip(item, 'hannah')}</div>
              <div class="card-tags">${tagHtml}</div>
            </div>
          </div>
          <div class="card-footer">
            <div class="price">${item.priceText}</div>
            <div class="quick-call" aria-label="Your reaction">
              <button class="pref-btn ${pref === 'want' ? 'selected' : ''}" data-pref="want" data-id="${item.id}" data-content="${item.content}" title="Want this">🔥 Want</button>
              <button class="pref-btn ${pref === 'maybe' ? 'selected' : ''}" data-pref="maybe" data-id="${item.id}" data-content="${item.content}" title="Maybe">🤔 Maybe</button>
              <button class="pref-btn ${pref === 'skip' ? 'selected' : ''}" data-pref="skip" data-id="${item.id}" data-content="${item.content}" title="Skip">× Skip</button>
              <button class="open-btn" data-open="${openKey}" title="Open details">→</button>
            </div>
          </div>
        </article>`;
    }

    function renderDestinationHeader(all) {
      const destination = destinationText[state.destination];
      const picks = all.filter(item => isPick(item)).length;
      const matches = all.filter(item => bothWant(item)).length;
      $('#destinationTitle').textContent = destination.title;
      $('#destinationCopy').textContent = destination.copy;
      $('#destinationPhoto').style.backgroundImage = `url('${destination.photo}')`;
      $('#destinationStats').innerHTML = `
        <span class="destination-stat"><strong>${DATA.do[state.destination].length}</strong> things to do</span>
        <span class="destination-stat"><strong>${DATA.eat[state.destination].length}</strong> eat & drink</span>
        <span class="destination-stat"><strong>${picks}</strong> your picks</span>
        <span class="destination-stat ${matches ? 'has-matches' : ''}"><strong>${matches}</strong> matches</span>`;
      document.body.classList.toggle('destination-rio', state.destination === 'rio-beyond');
      document.body.classList.toggle('destination-cancun', state.destination === 'cancun-yucatan');
    }

    function renderQuickFilters() {
      const config = quickConfig[`${state.destination}:${state.content}`] || [];
      $('#quickFilters').innerHTML = config
        .map(([label, key]) => `<button class="chip ${state.quick.has(key) ? 'active' : ''}" type="button" data-quick="${key}">${label}</button>`)
        .join('');
    }

    function renderModeCopy() {
      const name = state.profile === 'hannah' ? 'Hannah' : 'Emrys';
      const copy = {
        explore: ['EXPLORE', 'Find the next thing worth doing.', 'Scan the board, make a call, and see where you overlap.'],
        picks: ['YOUR PICKS', `${name}’s shortlist.`, 'Want first, Maybe second — with the other person’s reaction visible beside yours.'],
        matches: ['MUTUAL YES', 'You both want these.', 'No negotiation required. These are the easiest places to start making actual plans.'],
      }[state.mode];
      $('#sectionKicker').textContent = copy[0];
      $('#sectionTitle').textContent = copy[1];
      $('#sectionSubtitle').textContent = copy[2];
    }

    function render() {
      localStorage.setItem('cr-destination', state.destination);
      localStorage.setItem('cr-content', state.content);

      const all = allDestinationItems();
      const globalPicks = all.filter(item => isPick(item)).length;
      const globalMatches = all.filter(item => bothWant(item)).length;

      $$('.mode-btn').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode));
      $$('.destination-btn').forEach(button => button.classList.toggle('active', button.dataset.destination === state.destination));
      $$('.content-btn').forEach(button => button.classList.toggle('active', button.dataset.content === state.content));
      $$('#budgetFilters .chip').forEach(button => button.classList.toggle('active', button.dataset.budget === state.budget));
      $('#cheapToggle').checked = state.cheapMode;
      $('#pickCount').textContent = globalPicks;
      $('#matchCount').textContent = globalMatches;

      renderDestinationHeader(all);
      renderModeCopy();
      renderQuickFilters();

      $('#searchInput').placeholder = state.content === 'do'
        ? 'Search activities…'
        : state.content === 'eat' ? 'Search food, drinks and venues…' : 'Search the whole board…';

      const viewItems = currentItems();
      const filtered = sorted(viewItems.filter(itemMatches));
      // Standouts are sorted first in this one board, without duplicate hidden cards/images.
      $('#resultCount').textContent = filtered.length;
      $('#resultLabel').textContent = state.mode === 'matches' ? 'matches' : state.mode === 'picks' ? 'picks' : 'possibilities';
      $('#cardGrid').innerHTML = filtered.map(item => card(item)).join('');
      $('#emptyState').hidden = filtered.length > 0;

      if (filtered.length === 0) {
        if (state.mode === 'matches') {
          $('#emptyIcon').textContent = '💥';
          $('#emptyTitle').textContent = 'No mutual yeses here yet.';
          $('#emptyCopy').textContent = 'When you both mark something Want, it lands here automatically.';
        } else if (state.mode === 'picks') {
          $('#emptyIcon').textContent = '🔥';
          $('#emptyTitle').textContent = 'No picks here yet.';
          $('#emptyCopy').textContent = 'Mark something Want or Maybe and it joins your shortlist.';
        } else {
          $('#emptyIcon').textContent = '🧭';
          $('#emptyTitle').textContent = 'Nothing matches that combination.';
          $('#emptyCopy').textContent = 'Try dropping one filter — the good stuff is probably hiding just outside it.';
        }
      }

      const active = [];
      if (state.content !== 'all') active.push(state.content === 'do' ? 'Do' : 'Eat & Drink');
      if (state.quick.size) active.push([...state.quick].map(labelize).join(' + '));
      if (state.budget !== 'all') active.push(labelize(state.budget));
      if (state.search) active.push(`“${state.search}”`);
      if (state.cheapMode) active.push('cheap-first');
      $('#activeFilterText').textContent = active.length ? active.join(' · ') : 'Browse everything or narrow it down.';
      $('#activeFilterText').hidden = active.length === 0;
      $('#resetBtn').disabled = active.length === 0;
      const filterCount = state.quick.size + Number(state.budget !== 'all') + Number(state.cheapMode);
      $('#filterCount').textContent = filterCount;
      $('#filterCount').hidden = filterCount === 0;
      $('#filterDone').textContent = `Show ${filtered.length} ${state.mode === 'explore' ? 'ideas' : state.mode}`;
      $('#emptyAction').textContent = active.length ? 'Clear filters' : 'Explore ideas';
      $$('.mode-btn,.destination-btn,.content-btn,#budgetFilters .chip,[data-quick],[data-pref]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active') || button.classList.contains('selected'))));

      bindDynamic();
    }

    function bindDynamic() {
      $$('.card-image img').forEach(element => {
        element.onerror = () => {
          const fallback = element.dataset.fallback;
          if (fallback && element.getAttribute('src') !== fallback) {
            delete element.dataset.fallback;
            element.src = fallback;
          } else {
            element.hidden = true;
            element.parentElement.classList.add('image-unavailable');
          }
        };
      });

      $$('[data-pref]').forEach(button => {
        button.onclick = event => {
          event.stopPropagation();
          setPref(button.dataset.id, button.dataset.content, button.dataset.pref);
        };
      });

      $$('[data-open]').forEach(element => {
        element.onclick = event => {
          event?.stopPropagation?.();
          openDetail(element.dataset.open);
        };
        if (element.getAttribute('role') === 'button') element.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); element.click(); }
        };
      });

      $$('[data-quick]').forEach(button => {
        button.onclick = () => {
          const key = button.dataset.quick;
          state.quick.has(key) ? state.quick.delete(key) : state.quick.add(key);
          render();
          $(`[data-quick="${key}"]`)?.focus({ preventScroll: true });
        };
      });
    }

    function openDetail(key) {
      const [content, id] = key.split(':');
      const raw = (DATA[content]?.[state.destination] || []).find(item => item.id === id);
      if (!raw) return;
      const alreadyOpen = detailKey !== null;
      const focusedSheetPref = document.activeElement?.dataset.sheetPref;
      if (!alreadyOpen) detailOpener = document.activeElement;
      detailKey = key;
      const imageVersion = ++detailImageVersion;

      const item = normalize(raw, content);
      const pref = getPref(item);
      const match = bothWant(item);
      const sheetImage = $('#sheetImage');
      sheetImage.style.backgroundImage = `url('${item.fallbackImage}')`;
      sheetImage.style.backgroundPosition = item.imagePosition;
      sheetImage.innerHTML = match ? '<span class="sheet-match-badge">💥 You both want this</span>' : '';

      if (item.image && item.image !== item.fallbackImage) {
        const probe = new Image();
        probe.onload = () => {
          if (imageVersion !== detailImageVersion || detailKey !== key) return;
          sheetImage.style.backgroundImage = 'url("' + item.image.replace(/"/g, '\\\"') + '")';
          const credit = item.imageCredit
            ? `<a class="sheet-photo-credit" href="${item.imageCreditUrl || '#'}" ${item.imageCreditUrl ? 'target="_blank" rel="noopener"' : ''}>📷 ${item.imageCredit}</a>`
            : '';
          sheetImage.innerHTML = `${match ? '<span class="sheet-match-badge">💥 You both want this</span>' : ''}${credit}`;
        };
        probe.src = item.image;
      }

      const isDo = content === 'do';
      const details = [];
      details.push(['Budget', labelize(item.budgetBand)]);
      details.push(['Price', item.priceText.replace(/<[^>]*>/g, '')]);
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

      const currentName = state.profile === 'hannah' ? 'Hannah' : 'Emrys';
      $('#sheetBody').innerHTML = `
        <div class="sheet-heading">
          <div class="eyebrow">${content === 'do' ? '⚡ DO' : '🍜 EAT & DRINK'} · ${item.area || item.typeLabel}</div>
          <h2 id="detailTitle">${item.name}</h2>
          <p>${item.summary}</p>
        </div>

        <div class="decision-panel ${match ? 'decision-match' : ''}">
          <div class="decision-panel-head"><span>${match ? '💥 MATCH' : 'THE CALL'}</span><small>Emrys + Hannah</small></div>
          <div class="people-decision-grid">
            ${reactionChip(item, 'emrys', true)}
            ${reactionChip(item, 'hannah', true)}
          </div>
        </div>

        <div class="your-call">
          <div><strong>Your call</strong><small>Saving as ${currentName}</small></div>
          <div class="sheet-pref">
            <button data-sheet-pref="want" class="${pref === 'want' ? 'selected' : ''}">🔥 Want</button>
            <button data-sheet-pref="maybe" class="${pref === 'maybe' ? 'selected' : ''}">🤔 Maybe</button>
            <button data-sheet-pref="skip" class="${pref === 'skip' ? 'selected' : ''}">❌ Skip</button>
          </div>
        </div>

        <div class="info-grid">${details.map(([label, value]) => `<div class="info-box"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>
        <div class="sheet-section"><h3>Useful tags</h3><div class="tag-cloud">${item.tags.slice(0, 12).map(tag => `<span class="mini-tag">${labelize(tag)}</span>`).join('')}</div></div>
        ${transport}${powers}${comboHtml}${order}${sources}
      `;

      $$('[data-sheet-pref]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
        button.onclick = () => {
          setPref(id, content, button.dataset.sheetPref);
          openDetail(key);
        };
      });

      $('#modalBackdrop').hidden = false;
      $('#detailSheet').classList.add('open');
      $('#detailSheet').setAttribute('aria-hidden', 'false');
      $('#detailSheet').inert = false;
      $('#detailSheet').setAttribute('aria-labelledby', 'detailTitle');
      $('.page-shell').inert = true;
      document.body.style.overflow = 'hidden';
      if (!alreadyOpen) { $('#detailSheet').scrollTop = 0; $('#sheetClose').focus({ preventScroll: true }); }
      else if (focusedSheetPref) $(`[data-sheet-pref="${focusedSheetPref}"]`)?.focus({ preventScroll: true });
    }

    function closeDetail() {
      if (!detailKey) return;
      const previousKey = detailKey;
      detailKey = null;
      detailImageVersion += 1;
      $('#detailSheet').classList.remove('open');
      $('#detailSheet').setAttribute('aria-hidden', 'true');
      $('#detailSheet').inert = true;
      $('#modalBackdrop').hidden = true;
      document.body.style.overflow = '';
      $('.page-shell').inert = false;
      const fallback = [...document.querySelectorAll('#cardGrid .open-btn')].find(button => button.dataset.open === previousKey);
      (detailOpener?.isConnected ? detailOpener : fallback || $('.mode-btn.active')).focus({ preventScroll: true });
    }

    let toastTimer;
    function toast(message) {
      const element = $('#toast');
      element.textContent = message;
      element.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
    }

    $$('.mode-btn').forEach(button => {
      button.onclick = () => {
        state.mode = button.dataset.mode;
        render();
        $('#board').scrollIntoView({ behavior: 'instant', block: 'start' });
      };
    });

    $$('.destination-btn').forEach(button => {
      button.onclick = () => {
        state.destination = button.dataset.destination;
        state.quick.clear();
        state.budget = 'all';
        state.search = '';
        $('#searchInput').value = '';
        render();
      };
    });

    $$('.content-btn').forEach(button => {
      button.onclick = () => {
        state.content = button.dataset.content;
        state.quick.clear();
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
      state.content = 'all';
      $('#searchInput').value = '';
      render();
    };
    $('#sheetClose').onclick = closeDetail;
    $('#modalBackdrop').onclick = closeDetail;
    $('#filterDone').onclick = () => { $('.filters-disclosure').open = false; $('.filters-disclosure summary').focus(); };
    $('#emptyAction').onclick = () => {
      if ($('#resetBtn').disabled) state.mode = 'explore';
      $('#resetBtn').onclick();
    };
    document.addEventListener('click', event => {
      // Quick filters rerender their buttons before bubbling reaches document.
      // The original event path still identifies an inside click after replacement.
      if (!event.composedPath().includes($('.filters-disclosure'))) $('.filters-disclosure').open = false;
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeDetail();
        if ($('.filters-disclosure').open) { $('.filters-disclosure').open = false; $('.filters-disclosure summary').focus(); }
      }
      if (event.key === 'Tab' && detailKey) {
        const focusable = [...$('#detailSheet').querySelectorAll('button,a[href],input,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });

    mountIdentity();
    render();
    $('#board').setAttribute('aria-busy', 'false');
  } catch (error) {
    console.error(error);
    const grid = document.getElementById('cardGrid');
    grid.innerHTML = '<div class="loading-state" role="alert"><span class="loading-orbit">↗</span><h3>Your board couldn’t load.</h3><p>Check your connection and private login, then try again. Your saved picks are safe.</p><button class="empty-action" id="retryLoad">Try again</button></div>';
    document.getElementById('board').setAttribute('aria-busy', 'false');
    document.getElementById('retryLoad').onclick = () => location.reload();
  }
})();
