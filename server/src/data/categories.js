// Category profiles (FR-02). Seeded into the `profiles` collection; adding a profile needs no code change.
// Economic values are SIMULATED defaults; users override them during onboarding step 4.
export const GROUPS = ['Retail', 'Food & beverage', 'Health & wellness', 'Mobility & energy', 'Space & logistics', 'Finance & education'];

// fields DSL: key|type|label|options-or-unit|default   (type: select, number, percent, toggle)
// rules DSL:  kind:arg1:arg2:...
const RAW = [
  ['grocery', 'Supermarket & grocery', 'shopping-cart-2-line', 0, 2, 4000, 22, 42, 60, 1.0, 3000, 'Households, affluence proxy, transit', 'Industrial share ≤ 40%; ≥ 3,000 households within 1.5 km', ['ind_max:0.4', 'hh_min:1.5:3000'],
    ['format|select|Store format|Hypermarket,Supermarket,Convenience|Supermarket', 'sku|number|SKU count|items|8000', 'parking|number|Parking bays needed|bays|8', 'delivery|percent|Home delivery share|%|18', 'fresh|toggle|Fresh produce counter||true'], true],
  ['qcommerce', 'Quick-commerce & dark store', 'flashlight-line', 0, 3, 3000, 18, 48, 45, 0.7, 6000, 'Order density, apartments, income', 'Ground-floor access; two-wheeler road within 100 m', ['road_max:250', 'hh_min:2:6000'],
    ['sla|select|Delivery promise|10 min,20 min,30 min|10 min', 'riders|number|Rider capacity|riders|25', 'orders|number|Orders per day target|orders|900', 'sku|number|SKU count|items|5000']],
  ['pharmacy', 'Pharmacy & medical store', 'capsule-line', 2, 1, 600, 25, 12, 15, 1.1, 2000, 'Hospitals, clinics, households', 'Clinic or hospital within 1 km, or ≥ 2,000 households within 1 km', ['anchor_or_hh:hospitals:1:2000'],
    ['h24|toggle|24x7 operation||false', 'licence|select|Licence type|Retail,Retail + wholesale|Retail', 'nearClinic|toggle|Prefer near clinics||true', 'diagnostics|toggle|Diagnostics tie-up||false'], true],
  ['qsr', 'QSR & fast food', 'restaurant-2-line', 1, 2, 1800, 60, 55, 70, 1.2, 2500, 'Offices, colleges, footfall streets', 'Main-road frontage; commercial share ≥ 15%', ['com_min:0.15', 'road_max:300'],
    ['seats|number|Dine-in seats|seats|40', 'drive|toggle|Drive-through||false', 'delivery|percent|Delivery share|%|35', 'kitchen|select|Kitchen type|Full kitchen,Finishing kitchen|Full kitchen']],
  ['cafe', 'Cafe & coffee chain', 'cup-line', 1, 1.5, 1200, 65, 38, 45, 1.2, 1500, 'Offices, colleges, affluence', 'Commercial share ≥ 20% within 500 m', ['com_min:0.2'],
    ['format|select|Format|Kiosk,Cafe,Flagship|Cafe', 'seats|number|Seats|seats|36', 'ticket|number|Average ticket|₹|320', 'work|toggle|Work-friendly seating||true']],
  ['fashion', 'Fashion & apparel', 't-shirt-2-line', 0, 3, 3500, 45, 50, 80, 1.1, 4000, 'Affluence, malls, high streets', 'High-street or mall adjacency (commercial ≥ 20%)', ['com_min:0.2'],
    ['segment|select|Segment|Value,Mid,Premium|Mid', 'mix|select|Gender mix|Women,Men,Unisex,Kids|Unisex', 'trial|number|Trial rooms|rooms|6', 'site|select|Site type|High street,Mall|High street']],
  ['mall', 'Mall & shopping centre', 'building-4-line', 4, 8, 350000, 70, 900, 25000, 0.12, 60000, 'Population within 5 km, income, arterial roads', 'Arterial road access; low industrial share', ['road_max:200', 'ind_max:0.2'],
    ['plot|number|Plot size|acres|5', 'fsi|number|FSI|ratio|2.5', 'anchors|number|Anchor tenants|stores|4', 'parking|number|Parking|bays|1200']],
  ['convenience', 'Convenience store', 'store-3-line', 0, 0.8, 800, 24, 10, 12, 1.0, 1500, 'Households, transit stops', '≥ 1,500 households within 800 m', ['hh_min:0.8:1500'],
    ['hours|select|Hours|7am-11pm,24x7|7am-11pm', 'fresh|percent|Fresh share|%|15', 'counters|toggle|ATM / bill-pay counter||true']],
  ['auto', 'Automobile dealership', 'car-line', 3, 10, 12000, 8, 150, 300, 0.7, 50000, 'Vehicle ownership, income, highways', 'Arterial road frontage', ['road_max:150'],
    ['segment|select|Brand segment|Entry,Mid,Luxury|Mid', 'workshop|toggle|Showroom + workshop||true', 'bays|number|Service bays|bays|10']],
  ['ev', 'EV charging network', 'charging-pile-2-line', 3, 5, 1500, 30, 9, 40, 0.5, 10000, 'EV density, highways, offices, malls', 'Grid feeder near; parking available (road ≤ 300 m)', ['road_max:300'],
    ['type|select|Charger type|AC,DC fast,Mixed|DC fast', 'kw|number|Power per bay|kW|60', 'bays|number|Bays|bays|6', 'tariff|number|Tariff|₹/kWh|18']],
  ['fuel', 'Fuel station', 'gas-station-line', 3, 4, 16000, 4, 60, 250, 0.4, 8000, 'Traffic volume, highways', 'Highway / arterial frontage; safety setbacks', ['road_max:150', 'res_max:0.75'],
    ['pumps|number|Pumps|pumps|6', 'cng|toggle|CNG / EV add-on||true', 'store|toggle|Convenience store||true']],
  ['diagnostics', 'Diagnostic laboratory', 'microscope-line', 2, 3, 1500, 45, 40, 90, 1.0, 5000, 'Hospitals, clinics, 40+ population', 'Clinic cluster within 2 km', ['anchor_or_hh:hospitals:2:8000'],
    ['format|select|Format|Collection centre,Full lab|Collection centre', 'tests|number|Test menu size|tests|300', 'home|number|Home-collection radius|km|5']],
  ['gym', 'Fitness centre & gym', 'run-line', 2, 2, 6000, 55, 70, 120, 0.8, 4000, 'Young professionals, affluence', 'Residential + commercial mix', ['res_min:0.25'],
    ['format|select|Format|Boutique,Full gym|Full gym', 'price|number|Monthly membership|₹|2200', 'parking|toggle|Parking available||true']],
  ['electronics', 'Electronics & appliances', 'tv-2-line', 0, 5, 5000, 14, 60, 120, 1.0, 8000, 'Affluence, new housing', 'Main-road frontage', ['road_max:250'],
    ['service|toggle|Service centre||true', 'delivery|number|Delivery radius|km|15']],
  ['mobile', 'Mobile phone retail', 'smartphone-line', 0, 1.5, 400, 10, 9, 12, 1.4, 2500, 'Footfall, students, transit', 'Footfall street or market (commercial ≥ 15%)', ['com_min:0.15'],
    ['brand|select|Store type|Brand exclusive,Multi-brand|Multi-brand', 'service|toggle|Service desk||true']],
  ['jewellery', 'Jewellery retail', 'vip-diamond-line', 0, 6, 2500, 12, 70, 200, 1.2, 8000, 'Affluence, wedding demand, markets', 'Security-rated building; main road', ['road_max:200', 'ind_max:0.3'],
    ['mix|select|Gold / diamond mix|Mostly gold,Balanced,Mostly diamond|Balanced', 'vault|toggle|Vault on site||true', 'security|select|Security level|Standard,High|High']],
  ['footwear', 'Footwear retail', 'footprint-line', 0, 3, 1500, 40, 25, 40, 1.1, 3000, 'Footfall, malls, schools', 'High-street or mall adjacency', ['com_min:0.15'],
    ['segment|select|Segment|Value,Mid,Premium|Mid', 'kids|toggle|Kids range||true', 'sports|toggle|Sports range||true']],
  ['salon', 'Beauty salon & parlour', 'scissors-cut-line', 2, 1.5, 1000, 60, 28, 25, 1.0, 2000, 'Women 20–45, affluence', 'Residential within 1 km', ['res_min:0.3'],
    ['chairs|number|Chairs|chairs|8', 'type|select|Type|Unisex,Ladies|Unisex', 'bridal|toggle|Bridal services||true']],
  ['bakery', 'Bakery & confectionery', 'cake-3-line', 1, 1.2, 700, 55, 18, 20, 1.0, 2000, 'Households, schools, offices', 'Food-licence zone (industrial ≤ 30%)', ['ind_max:0.3'],
    ['kitchen|select|Kitchen|On site,Central|On site', 'seating|toggle|Cafe seating||false', 'custom|toggle|Custom cakes||true']],
  ['furniture', 'Furniture & home', 'sofa-line', 0, 8, 10000, 35, 80, 150, 0.7, 15000, 'New housing, affluence', 'Truck access; ground floor', ['road_max:300'],
    ['warehouse|toggle|Warehouse link||true', 'delivery|number|Delivery radius|km|25']],
  ['hardware', 'Building materials & hardware', 'hammer-line', 0, 6, 3000, 20, 30, 50, 0.8, 5000, 'Construction activity, industrial land', 'Truck access; industrial share is a positive driver', ['road_max:300'],
    ['yard|number|Yard space|sq ft|2000', 'b2b|percent|B2B share|%|40']],
  ['restaurant', 'Restaurant & food franchise', 'restaurant-line', 1, 3, 2500, 62, 70, 90, 1.2, 4000, 'Affluence, nightlife, offices', 'Commercial or mixed use', ['com_min:0.15'],
    ['cuisine|select|Cuisine|Indian,Asian,Continental,Multi|Multi', 'seats|number|Seats|seats|70', 'bar|toggle|Bar licence||false', 'delivery|percent|Delivery share|%|30']],
  ['warehouse', 'Warehouse & fulfilment', 'archive-stack-line', 4, 15, 50000, 30, 120, 400, 0.25, 50000, 'Highway access, demand within 15 km', 'Logistics / industrial zoning; truck route', ['road_max:200', 'res_max:0.6'],
    ['docks|number|Loading docks|docks|8', 'height|number|Ceiling height|m|12', 'cold|toggle|Cold chain||false']],
  ['courier', 'Courier & parcel network', 'truck-line', 4, 3, 1200, 35, 22, 15, 0.8, 5000, 'Shipment density, e-commerce, offices', 'Two-wheeler and van access', ['road_max:300'],
    ['type|select|Site type|Hub,Service point|Service point', 'parcels|number|Parcels per day|parcels|1500', 'riders|number|Riders|riders|20']],
  ['bank', 'Banking & NBFC branch', 'bank-line', 5, 3, 1500, 40, 60, 40, 1.0, 5000, 'Households, SMEs, markets', 'Ground floor; security norms', ['res_min:0.15'],
    ['type|select|Branch type|Full branch,Lending only|Full branch', 'atm|toggle|ATM||true', 'staff|number|Staff|people|10']],
  ['coaching', 'Coaching & education', 'book-open-line', 5, 4, 3000, 50, 50, 40, 0.9, 6000, 'Students 14–24, schools, colleges', 'No heavy industry nearby', ['ind_max:0.2'],
    ['segment|select|Segment|School,JEE / NEET,UPSC,Skills|JEE / NEET', 'rooms|number|Classrooms|rooms|8', 'batch|number|Batch size|students|40']],
  ['dairy', 'Dairy & milk distribution', 'drop-line', 1, 1, 300, 15, 5, 6, 1.0, 1500, 'Household density', 'Cold-chain power supply', ['hh_min:1:1500'],
    ['type|select|Outlet|Booth,Parlour|Parlour', 'chiller|number|Chiller capacity|litres|600']],
  ['pet', 'Pet supply & veterinary', 'bear-smile-line', 2, 4, 1200, 40, 20, 30, 1.0, 4000, 'Affluence, apartments, parks', 'Residential within 1 km', ['res_min:0.3'],
    ['clinic|toggle|Clinic + retail||true', 'grooming|toggle|Grooming||true', 'boarding|toggle|Boarding||false']],
  ['carwash', 'Auto servicing & car wash', 'car-washing-line', 3, 4, 4000, 50, 35, 50, 0.6, 4000, 'Vehicle ownership, apartments', 'Water + drainage; road frontage', ['road_max:250'],
    ['bays|number|Bays|bays|6', 'wash|select|Wash type|Manual,Automatic|Manual', 'twoWheeler|percent|Two-wheeler share|%|30']],
  ['coworking', 'Co-working space', 'briefcase-4-line', 4, 5, 15000, 45, 150, 250, 0.9, 5000, 'Offices, startups, metro access', 'Commercial zoning; transit within 1 km', ['com_min:0.25'],
    ['seats|number|Seats|seats|250', 'cabins|number|Private cabins|cabins|20', 'meeting|number|Meeting rooms|rooms|6']],
];

