(() => {
  const MODE_COPY = {
    explore: {
      kicker: 'GO ON THEN',
      title: 'What are we actually doing?',
      subtitle: 'Beaches, cenotes, mountains, samba, food. Start saying yes.',
    },
    picks: {
      kicker: 'THE YES PILE',
      title: 'Okay. These survived.',
      subtitle: 'Want first, Maybe second. Your actual contenders, minus the noise.',
    },
    matches: {
      kicker: 'THERE WE GO',
      title: 'You both said yes.',
      subtitle: 'No debate. No diplomacy. These are the obvious moves.',
    },
  };

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node && node.textContent !== text) node.textContent = text;
  }

  function applyStaticVoice() {
    setText('.destination-copy .kicker', 'TWO PEOPLE. TOO MANY GOOD OPTIONS.');
    const boardLink = document.querySelector('.board-link');
    if (boardLink) boardLink.innerHTML = 'Show me the good stuff <span aria-hidden="true">↓</span>';

    const intro = document.querySelector('.board-intro');
    if (intro) {
      const bits = intro.children;
      if (bits[0]) bits[0].textContent = 'THE GOOD STUFF';
      if (bits[1]) bits[1].textContent = 'Pick hard. Compare notes. Do something excellent.';
    }

    const search = document.querySelector('#searchInput');
    if (search) search.placeholder = 'Search food, beaches, chaos…';

    const cheapCopy = document.querySelector('.cheap-toggle small');
    if (cheapCopy) cheapCopy.textContent = 'Stretch the budget. Keep the good stuff.';

    const loadingTitle = document.querySelector('.loading-state h3');
    const loadingCopy = document.querySelector('.loading-state p');
    if (loadingTitle) loadingTitle.textContent = 'Loading the good stuff…';
    if (loadingCopy) loadingCopy.textContent = 'Beaches, mountains and snacks incoming.';

    setText('#emptyTitle', 'You filtered the fun out of it.');
    setText('#emptyCopy', 'Loosen one thing. There’s good stuff hiding nearby.');
  }

  function applyModeVoice() {
    const active = document.querySelector('.mode-btn.active');
    const mode = active?.dataset.mode || 'explore';
    const copy = MODE_COPY[mode] || MODE_COPY.explore;
    setText('#sectionKicker', copy.kicker);
    setText('#sectionTitle', copy.title);
    setText('#sectionSubtitle', copy.subtitle);
  }

  function applyVoice() {
    applyStaticVoice();
    applyModeVoice();
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyVoice();

    const heading = document.querySelector('.section-heading');
    if (heading) {
      new MutationObserver(applyModeVoice).observe(heading, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }

    document.addEventListener('click', event => {
      if (event.target.closest('.mode-btn')) queueMicrotask(applyModeVoice);
    });
  });
})();
