import { readFile } from 'node:fs/promises';

const datasets = [
  { file: 'cancun-yucatan-experiences.seed.json', destination: 'cancun-yucatan', content: 'do', key: 'experiences' },
  { file: 'rio-beyond-experiences.seed.json', destination: 'rio-beyond', content: 'do', key: 'experiences' },
  { file: 'cancun-yucatan-eat-drink.seed.json', destination: 'cancun-yucatan', content: 'eat', key: 'items' },
  { file: 'rio-eat-drink.seed.json', destination: 'rio-beyond', content: 'eat', key: 'items' },
];

const featured = {
  'cancun-yucatan:do': ['punta-laguna', 'muyil-sian-kaan', 'musa-punta-nizuc', 'coba', 'nichupte-sunset-kayak', 'xyaat'],
  'cancun-yucatan:eat': ['parque-palapas-food-night', 'cochinita-pibil-hunt', 'el-pocito', 'xtabentun-hunt', 'mumma-rooftop', 'ancestral-cooking-valladolid'],
  'rio-beyond:do': ['hang-glide-pedra-bonita', 'pedra-da-gavea', 'samba-school-rehearsal', 'arpoador-surf', 'morro-da-urca-trail', 'carnival-backstage'],
  'rio-beyond:eat': ['beco-rato-samba', 'mureta-urca', 'adega-perola', 'mate-biscoito-globo', 'bar-do-omar', 'feijoada-hunt'],
};

const quickFilters = {
  'cancun-yucatan:do': ['water', 'wildlife', 'maya-ancient', 'adrenaline', 'hands-on', 'night', 'public-transport', 'overnight'],
  'cancun-yucatan:eat': ['easy-from-base', 'cheap', 'local', 'street-food', 'yucatecan', 'rooftop', 'night', 'hands-on'],
  'rio-beyond:do': ['hiking', 'water', 'adrenaline', 'culture', 'night', 'learn', 'rainy-day', 'beyond-rio'],
  'rio-beyond:eat': ['cheap', 'boteco', 'samba', 'beach', 'local', 'sunset', 'cachaca', 'rooftop'],
};

const idPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;
const errors = [];
const warnings = [];
const loaded = new Map();
const globalKeys = new Set();

function addUrlCheck(value, label) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  } catch {
    errors.push(`${label}: invalid URL ${value}`);
  }
}

function normalizedTags(item, content) {
  const tags = new Set(
    [...(item.tags || []), ...(item.categories || []), ...(item.best_for || []), ...(item.vibe || [])]
      .filter(Boolean)
      .map(value => String(value).toLowerCase())
  );

  if (content === 'eat') {
    if (item.location?.base_relevance) tags.add(String(item.location.base_relevance).toLowerCase());
    if (item.record_type) tags.add(String(item.record_type).toLowerCase());
    if (item.budget?.band) tags.add(String(item.budget.band).toLowerCase());
  }
  if (content === 'do' && item.transport?.public_transport_viable) tags.add('public-transport');
  if (content === 'do' && item.mission_type === 'overnight-unlock') tags.add('overnight');
  return tags;
}

for (const dataset of datasets) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(dataset.file, 'utf8'));
  } catch (error) {
    errors.push(`${dataset.file}: cannot parse JSON (${error.message})`);
    continue;
  }

  const items = parsed[dataset.key];
  if (!Array.isArray(items)) {
    errors.push(`${dataset.file}: expected array at .${dataset.key}`);
    continue;
  }

  loaded.set(`${dataset.destination}:${dataset.content}`, items);
  const localIds = new Set();

  for (const [index, item] of items.entries()) {
    const label = `${dataset.file}[${index}]`;
    if (!idPattern.test(String(item.id || ''))) errors.push(`${label}: invalid or missing id`);
    if (!item.name || typeof item.name !== 'string') errors.push(`${label}: missing name`);
    if (!item.summary || typeof item.summary !== 'string') errors.push(`${label}: missing summary`);

    if (localIds.has(item.id)) errors.push(`${dataset.file}: duplicate id ${item.id}`);
    localIds.add(item.id);

    const globalKey = `${dataset.content}:${dataset.destination}:${item.id}`;
    if (globalKeys.has(globalKey)) errors.push(`duplicate item key ${globalKey}`);
    globalKeys.add(globalKey);

    if (item.preference) warnings.push(`${globalKey}: legacy seed preference present; runtime ignores it`);
    addUrlCheck(item.image_url, `${globalKey}.image_url`);
    addUrlCheck(item.image_credit_url, `${globalKey}.image_credit_url`);
    for (const source of item.sources || []) addUrlCheck(source?.url, `${globalKey}.sources`);
  }
}

for (const [section, ids] of Object.entries(featured)) {
  const items = loaded.get(section) || [];
  const itemIds = new Set(items.map(item => item.id));
  for (const id of ids) {
    if (!itemIds.has(id)) errors.push(`${section}: featured id not found: ${id}`);
  }
}

for (const [section, filters] of Object.entries(quickFilters)) {
  const [, content] = section.split(':');
  const items = loaded.get(section) || [];
  for (const filter of filters) {
    const matches = items.filter(item => normalizedTags(item, content).has(filter)).length;
    if (!matches) warnings.push(`${section}: quick filter has no exact matches: ${filter}`);
  }
}

if (warnings.length) {
  console.warn(`\nWarnings (${warnings.length})`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error(`\nValidation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`\n✓ Validated ${globalKeys.size} CANCÚNIO records across ${loaded.size} datasets.`);