function parseField(s) {
  const [key, type, label, opt, def] = s.split('|');
  const f = { key, type, label };
  if (type === 'select') { f.options = opt.split(','); f.default = def; }
  else if (type === 'toggle') f.default = def === 'true';
  else { f.unit = opt; f.default = Number(def); }
  return f;
}
function parseRule(s) {
  const [kind, ...a] = s.split(':');
  return { kind, args: a.map((x) => (isNaN(Number(x)) ? x : Number(x))) };
}

export const CATEGORIES = RAW.map((r, i) => ({
  key: r[0], order: i + 1, name: r[1], icon: r[2], group: GROUPS[r[3]], catchmentKm: r[4], areaSqft: r[5],
  margin: r[6] / 100, opex: r[7] * 1e5, capex: r[8] * 1e5, rentFactor: r[9], householdsMin: r[10],
  drivers: r[11], ruleText: r[12], rules: r[13].map(parseRule), fields: r[14].map(parseField), p0: !!r[15], version: 1,
}));

export const BRANDS = {
  grocery: ['FreshBasket', 'DailyMart', 'CityGrocer', 'GreenCart'], qcommerce: ['ZipBasket', 'TenMin', 'QuickKart'], pharmacy: ['MediCare Plus', 'HealthFirst Chemist', 'CurePoint'],
  qsr: ['Burger Junction', 'Wrap & Roll', 'Crispy Corner'], cafe: ['Brew Theory', 'Bean Street', 'Roast House', 'Third Shot Coffee'], fashion: ['Threadline', 'UrbanWeave', 'StyleKart'],
  mall: ['Phoenix Square', 'Central Plaza'], convenience: ['24Seven Stop', 'QuickPick'], auto: ['Velocity Motors', 'Prime Wheels'], ev: ['ChargeGrid', 'VoltHub'], fuel: ['HighwayFuels', 'PetroPoint'],
  diagnostics: ['LabCheck', 'PathCare'], gym: ['IronFit', 'PulseGym'], electronics: ['TechBazaar', 'HomeVolt'], mobile: ['PhoneWorld', 'MobiHub'], jewellery: ['Swarna Jewellers', 'Ratna Gold', 'Kanchan Diamonds'],
  footwear: ['StepUp', 'SoleStory'], salon: ['Glow Studio', 'Mirror Lounge'], bakery: ['Crust & Crumb', 'Sugar Bloom'], furniture: ['WoodCraft Home', 'Nest Living'], hardware: ['BuildRight', 'ToolMart'],
  restaurant: ['Spice Route', 'The Daily Table'], warehouse: ['LogiPark', 'StoreHub'], courier: ['ParcelPro', 'SwiftShip'], bank: ['Sahyadri Bank', 'Deccan Finance'], coaching: ['Apex Academy', 'Vidya Classes'],
  dairy: ['Gokul Dairy Point', 'MilkFresh'], pet: ['PawCare', 'Happy Tails'], carwash: ['ShineWash', 'AutoSpa'], coworking: ['WorkNest', 'DeskHive'],
};

export const ALL_CATEGORY = {
  key: 'all', order: 0, name: 'All Sections', icon: 'apps-2-line', group: 'All', catchmentKm: 2, areaSqft: 3000,
  margin: 0.25, opex: 40 * 1e5, capex: 50 * 1e5, rentFactor: 1.0, householdsMin: 2500,
  drivers: 'Households, footfall, affluence proxy', ruleText: 'Commercial or mixed-use with good road connectivity', rules: [], fields: [], p0: true, version: 1,
};

export const catByKey = { all: ALL_CATEGORY, ...Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) };
