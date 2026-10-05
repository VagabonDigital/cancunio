(() => {
  const imageOverrides = {
    'rio-eat-drink.seed.json': {
      'caipirinha-cachaca': 'https://www.allrecipes.com/thmb/Xv7FI7O3UL7oE__5077haA9fYWs=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/20210-caipirinha-PICS-Beauty-4x3-d4a5aed5d6534d579225b81de111b53a.jpg',
      'acai-juice-hunt': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcThVyvlkGiTsn74V-NHRE1XsUhcR2YC_F-olzWslWWGejveK_ceNRNEGsZS&s=10',
      'adega-perola': 'https://vejario.abril.com.br/wp-content/uploads/2026/06/1.jpg',
      'adega-velha': 'https://adegavelha.com/wp-content/uploads/2023/12/6-combinacoes-perfeitas-para-Adega-Velha-scaled-1.jpg',
    },
    'rio-beyond-experiences.seed.json': {
      'cagarras-island-trail': 'https://static.nationalgeographicbrasil.com/files/styles/image_3200/public/ilhas-cagarras-hope-spot-mission-blue-3.webp?w=1600&h=900',
      'dois-irmaos-sunrise': 'https://a0.muscache.com/im/pictures/Mt/MtTemplate-2472910/original/60dd2aaf-f0b4-466d-8ca0-fe044e7b69dd.png?im_w=1440&im_q=highq',
      'footvolley-lesson': 'https://hikingillustrated.com/wp-content/uploads/2020/03/20200117_Futevolei_rio-de-janeiro_Ipanema-Beach_1086-2000x1200.jpg',
      'arpoador-surf': 'https://www.pacificsurf.com/wp-content/uploads/2022/11/surf-school-rio-de-janeiro-scaled.jpeg',
      'samba-school-rehearsal': 'https://www.civitatis.com/f/brasil/rio-de-janeiro/galeria/coreografia-samba.jpg',
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