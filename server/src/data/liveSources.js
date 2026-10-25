/**
 * LIVE DATA SOURCES
 *
 * SOURCE LIBRARY (SRC): every external source the app can use, with
 *   type        map | api | govt | platform | brand
 *   access      how we can legally get it (open API, keyed API, public portal, partner feed, store locator)
 *   refresh     how fast changes show up
 *   realtime    0–100: how close to real time the source is (100 = status changes visible within hours)
 *   integration integrated (pulled automatically by liveData.js) | import (CSV/JSON feed endpoint ready) | planned
 *
 * CATALOGUE: all 30 categories → which sources apply + feasibility parts.
 *   feasibility = round(0.4·mapCoverage + 0.25·registry + 0.2·freshness + 0.15·platformSignal)
 *   mapCoverage    – share of real outlets visible on OSM / Google Places in Pune
 *   registry       – how complete & usable the government registration list is
 *   freshness      – how quickly openings/closures appear in the best available source
 *   platformSignal – coverage from industry platforms & brand store locators (Swiggy, Zomato, Practo, OEM locators…)
 * These are assessed estimates for Pune, shown in the Trust Center as such.
 *
 * LIVE: the 10 categories whose competitor layer is fetched automatically today.
 *
 * Platforms without a public API (Swiggy, Zomato, Blinkit, Zepto, Justdial, Practo…) are ingested through the
 * platform-feed importer (partner API export, licensed dataset or a ToS-compliant collection job) – the app
 * never scrapes them directly.
 */

export const PUNE_BBOX = { s: 18.44, w: 73.715, n: 18.695, e: 73.995 };

