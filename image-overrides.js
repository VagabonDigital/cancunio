(() => {
  const imageOverrides = {
    'rio-eat-drink.seed.json': {
      'caipirinha-cachaca': 'https://www.allrecipes.com/thmb/Xv7FI7O3UL7oE__5077haA9fYWs=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/20210-caipirinha-PICS-Beauty-4x3-d4a5aed5d6534d579225b81de111b53a.jpg',
    },
  };

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!response.ok) return response;

    const input = args[0];
    const requestUrl = input instanceof Request ? input.url : String(input);
    const dataset = Object.keys(imageOverrides).find(name => requestUrl.includes(name));
    if (!dataset) return response;

    try {
      const data = await response.clone().json();
      const records = data.items || data.experiences || [];
      const overrides = imageOverrides[dataset];

      records.forEach(record => {
        if (overrides[record.id]) record.image_url = overrides[record.id];
      });

      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.delete('etag');

      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.warn('Cancúnio image override skipped', dataset, error);
      return response;
    }
  };
})();