// id: [name, type, access, refresh, realtime, integration, note]
const LIB = {
  osm: ['OpenStreetMap (Overpass API)', 'map', 'Open API · free · ODbL', 'Daily community edits', 70, 'integrated', 'Shops, amenities, brands; closures removed by mappers'],
  gplaces: ['Google Places API (New)', 'api', 'Keyed API · paid per call (GOOGLE_PLACES_KEY)', 'Near real time', 92, 'integrated', 'businessStatus flags CLOSED_PERMANENTLY / CLOSED_TEMPORARILY'],
  ocm: ['Open Charge Map API', 'api', 'Open API · free key (OCM_API_KEY)', 'Daily', 75, 'integrated', 'Charger status IsOperational'],
  shopact: ['Maharashtra Shop & Establishment (Gumasta) registrations', 'govt', 'Public portal (aaplesarkar) · bulk via RTI / dept.', 'Monthly', 40, 'import', 'Every shop with staff must register'],
  gst: ['GST registration (GSTIN search)', 'govt', 'GSP / public search API', 'Weekly', 55, 'import', 'Active / cancelled status per GSTIN'],
  udyam: ['Udyam MSME registration', 'govt', 'Public verification portal', 'Monthly', 35, 'import', 'Small-business census; NIC activity code'],
  mca: ['MCA company master (data.gov.in OGD API)', 'govt', 'Open API · free key', 'Monthly', 35, 'import', 'Registered office + status (active/struck off)'],
  fssai: ['FSSAI FoSCoS licence register', 'govt', 'Public search portal', 'Weekly', 60, 'import', 'Every food business; cancelled licences = closed'],
  fda: ['FDA Maharashtra retail drug licences', 'govt', 'Public portal / dept. list', 'Monthly', 55, 'import', 'Form 20/21 licence per chemist'],
  rbi: ['RBI bank branch master + IFSC (data.gov.in)', 'govt', 'Open download / API', 'Weekly', 80, 'import', 'Every branch with IFSC; merged/closed branches flagged'],
  peso: ['PESO licences + OMC outlet locators (IOCL/BPCL/HPCL)', 'govt', 'Public portal + locator APIs', 'Weekly', 80, 'import', 'Licensed fuel outlets'],
  bee: ['BEE public EV charger list', 'govt', 'Public list (data.gov.in)', 'Monthly', 50, 'import', 'Sanctioned public chargers'],
  nabl: ['NABL accredited labs directory', 'govt', 'Public search portal', 'Monthly', 50, 'import', 'Accreditation status (active/suspended)'],
  bis: ['BIS registered (hallmarking) jewellers', 'govt', 'Public search portal (BIS Care)', 'Monthly', 55, 'import', 'Mandatory HUID registration for jewellers'],
  vahan: ['Parivahan VAHAN dashboard + trade certificates', 'govt', 'Public dashboard', 'Daily', 70, 'import', 'Dealer trade certificates; registrations per RTO = demand'],
  rera: ['MahaRERA project register', 'govt', 'Public portal', 'Weekly', 55, 'import', 'Upcoming malls, commercial & office projects'],
  wdra: ['WDRA registered warehouses + MIDC allotments', 'govt', 'Public list', 'Monthly', 45, 'import', 'Registered warehouse capacity'],
  indiapost: ['India Post office directory (data.gov.in API)', 'govt', 'Open API · free key', 'Monthly', 40, 'import', 'Post offices with pincode'],
  udise: ['UDISE+ schools & AISHE colleges', 'govt', 'Open data', 'Yearly', 20, 'import', 'Student demand anchors'],
  vet: ['Maharashtra State Veterinary Council register', 'govt', 'Public list', 'Yearly', 25, 'import', 'Registered vets / clinics'],
  swiggy: ['Swiggy listings', 'platform', 'Partner feed / licensed dataset (no public API)', 'Real time', 90, 'import', 'Open / closed / unserviceable status, cuisine, rating'],
  zomato: ['Zomato listings', 'platform', 'Partner feed / licensed dataset (no public API)', 'Real time', 90, 'import', 'Dining + delivery listings; delisted = closed'],
  qcom: ['Blinkit / Zepto / Swiggy Instamart serviceability', 'platform', 'Licensed dataset / partner feed', 'Real time', 85, 'import', 'Dark-store locations inferred from serviceable pincodes'],
  justdial: ['Justdial listings', 'platform', 'Licensed dataset / partner feed', 'Weekly', 55, 'import', 'Broad local-business directory'],
  practo: ['Practo / Healthians / 1mg labs', 'platform', 'Partner feed', 'Daily', 70, 'import', 'Labs, clinics, collection centres'],
  indiamart: ['IndiaMART supplier directory', 'platform', 'Partner feed', 'Weekly', 45, 'import', 'Hardware, building material, furniture suppliers'],
  cult: ['Cult.fit / Gold’s Gym / Anytime Fitness centre locators', 'brand', 'Public store locator pages', 'Weekly', 70, 'import', 'Chain gym centres'],
  evapps: ['Tata Power EZ Charge / Statiq / ChargeZone apps', 'platform', 'Operator partner APIs', 'Real time', 85, 'import', 'Live charger availability'],
  omc: ['Oil-company outlet locators', 'brand', 'Public locator APIs', 'Weekly', 80, 'import', 'IOCL / BPCL / HPCL / Jio-bp / Nayara'],
  brand: ['Brand store locators', 'brand', 'Public store locator pages', 'Weekly', 65, 'import', 'Official chain store lists'],
  propertal: ['NoBroker / 99acres / MagicBricks commercial listings', 'platform', 'Licensed dataset', 'Daily', 70, 'import', 'Commercial rent & vacancy (rent layer)'],
  cowork: ['myHQ / Awfis / WeWork / Smartworks locators', 'brand', 'Public locator pages', 'Weekly', 65, 'import', 'Co-working centres and seat counts'],
};

export const SRC = Object.fromEntries(Object.entries(LIB).map(([id, [name, type, access, refresh, realtime, integration, note]]) => [id, { id, name, type, access, refresh, realtime, integration, note }]));

// key: [mapCoverage, registry, freshness, platformSignal, sources[], brandsForLocator?, note]
const CAT = {
  grocery: [60, 70, 70, 80, ['osm', 'gplaces', 'fssai', 'gst', 'shopact', 'qcom', 'brand'], 'D-Mart · Reliance Smart/Fresh · More · Star Bazaar', 'Chains are mapped; kiranas come from FSSAI; quick-commerce dark stores are a direct competitive pressure.'],
  qcommerce: [25, 60, 75, 85, ['qcom', 'fssai', 'gplaces', 'osm'], 'Blinkit · Zepto · Instamart · BB Now', 'Dark stores are deliberately unmapped; FSSAI licences + serviceability data reveal them.'],
  pharmacy: [70, 85, 75, 70, ['osm', 'gplaces', 'fda', 'gst', 'practo', 'brand'], 'Apollo · MedPlus · Wellness Forever · Noble', 'Drug licences make the FDA list near-complete.'],
  qsr: [75, 70, 85, 90, ['osm', 'gplaces', 'swiggy', 'zomato', 'fssai', 'brand'], "McDonald's · KFC · Domino's · Burger King · Subway", 'Swiggy/Zomato show open/closed status in real time.'],
  cafe: [70, 65, 80, 85, ['osm', 'gplaces', 'swiggy', 'zomato', 'fssai', 'brand'], 'Starbucks · Third Wave · Blue Tokai · CCD', 'Independent cafés churn fast; platforms catch it first.'],
  fashion: [60, 45, 55, 75, ['osm', 'gplaces', 'gst', 'shopact', 'brand'], 'Zudio · Trends · Westside · Max · Pantaloons', 'Brand store locators cover organised fashion well.'],
  mall: [90, 70, 50, 60, ['osm', 'gplaces', 'rera', 'propertal'], 'Phoenix · Pavilion · Amanora · Westend', 'Few, large and well known; RERA shows upcoming supply.'],
  convenience: [50, 60, 60, 55, ['osm', 'gplaces', 'fssai', 'shopact', 'brand'], '24Seven · In & Out · local stores', 'Overlaps with kiranas; FSSAI is the main census.'],
  auto: [75, 70, 60, 85, ['osm', 'gplaces', 'vahan', 'brand'], 'Maruti · Tata · Hyundai · Mahindra dealer locators', 'OEM dealer locators are complete; VAHAN gives demand per RTO.'],
  ev: [55, 55, 75, 80, ['osm', 'ocm', 'gplaces', 'bee', 'evapps'], 'Tata Power · Statiq · ChargeZone · Jio-bp pulse', 'New chargers weekly; Open Charge Map + operator apps beat OSM.'],
  fuel: [90, 85, 85, 90, ['osm', 'gplaces', 'peso', 'omc'], 'IOCL · BPCL · HPCL · Jio-bp · Nayara · Shell', 'Large, licensed, fixed; near-complete.'],
  diagnostics: [55, 65, 65, 80, ['osm', 'gplaces', 'nabl', 'practo', 'brand'], 'Dr Lal · Metropolis · Thyrocare · SRL · Suburban', 'Collection centres mostly come from Practo/brand lists.'],
  gym: [60, 40, 65, 75, ['osm', 'gplaces', 'cult', 'shopact', 'justdial'], 'Cult.fit · Gold’s Gym · Anytime Fitness · Snap Fitness', 'Chains via locators; independents via OSM/Justdial.'],
  electronics: [65, 50, 55, 80, ['osm', 'gplaces', 'gst', 'brand'], 'Croma · Reliance Digital · Vijay Sales · brand stores', 'Organised chains publish full store lists.'],
  mobile: [60, 45, 55, 70, ['osm', 'gplaces', 'gst', 'shopact', 'brand'], 'Apple · Samsung · Sangeetha · Poorvika · Mi', 'Brand stores listed; multi-brand shops are dense and under-mapped.'],
  jewellery: [60, 80, 55, 75, ['osm', 'gplaces', 'bis', 'brand'], 'Tanishq · PNG · Kalyan · Malabar · Chandukaka Saraf', 'BIS hallmark registration is mandatory → strong registry.'],
  footwear: [55, 45, 55, 75, ['osm', 'gplaces', 'gst', 'brand'], 'Bata · Metro · Campus · Liberty · Skechers', 'Brand locators carry most of the signal.'],
  salon: [55, 40, 60, 65, ['osm', 'gplaces', 'shopact', 'justdial', 'brand'], 'Naturals · Lakmé · Jawed Habib · Enrich', 'Many small parlours; Justdial + Shop Act fill gaps.'],
  bakery: [60, 70, 75, 80, ['osm', 'gplaces', 'swiggy', 'zomato', 'fssai', 'brand'], 'Monginis · Theobroma · Kayani · Chitale', 'FSSAI + Swiggy/Zomato cover bakeries well.'],
  furniture: [55, 45, 50, 65, ['osm', 'gplaces', 'gst', 'indiamart', 'brand'], 'IKEA · Pepperfry · Home Centre · Durian', 'Large stores mapped; small workshops via IndiaMART.'],
  hardware: [50, 50, 45, 55, ['osm', 'gplaces', 'gst', 'indiamart', 'justdial'], 'Local traders; IndiaMART suppliers', 'Fragmented trade; GST is the best census.'],
  restaurant: [75, 70, 85, 90, ['osm', 'gplaces', 'swiggy', 'zomato', 'fssai'], 'Zomato/Swiggy-listed restaurants', 'Swiggy/Zomato are effectively a live census of restaurants.'],
  warehouse: [55, 65, 45, 50, ['osm', 'gplaces', 'wdra', 'rera', 'propertal'], 'LogiPark · ESR · IndoSpace · Welspun One', 'Large sites; WDRA + MIDC allotments + broker listings.'],
  courier: [60, 55, 60, 70, ['osm', 'gplaces', 'indiapost', 'brand'], 'India Post · Delhivery · Blue Dart · DTDC · Shadowfax', 'Carrier locators publish service points.'],
  bank: [80, 95, 85, 85, ['osm', 'gplaces', 'rbi', 'brand'], 'SBI · HDFC · ICICI · Bank of Maharashtra · Bajaj Finance', 'RBI publishes every branch with IFSC.'],
  coaching: [45, 35, 50, 60, ['osm', 'gplaces', 'udise', 'shopact', 'justdial', 'brand'], 'Allen · Aakash · PW Vidyapeeth · FIITJEE', 'Chains via locators; UDISE/AISHE give student demand.'],
  dairy: [45, 65, 55, 60, ['osm', 'gplaces', 'fssai', 'brand'], 'Chitale · Gokul · Katraj · Amul parlours', 'Booths are licensed (FSSAI) but rarely mapped.'],
  pet: [50, 35, 55, 60, ['osm', 'gplaces', 'vet', 'justdial', 'brand'], 'Supertails · Heads Up For Tails · local vets', 'Small segment; vet council + Justdial.'],
  carwash: [50, 35, 55, 60, ['osm', 'gplaces', 'shopact', 'justdial', 'brand'], 'GoMechanic · 3M Car Care · Carnation', 'Workshops via Justdial + Shop Act.'],
  coworking: [60, 50, 60, 80, ['osm', 'gplaces', 'cowork', 'rera', 'propertal'], 'WeWork · Awfis · Smartworks · myHQ', 'Operators publish centre lists; RERA shows new office supply.'],
};

const HYPER = /d[\s-]?mart|reliance smart|star bazaar|spar|more megastore|big bazaar|metro cash/i;
const SUPER = /reliance fresh|more|spencer|nature'?s basket|dorabjee|ratnadeep|smart point|fresh/i;
const chain = (re) => (t) => (t.brand || re.test(t.name || t.operator || '') ? 'chain' : 'independent');

// Automatically fetched categories: OSM tags, Google Places type, brand-class sizing
export const LIVE = {
  grocery: {
    overpass: ['nwr["shop"="supermarket"]', 'nwr["shop"="grocery"]', 'nwr["shop"="wholesale"]["wholesale"~"food|grocery"]'], gtype: 'supermarket',
    brandClass: (t) => (HYPER.test(t.name || t.brand || '') ? 'hypermarket' : SUPER.test(t.name || t.brand || '') || t.shop === 'supermarket' ? 'supermarket' : 'convenience'),
    area: { hypermarket: 25000, supermarket: 6000, convenience: 1500 },
  },
  pharmacy: { overpass: ['nwr["amenity"="pharmacy"]', 'nwr["shop"="chemist"]'], gtype: 'pharmacy', brandClass: chain(/apollo|medplus|wellness forever|netmeds|truemeds|frank ross|noble/i), area: { chain: 800, independent: 400 } },
  qsr: { overpass: ['nwr["amenity"="fast_food"]'], gtype: 'fast_food_restaurant', brandClass: chain(/mcdonald|kfc|domino|burger king|subway|pizza hut|wow! momo|taco bell/i), area: { chain: 2200, independent: 900 } },
  cafe: { overpass: ['nwr["amenity"="cafe"]'], gtype: 'cafe', brandClass: chain(/starbucks|third wave|blue tokai|cafe coffee day|ccd|costa|barista|tim hortons/i), area: { chain: 1500, independent: 800 } },
  fuel: { overpass: ['nwr["amenity"="fuel"]'], gtype: 'gas_station', brandClass: (t) => (/indian oil|iocl|bharat|bpcl|hindustan|hpcl|shell|nayara|jio-bp|reliance/i.test(t.brand || t.name || t.operator || '') ? 'omc' : 'other'), area: { omc: 16000, other: 12000 } },
  bank: { overpass: ['nwr["amenity"="bank"]'], gtype: 'bank', brandClass: (t) => (/state bank|sbi|hdfc|icici|axis|kotak|bank of maharashtra|bank of baroda|canara|union bank|pnb/i.test(t.name || t.brand || t.operator || '') ? 'major' : 'other'), area: { major: 2000, other: 1200 } },
  ev: { overpass: ['nwr["amenity"="charging_station"]'], gtype: 'electric_vehicle_charging_station', brandClass: (t) => (/dc|ccs|fast/i.test(JSON.stringify(t)) ? 'dc_fast' : 'ac'), area: { dc_fast: 1500, ac: 600 } },
  restaurant: { overpass: ['nwr["amenity"="restaurant"]'], gtype: 'restaurant', brandClass: chain(/barbeque nation|mainland china|social|haldiram|vaishali|shiv sagar|chili'?s/i), area: { chain: 3500, independent: 1800 } },
  bakery: { overpass: ['nwr["shop"="bakery"]', 'nwr["shop"="pastry"]', 'nwr["shop"="confectionery"]'], gtype: 'bakery', brandClass: chain(/monginis|theobroma|kayani|chitale|german bakery|birdy|cakezone/i), area: { chain: 900, independent: 500 } },
  gym: { overpass: ['nwr["leisure"="fitness_centre"]', 'nwr["leisure"="sports_centre"]["sport"="fitness"]'], gtype: 'gym', brandClass: chain(/cult|gold'?s gym|anytime fitness|snap fitness|talwalkar|powerworld/i), area: { chain: 8000, independent: 4000 } },
};

export const LIVE_KEYS = Object.keys(LIVE);
export const isLive = (key) => !!LIVE[key];

export function catalogueOf(key) {
  const c = CAT[key]; if (!c) return null;
  const [mapCoverage, registry, freshness, platformSignal, srcIds, brands, note] = c;
  const parts = { mapCoverage, registry, freshness, platformSignal };
  const sources = srcIds.map((id) => ({ ...SRC[id], ...(id === 'brand' && brands ? { name: `Brand store locators (${brands})` } : {}) }));
  // a live category's OSM + Google sources are integrated; other categories list everything as import/planned
  if (!LIVE[key]) for (const s of sources) if (s.integration === 'integrated') s.integration = 'planned';
  return { parts, sources, brands, note, feasibility: Math.round(0.4 * mapCoverage + 0.25 * registry + 0.2 * freshness + 0.15 * platformSignal) };
}

export const feasibilityOf = (key) => catalogueOf(key)?.feasibility ?? null;
export const CATALOGUE_KEYS = Object.keys(CAT);
