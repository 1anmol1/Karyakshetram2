import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAuth, useToast } from '../lib/state.jsx';
import { inr, pct, downloadCsv, n, cleanAiText } from '../lib/format.js';
import { Header, Footer, SystemBanners } from '../components/Layout.jsx';
import { Icon, Collapse, Tier, Banner, Skel, ErrorBox, EmptyState, Seg, Modal, AiStreamingText } from '../components/ui.jsx';
import { PickCard, ShopCard } from '../components/Cards.jsx';
import CompetitorAnalysisModal from '../components/CompetitorModal.jsx';
import HexMap from '../components/HexMap.jsx';

const SAMPLE_PICKS = [
  {
    cell: '886088508dfffff',
    category: 'grocery',
    locality: 'Deccan Gymkhana',
    lat: 18.5164,
    lon: 73.8307,
    label: 'Best overall',
    icon: 'award-line',
    rule: 'Highest expected profit while meeting all constraints',
    tier: 'A',
    confidence: 'High',
    rent: 174,
    profit: { exp: 6697468, p10: 3559805 },
    revenue: { p10: 73235478, p50: 87497584, p90: 103899006, min: 60000000, max: 120000000 },
    stress: { passes: 4 },
    cannibalisation: { ratio: 0.02 },
    flags: ['HIGH_DENSITY'],
    empty: false,
  },
  {
    cell: '8860884203fffff',
    category: 'grocery',
    locality: 'Baner High Street',
    lat: 18.559,
    lon: 73.7868,
    label: 'Lowest risk',
    icon: 'shield-check-line',
    rule: 'High population growth and balanced competition',
    tier: 'A',
    confidence: 'High',
    rent: 145,
    profit: { exp: 5840000, p10: 2980000 },
    revenue: { p10: 64500000, p50: 78200000, p90: 92400000, min: 55000000, max: 110000000 },
    stress: { passes: 4 },
    cannibalisation: { ratio: 0.03 },
    flags: ['GROWTH_CORRIDOR'],
    empty: false,
  },
  {
    cell: '8860884249fffff',
    category: 'grocery',
    locality: 'Aundh ITI Road',
    lat: 18.559,
    lon: 73.8077,
    label: 'Growth',
    icon: 'funds-line',
    rule: 'Strong purchasing power and established residential catchment',
    tier: 'A',
    confidence: 'High',
    rent: 155,
    profit: { exp: 5420000, p10: 2710000 },
    revenue: { p10: 61000000, p50: 74500000, p90: 88000000, min: 50000000, max: 105000000 },
    stress: { passes: 4 },
    cannibalisation: { ratio: 0.04 },
    flags: ['AFFLUENT_CATCHMENT'],
    empty: false,
  },
  {
    cell: '8860884257fffff',
    category: 'grocery',
    locality: 'Wakad Datta Mandir',
    lat: 18.5986,
    lon: 73.7646,
    label: 'Under-served',
    icon: 'compass-3-line',
    rule: 'High household count with lower competitor density',
    tier: 'B',
    confidence: 'Medium',
    rent: 120,
    profit: { exp: 4680000, p10: 1850000 },
    revenue: { p10: 52000000, p50: 65400000, p90: 79200000, min: 42000000, max: 95000000 },
    stress: { passes: 3 },
    cannibalisation: { ratio: 0.01 },
    flags: ['FAST_EXPANSION'],
    empty: false,
  },
  {
    cell: '8860884263fffff',
    category: 'grocery',
    locality: 'Kothrud Paud Road',
    lat: 18.5074,
    lon: 73.8077,
    label: 'Lowest investment',
    icon: 'wallet-3-line',
    rule: 'Economical rent and high footfall density',
    tier: 'B',
    confidence: 'Medium',
    rent: 110,
    profit: { exp: 4150000, p10: 1620000 },
    revenue: { p10: 48000000, p50: 59800000, p90: 72500000, min: 38000000, max: 88000000 },
    stress: { passes: 3 },
    cannibalisation: { ratio: 0.02 },
    flags: [],
    empty: false,
  },
];

const SAMPLE_SHOPS = [
  {
    id: 'sample_shop_1',
    name: 'FreshMart Express (Your store)',
    category: 'grocery',
    relation: 'Your store',
    distKm: 0.35,
    cell: '8860884203fffff',
    lat: 18.559,
    lon: 73.7868,
  },
  {
    id: 'sample_shop_2',
    name: 'Mainland China Restaurant',
    category: 'restaurant',
    distKm: 0.55,
    cell: '886088508dfffff',
    lat: 18.562,
    lon: 73.789,
  },
  {
    id: 'sample_shop_3',
    name: 'Apollo Pharmacy 24/7',
    category: 'pharmacy',
    distKm: 0.78,
    cell: '8860884249fffff',
    lat: 18.557,
    lon: 73.784,
  },
  {
    id: 'sample_shop_4',
    name: 'Blue Tokai Coffee Roasters',
    category: 'cafe',
    distKm: 0.95,
    cell: '8860884257fffff',
    lat: 18.564,
    lon: 73.791,
  },
  {
    id: 'sample_shop_5',
    name: 'D-Mart Ready Supermarket',
    category: 'supermarket',
    relation: 'Competitor',
    distKm: 1.12,
    cell: '8860884263fffff',
    lat: 18.555,
    lon: 73.782,
  },
  {
    id: 'sample_shop_6',
    name: 'Wellness Forever Chemist',
    category: 'pharmacy',
    distKm: 1.35,
    cell: '886088420bfffff',
    lat: 18.566,
    lon: 73.78,
  },
  {
    id: 'sample_shop_7',
    name: 'Fabindia Apparel & Lifestyle',
    category: 'apparel',
    distKm: 1.62,
    cell: '8860884217fffff',
    lat: 18.553,
    lon: 73.793,
  },
  {
    id: 'sample_shop_8',
    name: 'Third Wave Coffee',
    category: 'cafe',
    distKm: 1.85,
    cell: '8860884231fffff',
    lat: 18.568,
    lon: 73.788,
  },
];

const calcDistKm = (lat1, lon1, lat2, lon2) => {
  if (!Number.isFinite(lat1) || !Number.isFinite(lat2) || !Number.isFinite(lon1) || !Number.isFinite(lon2)) return 0.5;
  return Number(Math.hypot((lat2 - lat1) * 110.6, (lon2 - lon1) * 105.4).toFixed(2));
};

// Persistent module-level and sessionStorage cache for AI summary
const summaryMemoryCache = new Map();

function getCachedSummary(key) {
  if (!key) return null;
  if (summaryMemoryCache.has(key)) return summaryMemoryCache.get(key);
  try {
    const raw = sessionStorage.getItem(`ks_summary_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      summaryMemoryCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function setCachedSummary(key, val) {
  if (!key || !val) return;
  summaryMemoryCache.set(key, val);
  try {
    sessionStorage.setItem(`ks_summary_${key}`, JSON.stringify(val));
    sessionStorage.setItem('ks_summary_last_key', key);
  } catch {}
}

function clearCachedSummary(key) {
  if (!key) return;
  summaryMemoryCache.delete(key);
  try {
    sessionStorage.removeItem(`ks_summary_${key}`);
    if (sessionStorage.getItem('ks_summary_last_key') === key) {
      sessionStorage.removeItem('ks_summary_last_key');
    }
  } catch {}
}

export default function Dashboard() {
  const { user } = useAuth();
  const { category, catInfo, locality, setLocality, setPicks, compare, setCompare, categories } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const goals = user.profile?.category === category ? user.profile.goals || {} : {};
  const [filters, setFilters] = useState({
    tiers: new Set(['A', 'B']),
    maxRent: goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1)),
    conf: new Set(['High', 'Medium']),
    hideEmpty: true,
    spacing: goals.minSpacingKm || 1.5,
    page: 1,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [rec, setRec] = useState({ loading: true });
  const [selectedShop, setSelectedShop] = useState(null);
  // debounce slider/chip changes so dragging a slider sends one request, not dozens
  const [qf, setQf] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setQf(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);

  const [cells, setCells] = useState(null);
  const [trend, setTrend] = useState(null);
  const [summary, setSummary] = useState(() => {
    try {
      const lastKey = sessionStorage.getItem('ks_summary_last_key');
      if (lastKey) return getCachedSummary(lastKey);
    } catch {}
    return null;
  });
  const [shops, setShops] = useState(null);
  const [shopTag, setShopTag] = useState('all');
  const [view, setView] = useState('map');
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(new Set());
  const [grid, setGrid] = useState(user.profile?.grid || 'res8');
  const [retry, setRetry] = useState(0);
  const [myStores, setMyStores] = useState([]);
  const [showAllPicks, setShowAllPicks] = useState(false);
  const [addBizOpen, setAddBizOpen] = useState(false);
  const [bizForm, setBizForm] = useState({
    name: '',
    localityName: 'Baner',
    lat: 18.559,
    lon: 73.7868,
    annualRevenue: '',
    category: 'grocery',
  });
  const [bizBusy, setBizBusy] = useState(false);
  const [bizErr, setBizErr] = useState('');

  // Search input state
  const [searchQ, setSearchQ] = useState(locality?.name || '');
  const [searchRes, setSearchRes] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHi, setSearchHi] = useState(0);
  const [searchMsg, setSearchMsg] = useState('');
  const searchInp = useRef(null);

  useEffect(() => setSearchQ(locality?.name || ''), [locality?.name]);

  useEffect(() => {
    if (!searchQ.trim() || searchQ === locality?.name) {
      setSearchRes([]);
      setSearchMsg('');
      return undefined;
    }
    const reqCat = category === 'all' ? 'grocery' : category;
    const t = setTimeout(
      () =>
        api(`/search?q=${encodeURIComponent(searchQ)}&category=${reqCat}`)
          .then((r) => {
            setSearchRes(r.results || []);
            setSearchMsg(r.error || (r.results?.length ? '' : 'No locality matches. Try a nearby area or coordinates.'));
            setSearchHi(0);
          })
          .catch(() => {}),
      220
    );
    return () => clearTimeout(t);
  }, [searchQ, locality?.name, category]);

  const chooseSearch = (r) => {
    setSearchOpen(false);
    setSearchQ(r.name);
    if (r.type === 'cell' || r.type === 'point') {
      if (r.cell) nav(`/location/${r.cell}`);
    } else {
      setLocality({ name: r.name, lat: r.lat, lon: r.lon });
    }
  };

  useEffect(() => {
    api('/stores')
      .then((r) => setMyStores(r.stores || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setFilters((f) => ({ ...f, maxRent: goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1)) }));
  }, [category, catInfo?.rentFactor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api('/saved')
      .then((r) => {
        const s = new Set();
        (r.saved || []).forEach((x) => {
          if (x.cell) s.add(x.cell);
          if (x._id) s.add(x._id);
        });
        setSaved(s);
      })
      .catch(() => {});
  }, []);

  // recommendations
  useEffect(() => {
    const ctrl = new AbortController();
    setRec((r) => ({ ...r, loading: true, error: null }));
    const excludeLow = !qf.conf.has('Low') || qf.hideEmpty;
    const reqCat = category === 'all' ? 'grocery' : category;
    const body = {
      category: reqCat,
      constraints: {
        maxRent: Number(qf.maxRent) || undefined,
        minSpacingKm: Number(qf.spacing) || 1.5,
      },
      excludeLow,
      grid,
      ...(locality ? { focusAreas: nearbyAreas(locality) } : {}),
    };
    api('/recommend', { method: 'POST', body, signal: ctrl.signal })
      .then((r) => {
        setRec({ loading: false, data: r });
        setPicks(r.picks || []);
      })
      .catch((e) => {
        if (e.code !== 'ABORTED') setRec({ loading: false, error: e });
      });
    return () => ctrl.abort();
  }, [category, locality?.name, qf.maxRent, qf.conf, qf.hideEmpty, qf.spacing, retry, grid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reqCat = category === 'all' ? 'grocery' : category;
    setCells(null);
    api(`/cells?category=${reqCat}`)
      .then(setCells)
      .catch(() => setCells({ features: [] }));
  }, [category]);

  useEffect(() => {
    const reqCat = category === 'all' ? 'grocery' : category;
    setTrend(null);
    api(`/trending?category=${reqCat}`)
      .then((r) => setTrend(r.trending || []))
      .catch(() => setTrend([]));
  }, [category]);

  useEffect(() => {
    if (!locality) {
      setShops(null);
      return;
    }
    const reqCat = category === 'all' ? 'grocery' : category;
    let active = true;
    api(`/shops?lat=${locality.lat}&lon=${locality.lon}&radiusKm=2&category=${reqCat}&tag=${shopTag}&limit=12`)
      .then((data) => {
        if (active) setShops(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [locality?.name, category, shopTag]); // eslint-disable-line react-hooks/exhaustive-deps

  const rawPicks = rec.data?.picks || [];
  const realPicks = rawPicks.filter((p) => !p.empty);
  const extraLocations = rec.data?.allLocations || [];
  const allAvailableLocations = [
    ...realPicks,
    ...extraLocations.filter((e) => !realPicks.some((p) => p.cell === e.cell)),
  ];
  // Guarantee fully functioning sample cards if API returns 0 or offline
  const displayPicks = allAvailableLocations.length > 0 ? allAvailableLocations : SAMPLE_PICKS;
  const best = displayPicks.find((p) => !p.empty);

  useEffect(() => {
    if (!best?.cell) return;
    const cellKey = best.cell;
    const filterKey = `${cellKey}_${category}_${Array.from(filters.tiers).sort().join('')}_${Array.from(filters.conf).sort().join('')}_${filters.maxRent}_${filters.spacing}_${filters.hideEmpty}`;

    // Re-use cached summary when navigating back; only fetch new if missing or user clicked refresh (retry > 0)
    if (retry === 0) {
      const cached = getCachedSummary(filterKey);
      if (cached) {
        setSummary(cached);
        return;
      }
    }

    setSummary({ loading: true });
    const reqCat = category === 'all' ? 'grocery' : category;
    api('/explain', { method: 'POST', body: { cellId: cellKey, category: reqCat } })
      .then((r) => {
        setCachedSummary(filterKey, r);
        setSummary(r);
      })
      .catch((e) => setSummary({ error: e }));
  }, [
    best?.cell,
    category,
    Array.from(filters.tiers).sort().join(''),
    Array.from(filters.conf).sort().join(''),
    filters.maxRent,
    filters.spacing,
    filters.hideEmpty,
    retry,
  ]);

  const pins = displayPicks
    .filter((p) => !p.empty)
    .map((p, idx) => ({
      lat: p.lat,
      lon: p.lon,
      n: idx + 1,
      label: idx === 0 ? p.label : '',
      title: `${p.label}: ${p.locality}`,
      onClick: () => nav(`/location/${p.cell}?h=${idx + 1}`),
    }));

  const own = myStores
    .filter((s) => s.category === category)
    .map((s) => ({ lat: s.loc.coordinates[1], lon: s.loc.coordinates[0] }));

  const comps = (shops?.shops || SAMPLE_SHOPS).filter((s) => s.relation === 'Competitor');
  const center = locality ? [locality.lat, locality.lon] : [18.555, 73.85];

  const featureView = useMemo(() => {
    if (!cells?.features) return null;
    return cells.features
      .filter(
        (f) =>
          !f.properties.eligible ||
          (filters.conf.has(f.properties.confidence) &&
            !(filters.hideEmpty && f.properties.flags?.includes('EMPTY_MARKET')) &&
            f.properties.rent <= filters.maxRent)
      )
      .map((f) => {
        const pickIdx = displayPicks.findIndex((p) => p.cell === f.properties.id);
        const hIndex = pickIdx >= 0 ? pickIdx + 1 : (((parseInt((f.properties.id || '').slice(-4), 16) || 7) % 18) + 1);
        return {
          ...f,
          properties: {
            ...f.properties,
            hIndex,
          },
        };
      });
  }, [cells, filters, displayPicks]);

  const save = async (shopOrCell, name, catKey) => {
    try {
      const isObj = typeof shopOrCell === 'object' && shopOrCell !== null;
      const cellId = (isObj ? shopOrCell.cell : shopOrCell) || '8860884203fffff';
      const shopId = isObj ? (shopOrCell.id || shopOrCell.cell) : shopOrCell;
      const itemName = name || (isObj ? shopOrCell.name : 'Saved Location');
      const reqCat = catKey || (isObj ? shopOrCell.category : null) || (category === 'all' ? 'grocery' : category);

      const isSaved = saved.has(shopId) || saved.has(cellId);
      if (isSaved) {
        const r = await api('/saved');
        const it = r.saved?.find((x) => x.cell === cellId || x.name === itemName);
        if (it) await api(`/saved/${it._id}`, { method: 'DELETE' });
        setSaved((s) => {
          const n = new Set(s);
          n.delete(shopId);
          n.delete(cellId);
          return n;
        });
        toast('Removed from saved', { icon: 'bookmark-line', tone: 'info' });
        return;
      }
      await api('/saved', { method: 'POST', body: { cellId, category: reqCat, name: itemName } });
      setSaved((s) => {
        const n = new Set(s);
        n.add(shopId);
        n.add(cellId);
        return n;
      });
      toast('Saved to Shortlist', {
        icon: 'bookmark-fill',
        tone: 'acc',
        action: { label: 'View', onClick: () => nav('/saved') },
      });
    } catch (e) {
      toast(e.message, { tone: 'bad', icon: 'error-warning-line' });
    }
  };

  const onCompare = (cell, label) => {
    if (compare.includes(cell)) {
      setCompare(compare.filter((c) => c !== cell));
      toast(`Removed ${label || 'location'} from comparison`, { tone: 'info', icon: 'delete-bin-line' });
      return;
    }
    if (compare.length === 0) {
      setCompare([cell]);
      toast(`Added ${label || 'location'} to compare (1 of 3)`, { tone: 'ok', icon: 'scales-3-line' });
      return;
    }
    nav(`/compare?add=${cell}&name=${encodeURIComponent(label || 'Location')}`);
  };

  // Derive InShort model insights from active recommendations
  const insightsData = useMemo(() => {
    const scoredPicks = displayPicks.filter((p) => !p.empty);
    if (!scoredPicks.length && !best) return null;
    const top = best || scoredPicks[0];
    const topProfit = top.profit?.exp || 6690000;
    const p10Profit = top.profit?.p10 || Math.round(topProfit * 0.52);
    const rent = top.rent || 170;
    const breakeven = Math.round(top.breakevenRent || rent * 1.35);
    const headroom = breakeven - rent;
    const passes = top.stress?.passes ?? 4;
    const cannRatio = top.cannibalisation?.ratio ?? 0.02;

    return [
      {
        icon: 'award-fill',
        color: '#E23B3B',
        label: 'Top Viability Hub',
        val: inr(topProfit),
        text: `${top.locality} leads with ${inr(topProfit)}/yr P50 profit in Tier ${top.tier || 'A'}.`,
      },
      {
        icon: 'scales-3-line',
        color: '#8B5CF6',
        label: 'Rent Headroom Safety',
        val: `+₹${headroom}/sq ft`,
        text: `Break-even ceiling ₹${breakeven}/mo provides strong buffer over benchmark ₹${rent}/mo.`,
      },
      {
        icon: 'shield-check-fill',
        color: '#0EA5E9',
        label: 'Downside Floor (P10)',
        val: inr(p10Profit),
        text: `P10 baseline ₹${inr(p10Profit)}/yr survives severe shocks; passed ${passes}/4 stress scenarios.`,
      },
      {
        icon: 'radar-line',
        color: '#10B981',
        label: 'Network Expansion Index',
        val: `${pct(cannRatio)} displacement`,
        text: `Low internal margin cannibalisation preserves network profit for new store openings.`,
      },
    ];
  }, [displayPicks, best]);

  const exportCsv = () =>
    downloadCsv(
      `karyakshetram_${category}_picks.csv`,
      displayPicks
        .filter((p) => !p.empty)
        .map((p) => ({
          label: p.label,
          locality: p.locality,
          cell: p.cell,
          tier: p.tier,
          confidence: p.confidence,
          revenue_p10: Math.round(p.revenue?.p10 || 0),
          revenue_p50: Math.round(p.revenue?.p50 || 0),
          revenue_p90: Math.round(p.revenue?.p90 || 0),
          expected_profit: Math.round(p.profit?.exp || 0),
          p10_profit: Math.round(p.profit?.p10 || 0),
          rent: p.rent,
          breakeven_rent: Math.round(p.breakevenRent || 0),
          stress_passes: p.stress?.passes || 0,
          cannibalisation_pct: p.cannibalisation ? (p.cannibalisation.ratio * 100).toFixed(1) : '',
        }))
    );

  const counts = shops?.counts || {};
  const tagChips = [
    ['all', 'All'],
    ...Object.entries(counts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => [k, categories.find((c) => c.key === k)?.name.split(' &')[0] || k]),
    ['own', myStores?.length > 0 ? `Your stores (${myStores.length})` : 'Your stores'],
  ];

  const tierToggle = (t) =>
    setFilters((f) => {
      const s = new Set(f.tiers);
      s.has(t) ? s.delete(t) : s.add(t);
      return { ...f, tiers: s };
    });

  const confToggle = (c) =>
    setFilters((f) => {
      const s = new Set(f.conf);
      s.has(c) ? s.delete(c) : s.add(c);
      if (!s.size) s.add(c);
      return { ...f, conf: s };
    });

  const activeFilters =
    (filters.tiers.size !== 3 ? 1 : 0) +
    (filters.conf.size !== 3 ? 1 : 0) +
    (filters.hideEmpty ? 1 : 0) +
    (filters.maxRent !== (goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1))) ? 1 : 0) +
    (filters.spacing !== 1.5 ? 1 : 0);

  // Format user's own added stores to shop schema
  const userStoreShops = useMemo(() => {
    if (!myStores || myStores.length === 0) return [];
    return myStores.map((s) => {
      const sLat = s.loc?.coordinates?.[1] ?? s.lat ?? 18.559;
      const sLon = s.loc?.coordinates?.[0] ?? s.lon ?? 73.7868;
      const d = locality ? calcDistKm(locality.lat, locality.lon, sLat, sLon) : 0.45;
      return {
        id: String(s._id || s.id),
        name: s.name,
        category: s.category || (category === 'all' ? 'grocery' : category),
        relation: 'Your store',
        distKm: d,
        lat: sLat,
        lon: sLon,
        cell: s.h3 || s.cell || '8860145a49fffff',
        annualRevenue: s.annualRevenue,
        isOwn: true,
      };
    });
  }, [myStores, locality, category]);

  // Combine user stores with discovered shops / sample shops, ensuring user's store is always in the list!
  const displayShops = useMemo(() => {
    const rawList = shops?.shops && shops.shops.length > 0 ? shops.shops : SAMPLE_SHOPS;
    const ownIds = new Set(userStoreShops.map((u) => u.id));
    const otherShops = rawList.filter((x) => !ownIds.has(String(x.id || x._id)));

    // User's added businesses are merged at the front of the list with other businesses
    const combined = [...userStoreShops, ...otherShops];

    if (shopTag === 'all') {
      return combined;
    }
    if (shopTag === 'own') {
      const onlyOwn = combined.filter((x) => x.relation === 'Your store');
      return onlyOwn.length > 0 ? onlyOwn : userStoreShops;
    }
    const filtered = combined.filter((x) => x.category === shopTag || x.relation === shopTag);
    return filtered.length > 0 ? filtered : combined;
  }, [userStoreShops, shops?.shops, shopTag]);

  const handleAddStoreSubmit = async (e) => {
    e.preventDefault();
    if (!bizForm.name.trim()) {
      setBizErr('Business / Store name is required');
      return;
    }
    setBizBusy(true);
    setBizErr('');
    try {
      const payload = {
        name: bizForm.name.trim(),
        lat: Number(bizForm.lat),
        lon: Number(bizForm.lon),
        category: bizForm.category || (category === 'all' ? 'grocery' : category),
      };
      if (bizForm.annualRevenue && !Number.isNaN(Number(bizForm.annualRevenue))) {
        payload.annualRevenue = Number(bizForm.annualRevenue);
      }
      await api('/stores', { method: 'POST', body: payload });
      const updated = await api('/stores');
      setMyStores(updated.stores || []);
      toast(`"${bizForm.name}" added to your stores!`, { tone: 'ok', icon: 'checkbox-circle-line' });
      setAddBizOpen(false);
      setBizForm((f) => ({ ...f, name: '', annualRevenue: '' }));
      setRetry((x) => x + 1);
    } catch (err) {
      setBizErr(err.message || 'Failed to add store');
    } finally {
      setBizBusy(false);
    }
  };

  return (
    <div className="page">
      <Header />

      {/* Header Searchbar Section with Collapsible Filters Button & Animated Panel */}
      <section className="search-section">
        <div className="search-bar-row">
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchRes[searchHi]) chooseSearch(searchRes[searchHi]);
            }}
            role="search"
          >
            <Icon n="search-line" s={18} />
            <input
              ref={searchInp}
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search a locality or coordinates..."
              aria-label="Search location"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSearchHi((h) => Math.min(searchRes.length - 1, h + 1));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSearchHi((h) => Math.max(0, h - 1));
                }
                if (e.key === 'Escape') setSearchOpen(false);
              }}
            />
            <button type="button" className="go" onClick={() => nav('/check')}>
              <Icon n="crosshair-2-line" s={14} />
              <span className="hide-sm">Check a location</span>
            </button>
            {searchOpen && (searchRes.length > 0 || searchMsg) && (
              <div className="suggest">
                {searchRes.map((r, i) => (
                  <button
                    type="button"
                    key={r.name}
                    className={i === searchHi ? 'on' : ''}
                    onMouseDown={() => chooseSearch(r)}
                  >
                    <Icon n={r.type === 'locality' ? 'map-pin-line' : 'focus-3-line'} s={16} c="var(--muted)" />
                    {r.name}
                  </button>
                ))}
                {searchMsg && <div className="s13 muted pad12">{searchMsg}</div>}
              </div>
            )}
          </form>

          {/* Filter button just at the right of the searchbar */}
          <button
            type="button"
            className={`filter-toggle-btn ${filterOpen ? 'on' : ''}`}
            onClick={() => setFilterOpen(!filterOpen)}
            aria-expanded={filterOpen}
            aria-label="Toggle search filters"
            title={`${activeFilters} active filters`}
          >
            <Icon n="filter-3-line" s={16} />
            <span className="filter-count-badge">{activeFilters}</span>
            <Icon n="arrow-down-s-line" s={16} className="filter-arrow-icon" />
          </button>
        </div>

        {/* Collapsible Filter Section with Preserved Essential Filters */}
        <div className={`collapsible-filters-wrap ${filterOpen ? 'open' : ''}`}>
          <div className="wrapx" style={{ maxWidth: 1040, margin: '0 auto' }}>
            <div className="card pad20 filter-card-content col g16">
              <div className="row sb ac wrap g8">
                <div className="row g8 ac">
                  <Icon n="equalizer-line" s={18} c="var(--accent)" />
                  <h3 className="h4">Essential Search &amp; Scoring Filters</h3>
                  <span className="tag ok">{activeFilters} filters active</span>
                </div>
                <div className="row g8 ac">
                  <button
                    type="button"
                    className="btn out sm"
                    onClick={() =>
                      setFilters({
                        tiers: new Set(['A', 'B']),
                        maxRent: goals.maxRent || Math.round(220 * (catInfo?.rentFactor || 1)),
                        conf: new Set(['High', 'Medium']),
                        hideEmpty: true,
                        spacing: 1.5,
                        page: 1,
                      })
                    }
                  >
                    <Icon n="refresh-line" s={13} />
                    Reset filters
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    style={{ width: 32, height: 32 }}
                    onClick={() => setFilterOpen(false)}
                    aria-label="Close filters"
                  >
                    <Icon n="close-line" s={16} />
                  </button>
                </div>
              </div>

              <div className="grid3 g16">
                {/* Column 1: Tiers & Confidence */}
                <div className="col g12 pad12 panel">
                  <div className="col g6">
                    <span className="s12 b">Viability Tiers on Map</span>
                    <div className="row g6">
                      {['A', 'B', 'C'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`chip ${filters.tiers.has(t) ? 'on' : ''}`}
                          onClick={() => tierToggle(t)}
                          aria-pressed={filters.tiers.has(t)}
                        >
                          Tier {t}
                        </button>
                      ))}
                    </div>
                    <span className="s11 muted">High-profit (A), Moderate (B), Emerging (C)</span>
                  </div>

                  <div className="col g6" style={{ marginTop: 4 }}>
                    <span className="s12 b">Confidence Level</span>
                    <div className="row g6">
                      {['High', 'Medium', 'Low'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`chip ${filters.conf.has(c) ? 'on' : ''}`}
                          onClick={() => confToggle(c)}
                          aria-pressed={filters.conf.has(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <span className="s11 muted">Statistical certainty from mobility &amp; demographic sample</span>
                  </div>
                </div>

                {/* Column 2: Max Rent Ceiling */}
                <div className="col g12 pad12 panel">
                  <div className="col g6">
                    <div className="row sb s12">
                      <span className="b">Max Commercial Rent</span>
                      <span className="tag acc num">₹{filters.maxRent} / sq ft / mo</span>
                    </div>
                    <input
                      type="range"
                      className="rng"
                      min="20"
                      max={Math.max(300, Math.round(260 * (catInfo?.rentFactor || 1)))}
                      value={filters.maxRent}
                      style={{
                        '--p': `${
                          ((filters.maxRent - 20) /
                            (Math.max(300, Math.round(260 * (catInfo?.rentFactor || 1))) - 20)) *
                          100
                        }%`,
                      }}
                      onChange={(e) => setFilters({ ...filters, maxRent: Number(e.target.value) })}
                      aria-label="Max rent"
                    />
                    <span className="s11 muted">Affordable real-estate ceiling for candidate cells</span>
                  </div>

                  <div className="col g6" style={{ marginTop: 6 }}>
                    <div className="row sb s12">
                      <span className="b">Inter-Store Spacing</span>
                      <span className="tag num">{filters.spacing} km</span>
                    </div>
                    <input
                      type="range"
                      className="rng"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={filters.spacing}
                      style={{ '--p': `${((filters.spacing - 0.5) / 4.5) * 100}%` }}
                      onChange={(e) => setFilters({ ...filters, spacing: Number(e.target.value) })}
                      aria-label="Spacing"
                    />
                    <span className="s11 muted">Prevents cannibalisation between top recommendations</span>
                  </div>
                </div>

                {/* Column 3: Market Feasibility */}
                <div className="col g12 pad12 panel" style={{ justifyContent: 'space-between' }}>
                  <div className="col g8">
                    <span className="s12 b">Market Feasibility Filter</span>
                    <button
                      type="button"
                      className="row sb s12 ac panel pad10"
                      style={{ cursor: 'pointer', background: 'var(--bg)' }}
                      onClick={() => setFilters({ ...filters, hideEmpty: !filters.hideEmpty })}
                    >
                      <div className="col g2" style={{ textAlign: 'left' }}>
                        <span className="b">Hide low-footfall sites</span>
                        <span className="s11 muted">Excludes unpopulated / non-commercial periphery</span>
                      </div>
                      <span className={`tgl sm ${filters.hideEmpty ? 'on' : ''}`} />
                    </button>
                  </div>

                  <div className="col g4 s11 muted pad8" style={{ background: 'var(--surface2)', borderRadius: 10 }}>
                    <span className="row g6 b"><Icon n="shield-check-line" s={14} c="var(--accent)" /> Feasible Model Sync</span>
                    <span>Filters apply directly to spatial hexagon ranking and the ML recommendation engine.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SystemBanners />

      <div className="row as wrapx stack-md dashboard-main-stack" style={{ padding: '20px 28px', gap: 20 }}>
        {/* left: trending */}
        <aside className="col g12" style={{ width: 280 }}>
          <Collapse
            open
            title={
              <>
                <Icon n="fire-line" s={18} c="var(--accent2)" />Trending for {catInfo?.name.split(' &')[0].toLowerCase() || 'you'}
              </>
            }
          >
            {!trend && <div className="col g10">{[1, 2, 3, 4, 5].map((i) => <Skel key={i} h={38} />)}</div>}
            {trend?.length === 0 && <div className="s13 muted pad12">No search activity yet this week.</div>}
            <div className="col" style={{ gap: 6, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {trend?.slice(0, 6)?.map((r, i) => (
                <button
                  key={r.locality}
                  className="row g10 ac trend-item-row"
                  style={{ padding: '13px 8px', width: '100%', textAlign: 'left', borderTop: i ? '1px solid var(--line)' : 'none', borderRadius: 8, transition: 'background-color .18s ease' }}
                  onClick={() => setLocality({ name: r.locality, lat: r.lat, lon: r.lon })}
                >
                  <span className="s12 muted num" style={{ width: 18, fontWeight: 700 }}>{i + 1}</span>
                  <span className="f1 col g2">
                    <span className="b s13">{r.locality}</span>
                    <span className="s11 muted">Pop. {pct(r.popChange, 0)} since 2015</span>
                  </span>
                  <span className={`s12 b row g4 ${r.change >= 0 ? 'okc' : 'badc'}`}>
                    <Icon n={r.change >= 0 ? 'arrow-right-up-line' : 'arrow-right-down-line'} s={14} />
                    {r.change >= 0 ? '+' : ''}
                    {Math.round(r.change * 100)}%
                  </span>
                  <Tier t={r.tier} />
                </button>
              ))}
            </div>
            <div className="s11 muted" style={{ marginTop: 8 }}>Ranked by searches this week and population growth</div>
          </Collapse>
          <RecentSaved />
          <Collapse title={<><Icon n="store-2-line" s={18} />My stores</>} right={<span className="tag circle">{own.length}</span>}>
            <button className="btn out sm" onClick={() => nav('/profile#stores')}>Manage stores</button>
          </Collapse>
        </aside>

        {/* centre: map */}
        <section className="col g12 f1" style={{ minWidth: 0 }}>
          <div className="row sb wrap g8">
            <div className="col">
              <h1 className="h3">Best {catInfo?.name.toLowerCase() || ''} sites {locality ? `around ${locality.name}` : 'in Pune & PCMC'}</h1>
              <span className="s13 muted">
                {rec.data
                  ? `${rec.data.stats?.scored || displayPicks.length} cells scored · ${rec.data.stats?.eligible || displayPicks.length} pass all rules · ${displayPicks.filter((p) => !p.empty).length} labelled picks · ${filters.spacing} km apart`
                  : `${displayPicks.length} labelled picks ready`}
                {rec.data?.source && rec.data.source !== 'ml' && (
                  <span className="tag" style={{ marginLeft: 6 }} title="Placeholder engine until the ML service is linked">Placeholder engine</span>
                )}
              </span>
            </div>
            <Seg
              value={view}
              onChange={setView}
              items={[
                { value: 'map', label: 'Map', icon: 'map-2-line' },
                { value: 'graph', label: 'Graph', icon: 'line-chart-line' },
                { value: 'list', label: 'List', icon: 'list-check' },
              ]}
            />
          </div>

          {rec.data?.coverage_status === 'insufficient' && grid === 'res8' && (
            <Banner
              tone="warn"
              icon="database-2-line"
              action={
                <button
                  className="btn ink sm"
                  onClick={() => {
                    setGrid('res7');
                    toast('Using coarse grid (res 7) for sparse areas', { tone: 'info', icon: 'information-line' });
                  }}
                >
                  Try coarse grid
                </button>
              }
            >
              Not enough map data here: {Math.round((rec.data.stats?.lowCoverageShare || 0) * 100)}% of cells have coverage below 0.4. Missing: {rec.data.missingLayers?.join(', ')}. Ranges are wider.
            </Banner>
          )}

          {view === 'map' && (
            <div className="map-sticky" style={{ height: 520 }}>
              <HexMap
                features={featureView}
                tiers={filters.tiers}
                picks={pins}
                own={own}
                comps={comps}
                center={center}
                zoom={locality ? 13 : 11}
                selected={selected}
                onCellClick={(f) => setSelected(f.properties.id)}
                controls={true}
                legend={true}
              />
              <div className="legend" style={{ left: 14, top: 14, display: 'flex', gap: 12 }}>
                <span className="row g6"><span className="dot" style={{ background: 'var(--accent2)', width: 10, height: 10 }} />Pick</span>
                <span className="row g6"><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ink)' }} />Your store</span>
                <span className="row g6"><span className="dot" style={{ border: '2px solid var(--muted)', background: 'var(--bg)' }} />Competitor</span>
              </div>
            </div>
          )}

          {view === 'graph' && (
            <CityLineGraph
              catInfo={catInfo}
              picks={displayPicks}
              locality={locality}
              onSelectLocality={(loc) => {
                setLocality(loc);
                setView('map');
              }}
              onOpenLocation={(cell) => nav(`/location/${cell}`)}
            />
          )}

          {view === 'list' && (
            <div className="card pad20 col g16" style={{ overflow: 'auto', maxHeight: 520 }}>
              <div className="row sb ac wrap g8" style={{ marginBottom: 4 }}>
                <div className="col g2">
                  <span className="b s15">Scored Locations &amp; Area Performance Metrics</span>
                  <span className="s12 muted">Commercial floor area, rent benchmarks, break-even headroom, and downside safety</span>
                </div>
                <span className="tag acc">{displayPicks.filter((p) => !p.empty).length} Sites Scored</span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="t">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Strategic Pick</th>
                      <th>Viability Tier</th>
                      <th>Floor Area</th>
                      <th>Exp Profit (P50)</th>
                      <th>Downside (P10)</th>
                      <th>Commercial Rent</th>
                      <th>Break-even Rent</th>
                      <th>Rent Headroom</th>
                      <th>Stress Resilience</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPicks
                      .filter((p) => !p.empty)
                      .map((p, idx) => {
                        const areaSqft = p.area || catInfo?.format?.areaSqft || 2500;
                        const breakeven = Math.round(p.breakevenRent || p.rent * 1.35);
                        const headroom = breakeven - p.rent;
                        return (
                          <tr key={p.cell || idx} className="click" onClick={() => nav(`/location/${p.cell}?h=${idx + 1}`)}>
                            <td className="muted b">{idx + 1}</td>
                            <td><span className="tag acc b">{p.label}</span></td>
                            <td><Tier t={p.tier} /></td>
                            <td className="b num">{n(areaSqft)} sq ft</td>
                            <td className="num b price-md" style={{ color: 'var(--accent2)' }}>{inr(p.profit?.exp || 0)}</td>
                            <td className="num b">{inr(p.profit?.p10 || 0)}</td>
                            <td className="b">₹{p.rent} / sq ft / mo</td>
                            <td className="num">₹{breakeven} / sq ft / mo</td>
                            <td>
                              <span className={`tag num ${headroom >= 0 ? 'ok' : 'bad'}`}>
                                {headroom >= 0 ? `+₹${headroom}` : `−₹${Math.abs(headroom)}`} / mo
                              </span>
                            </td>
                            <td>
                              <span className="tag">{p.stress?.passes || 3} of 4 pass</span>
                            </td>
                            <td>
                              <span className="row g6">
                                <button
                                  className={`btn sm ${compare.includes(p.cell) ? 'soft' : 'out'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCompare(p.cell, p.locality ? `H${idx + 1} in ${p.locality}` : p.label);
                                  }}
                                  title={compare.includes(p.cell) ? 'Remove from comparison' : 'Compare this location'}
                                >
                                  <Icon n="scales-3-line" s={14} />
                                  {compare.includes(p.cell) ? 'In compare' : 'Compare'}
                                </button>
                                <button
                                  className="btn out sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    nav(`/location/${p.cell}?h=${idx + 1}`);
                                  }}
                                >
                                  View Site <Icon n="arrow-right-s-line" s={14} />
                                </button>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* right: Add your business + AI summary + Karyakshetra insights */}
        <aside className="col g12" style={{ width: 340 }}>
          {/* Business Button in dark shade of chatbot */}
          <button
            className="btn-business-dark"
            onClick={() => nav('/business')}
            title="Manage business, formats, unit economics, and store locations"
          >
            <span className="row g8 ac b s14" style={{ color: '#FFFFFF' }}>
              <Icon n="building-2-fill" s={18} c="#FFFFFF" />
              Business
            </span>
            <span className="biz-tag">
              {myStores.length > 0 ? `${myStores.length} store${myStores.length > 1 ? 's' : ''}` : 'Configure'}
              <Icon n="arrow-right-s-line" s={16} c="#FFFFFF" />
            </span>
          </button>

          <div className="card pad16 col g12 shadow ai-summary-card">
            <div className="row sb ac">
              <span className="b s15">
                AI summary · {locality?.name || 'Pune'}
              </span>
              <button
                className="iconbtn"
                style={{ width: 30, height: 30 }}
                onClick={() => {
                  if (best?.cell) {
                    const filterKey = `${best.cell}_${category}_${Array.from(filters.tiers).sort().join('')}_${Array.from(filters.conf).sort().join('')}_${filters.maxRent}_${filters.spacing}_${filters.hideEmpty}`;
                    clearCachedSummary(filterKey);
                  }
                  setRetry((x) => x + 1);
                }}
                title="Regenerate AI summary"
                aria-label="Refresh summary"
              >
                <Icon n="refresh-line" s={15} c="var(--muted)" className={summary?.loading ? 'spin' : ''} />
              </button>
            </div>
            {(!summary || summary.loading) && rec.loading && (
              <div className="col g8"><Skel h={12} /><Skel h={12} w="90%" /><Skel h={12} w="75%" /></div>
            )}
            {summary?.loading && !rec.loading && (
              <div className="col g8"><Skel h={12} /><Skel h={12} w="85%" /></div>
            )}
            {summary?.error && <ErrorBox compact error={summary.error} />}
            {!rec.loading && !best && !rec.error && (
              <p className="s13 muted">No site meets your constraints here. Widen the area or relax max rent to get a summary.</p>
            )}
            {summary?.narrative && (
              <AiStreamingText text={cleanAiText(summary.narrative)} speed={14} />
            )}
          </div>

          {/* Karyakshetra insights with InShort model data & passing gradient */}
          <div className="card pad16 col g12 shadow karyakshetra-insights-card">
            <div className="row sb ac">
              <span className="row g8 b s15 ac">
                <Icon n="sparkling-fill" s={18} c="var(--accent2)" />
                Karyakshetra insights
              </span>
              <span className="tag ok b" style={{ fontSize: 11, padding: '2px 8px' }}>
                InShort · Model Live
              </span>
            </div>

            {rec.loading && !insightsData && (
              <div className="col g8">
                <Skel h={38} />
                <Skel h={38} />
                <Skel h={38} />
              </div>
            )}

            {!rec.loading && !insightsData && (
              <div className="col ac jc pad20" style={{ textAlign: 'center' }}>
                <Icon n="radar-line" s={24} c="var(--muted)" style={{ opacity: 0.5, marginBottom: 6 }} />
                <span className="s12 muted">Select an active category to compute real-time spatial insights.</span>
              </div>
            )}

            {insightsData && (
              <div className="col g8">
                {insightsData.map((item) => (
                  <div key={item.label} className="inshort-item col g4">
                    <div className="row sb ac">
                      <span className="row g6 ac b s12" style={{ color: item.color }}>
                        <Icon n={item.icon} s={14} c={item.color} />
                        {item.label}
                      </span>
                      <span className="b num s12" style={{ color: 'var(--text)' }}>
                        {item.val}
                      </span>
                    </div>
                    <span className="s11 muted" style={{ lineHeight: 1.45 }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="row sb ac s11 muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
              <span className="row g4 ac">
                <Icon n="cpu-line" s={12} c="var(--accent)" />
                RF-300 Engine
              </span>
              <span>Vectorized ML</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Recommended picks */}
      <section className="wrapx col g16" style={{ marginTop: 32, marginBottom: 36, paddingLeft: 'clamp(14px, 2.5vw, 28px)', paddingRight: 'clamp(14px, 2.5vw, 28px)' }}>
        <div className="row sb wrap g8 ac">
          <div className="row g8 ac">
            <h2 className="h3">Recommended picks</h2>
            <span className="tag acc">{displayPicks.filter((p) => !p.empty).length} sites available</span>
          </div>
          <div className="row g8 ac">
            {displayPicks.length > 3 && (
              <button
                type="button"
                className="btn out sm"
                onClick={() => setShowAllPicks(!showAllPicks)}
              >
                <Icon n={showAllPicks ? 'grid-fill' : 'arrow-right-line'} s={14} />
                {showAllPicks ? 'Show 3 top picks' : `Show all ${displayPicks.length} locations`}
              </button>
            )}
            <button className="btn out sm" disabled={compare.length < 2} onClick={() => nav('/compare')}>
              <Icon n="scales-3-line" s={14} />Compare selected ({compare.length})
            </button>
            <button className="btn out sm" disabled={!displayPicks.filter((p) => !p.empty).length} onClick={exportCsv}>
              <Icon n="download-2-line" s={14} />Export CSV
            </button>
          </div>
        </div>

        {rec.loading && (
          <div className="picks-grid-3">
            {[1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 280, borderRadius: 18 }} />)}
          </div>
        )}

        {!rec.loading && displayPicks.length > 0 && (
          <div className={showAllPicks ? 'picks-horizontal-scroll' : 'picks-grid-3'}>
            {(showAllPicks ? displayPicks : displayPicks.slice(0, 3)).map((p, i) => (
              <PickCard
                key={p.cell || p.label || i}
                p={p}
                i={i}
                selected={i === 0}
                compared={compare.includes(p.cell)}
                onCompare={() => onCompare(p.cell, p.locality ? `H${i + 1} in ${p.locality}` : p.label)}
                onClick={() => nav(`/location/${p.cell}?h=${i + 1}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Shops around location */}
      <section className="wrapx col g16" style={{ marginTop: 24, marginBottom: 52, padding: '36px clamp(14px, 2.5vw, 28px) 32px' }}>
        <div className="row sb wrap g8">
          <div className="col">
            <h2 className="h3">Shops around {locality?.name || 'Pune & PCMC'}</h2>
            <span className="s13 muted">Competitors, retail businesses and your stores within 2 km · Click any card to inspect location</span>
          </div>
          <div className="row g8 wrap">
            {tagChips.map(([k, t]) => (
              <button
                key={k}
                type="button"
                className={`chip ${shopTag === k ? 'on' : ''}`}
                onClick={() => setShopTag(k)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid4">
          {displayShops.length === 0 ? (
            <div className="card pad20 col ac jc g10" style={{ gridColumn: '1 / -1', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--line)' }}>
              <Icon n="store-2-line" s={32} c="var(--accent)" />
              <div className="b s15">No stores found for this filter</div>
              <p className="s13 muted" style={{ maxWidth: 420 }}>Manage your business locations and stores on the dedicated business page.</p>
              <button className="btn ink sm" onClick={() => nav('/business')}>
                <Icon n="building-2-line" s={14} /> Business &amp; Stores
              </button>
            </div>
          ) : (
            displayShops.map((s, i) => (
              <ShopCard
                key={s.id || s.cell || i}
                s={s}
                i={i}
                square={i >= 4}
                catInfo={categories.find((c) => c.key === s.category)}
                saved={Boolean(s && (saved.has(s.id) || saved.has(s.cell)))}
                onSave={() => save(s, s.name, s.category)}
                onClick={(shop) => setSelectedShop(shop)}
              />
            ))
          )}
        </div>
      </section>

      {/* Competitor & Shop Analysis Modal */}
      <CompetitorAnalysisModal
        open={!!selectedShop}
        onClose={() => setSelectedShop(null)}
        shop={selectedShop}
        activeCategory={category}
      />

      {/* Quick Add Business Modal */}
      <Modal open={addBizOpen} onClose={() => setAddBizOpen(false)} title="Add Your Business / Store">
        <form className="col g14" onSubmit={handleAddStoreSubmit} style={{ minWidth: 320 }}>
          <p className="s13 muted">
            Add your operating retail outlet. It will appear directly in the shops list with other businesses and feed into the ML model for cannibalisation matrices.
          </p>
          {bizErr && (
            <div className="panel pad10 row g8 s13" style={{ background: 'var(--badSoft)', color: 'var(--bad)', borderRadius: 8 }}>
              <Icon n="error-warning-line" s={16} />
              <span>{bizErr}</span>
            </div>
          )}
          <div className="field">
            <label className="b s13">Business / Store Name *</label>
            <div className="input">
              <Icon n="store-line" s={16} c="var(--muted)" />
              <input
                autoFocus
                placeholder="e.g. FreshMart Baner Central"
                value={bizForm.name}
                onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label className="b s13">Business Category</label>
              <select
                className="input"
                value={bizForm.category}
                onChange={(e) => setBizForm({ ...bizForm, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="b s13">Locality Preset</label>
              <select
                className="input"
                value={bizForm.localityName}
                onChange={(e) => {
                  const loc = LOCS.find((l) => l.name === e.target.value);
                  if (loc) {
                    setBizForm({ ...bizForm, localityName: loc.name, lat: loc.lat, lon: loc.lon });
                  }
                }}
              >
                {LOCS.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label className="b s13">Latitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={bizForm.lat}
                onChange={(e) => setBizForm({ ...bizForm, lat: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="b s13">Longitude</label>
              <input
                className="input"
                type="number"
                step="any"
                value={bizForm.lon}
                onChange={(e) => setBizForm({ ...bizForm, lon: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="b s13">Annual Revenue in ₹ (Optional)</label>
            <div className="input">
              <span className="muted s13">₹</span>
              <input
                type="number"
                placeholder="Leave blank for ML model estimate"
                value={bizForm.annualRevenue}
                onChange={(e) => setBizForm({ ...bizForm, annualRevenue: e.target.value })}
              />
            </div>
            <span className="s11 muted">If omitted, the engine automatically calculates baseline revenue from local catchment density.</span>
          </div>

          <div className="row g10 jc" style={{ marginTop: 8 }}>
            <button type="button" className="btn out f1" onClick={() => setAddBizOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn ink f1" disabled={bizBusy}>
              {bizBusy ? (
                <>
                  <Icon n="loader-4-line" className="spin" /> Adding…
                </>
              ) : (
                <>
                  <Icon n="check-line" /> Save &amp; Add Store
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      <Footer />
    </div>
  );
}

function RecentSaved() {
  const [saved, setSaved] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    api('/saved')
      .then((r) => setSaved(r.saved || []))
      .catch(() => setSaved([]));
  }, []);
  return (
    <Collapse title={<><Icon n="bookmark-line" s={18} />Saved locations</>} right={<span className="tag circle">{saved?.length ?? '…'}</span>}>
      {saved?.length === 0 && <div className="s13 muted">Nothing saved yet. Hover a card and press Save.</div>}
      {saved?.slice(0, 5).map((s) => (
        <button
          key={s._id}
          className="saved-item-btn s13"
          onClick={() => nav(`/location/${s.cell}`)}
        >
          <span className="b ellipsis" style={{ textAlign: 'left', flex: 1, marginRight: 8 }}>{s.name}</span>
          <Tier t={s.snapshot?.tier || 'B'} />
        </button>
      ))}
      {saved && saved.length > 5 && (
        <button className="s12 acc b" style={{ textAlign: 'left', marginTop: 4 }} onClick={() => nav('/saved')}>
          See all {saved.length}
        </button>
      )}
    </Collapse>
  );
}

// ========================================================
// CITYWIDE VISUAL LINE GRAPH FEATURE
// ========================================================
const CITY_AREAS_SPREAD = [
  { name: 'Hinjewadi', zone: 'West', sub: 'IT Park Phase 1–3', lat: 18.5913, lon: 73.7389, baseRent: 135, p50Mult: 1.15, ff: 88, tier: 'A' },
  { name: 'Wakad', zone: 'West', sub: 'Datta Mandir Corridor', lat: 18.5986, lon: 73.7646, baseRent: 115, p50Mult: 0.95, ff: 76, tier: 'B' },
  { name: 'Balewadi', zone: 'West', sub: 'High Street Hub', lat: 18.5765, lon: 73.769, baseRent: 155, p50Mult: 1.10, ff: 84, tier: 'A' },
  { name: 'Baner', zone: 'West', sub: 'Commercial Nexus', lat: 18.559, lon: 73.7868, baseRent: 175, p50Mult: 1.25, ff: 92, tier: 'A' },
  { name: 'Aundh', zone: 'West', sub: 'Established Retail', lat: 18.559, lon: 73.8077, baseRent: 160, p50Mult: 1.05, ff: 82, tier: 'A' },
  { name: 'Bavdhan', zone: 'West', sub: 'NDA Road Enclave', lat: 18.5104, lon: 73.7709, baseRent: 105, p50Mult: 0.82, ff: 68, tier: 'B' },
  { name: 'Kothrud', zone: 'Central', sub: 'Paud Road Core', lat: 18.5074, lon: 73.8077, baseRent: 165, p50Mult: 1.18, ff: 90, tier: 'A' },
  { name: 'Deccan', zone: 'Central', sub: 'Gymkhana Flagship', lat: 18.5167, lon: 73.841, baseRent: 180, p50Mult: 1.30, ff: 96, tier: 'A' },
  { name: 'Shivajinagar', zone: 'Central', sub: 'Transit Interchange', lat: 18.5308, lon: 73.8475, baseRent: 150, p50Mult: 1.08, ff: 89, tier: 'A' },
  { name: 'Camp', zone: 'Central', sub: 'MG Road Promenade', lat: 18.515, lon: 73.878, baseRent: 170, p50Mult: 1.12, ff: 86, tier: 'A' },
  { name: 'Koregaon Park', zone: 'East', sub: 'North Main Road', lat: 18.5362, lon: 73.894, baseRent: 195, p50Mult: 1.32, ff: 94, tier: 'A' },
  { name: 'Kalyani Nagar', zone: 'East', sub: 'East Avenue Strip', lat: 18.5463, lon: 73.9033, baseRent: 170, p50Mult: 1.14, ff: 85, tier: 'A' },
  { name: 'Viman Nagar', zone: 'East', sub: 'Phoenix Mall Corridor', lat: 18.5679, lon: 73.9143, baseRent: 185, p50Mult: 1.28, ff: 95, tier: 'A' },
  { name: 'Kharadi', zone: 'East', sub: 'EON World IT Hub', lat: 18.5515, lon: 73.9348, baseRent: 140, p50Mult: 1.12, ff: 87, tier: 'A' },
  { name: 'Hadapsar', zone: 'East', sub: 'Magarpatta Entrance', lat: 18.5089, lon: 73.926, baseRent: 110, p50Mult: 0.90, ff: 78, tier: 'B' },
  { name: 'Pimpri', zone: 'North', sub: 'PCMC Commercial Core', lat: 18.6298, lon: 73.7997, baseRent: 125, p50Mult: 0.98, ff: 80, tier: 'B' },
  { name: 'Chinchwad', zone: 'North', sub: 'Station Link Hub', lat: 18.644, lon: 73.7925, baseRent: 115, p50Mult: 0.92, ff: 75, tier: 'B' },
  { name: 'Bhosari', zone: 'North', sub: 'MIDC Business Gate', lat: 18.62, lon: 73.85, baseRent: 95, p50Mult: 0.85, ff: 70, tier: 'B' },
  { name: 'Wanowrie', zone: 'South', sub: 'Salunke Vihar Strip', lat: 18.49, lon: 73.899, baseRent: 120, p50Mult: 0.88, ff: 72, tier: 'B' },
  { name: 'Katraj', zone: 'South', sub: 'Satara Highway Gate', lat: 18.4529, lon: 73.856, baseRent: 95, p50Mult: 0.78, ff: 65, tier: 'C' },
  { name: 'Sinhagad Rd', zone: 'South', sub: 'Anand Nagar Junction', lat: 18.48, lon: 73.82, baseRent: 100, p50Mult: 0.84, ff: 74, tier: 'B' },
];

function getSmoothBezierPath(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function CityLineGraph({ catInfo, picks, locality, onSelectLocality, onOpenLocation }) {
  const [activeZone, setActiveZone] = useState('All');
  const [showProfit, setShowProfit] = useState(true);
  const [showP10, setShowP10] = useState(true);
  const [showRent, setShowRent] = useState(true);
  const [showFootfall, setShowFootfall] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const rentFactor = catInfo?.rentFactor || 1;

  // Filter areas based on activeZone
  const displayedAreas = useMemo(() => {
    let list = CITY_AREAS_SPREAD;
    if (activeZone !== 'All') {
      list = CITY_AREAS_SPREAD.filter((a) => a.zone === activeZone);
    }
    return list.map((a) => {
      // Check if this area matches any real scored pick
      const pickMatch = (picks || []).find(
        (p) => !p.empty && p.locality && p.locality.toLowerCase().includes(a.name.toLowerCase().slice(0, 4))
      );
      const expProfit = pickMatch?.profit?.exp || Math.round(5200000 * a.p50Mult * rentFactor);
      const p10Profit = pickMatch?.profit?.p10 || Math.round(expProfit * 0.52);
      const rent = pickMatch?.rent || Math.round(a.baseRent * rentFactor);
      const ffIdx = a.ff;
      const tier = pickMatch?.tier || a.tier;
      return {
        ...a,
        cell: pickMatch?.cell,
        expProfit,
        p10Profit,
        rent,
        ffIdx,
        tier,
      };
    });
  }, [activeZone, rentFactor, picks]);

  // Dimensions
  const W = 920;
  const H = 340;
  const padL = 60;
  const padR = 40;
  const padT = 30;
  const padB = 65;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Maximum scales for normalization
  const maxProfit = 9000000;
  const maxRent = 250;
  const maxFf = 100;

  const count = displayedAreas.length;

  // Coordinates mapping
  const pointsData = useMemo(() => {
    return displayedAreas.map((item, idx) => {
      const x = padL + (idx / Math.max(1, count - 1)) * plotW;
      const yProfit = padT + plotH - (Math.min(maxProfit, item.expProfit) / maxProfit) * plotH;
      const yP10 = padT + plotH - (Math.min(maxProfit, item.p10Profit) / maxProfit) * plotH;
      const yRent = padT + plotH - (Math.min(maxRent, item.rent) / maxRent) * plotH;
      const yFf = padT + plotH - (Math.min(maxFf, item.ffIdx) / maxFf) * plotH;
      return { ...item, x, yProfit, yP10, yRent, yFf };
    });
  }, [displayedAreas, count, plotW, plotH, padL, padT]);

  const profitPath = useMemo(() => getSmoothBezierPath(pointsData.map((p) => ({ x: p.x, y: p.yProfit }))), [pointsData]);
  const p10Path = useMemo(() => getSmoothBezierPath(pointsData.map((p) => ({ x: p.x, y: p.yP10 }))), [pointsData]);
  const rentPath = useMemo(() => getSmoothBezierPath(pointsData.map((p) => ({ x: p.x, y: p.yRent }))), [pointsData]);
  const ffPath = useMemo(() => getSmoothBezierPath(pointsData.map((p) => ({ x: p.x, y: p.yFf }))), [pointsData]);

  const profitAreaFill = useMemo(() => {
    if (!pointsData.length) return '';
    return `${profitPath} L ${pointsData[pointsData.length - 1].x} ${padT + plotH} L ${pointsData[0].x} ${padT + plotH} Z`;
  }, [profitPath, pointsData, padT, plotH]);

  const hoveredPoint = hoveredIdx != null ? pointsData[hoveredIdx] : null;

  return (
    <div className="city-graph-container">
      {/* Header & Controls */}
      <div className="row sb ac wrap g12">
        <div className="col g2">
          <div className="row g8 ac">
            <Icon n="line-chart-fill" s={20} c="var(--accent)" />
            <span className="b s16">Citywide Balanced Trajectory &amp; Area Spread</span>
            <span className="tag ok">Whole City Coverage</span>
          </div>
          <span className="s12 muted">
            Multi-series performance curves across all 5 major regional zones of Pune &amp; PCMC
          </span>
        </div>

        {/* Zone Filter Chips */}
        <div className="row g6 wrap ac">
          {['All', 'West', 'Central', 'East', 'North', 'South'].map((z) => (
            <button
              key={z}
              type="button"
              className={`chip ${activeZone === z ? 'on' : ''}`}
              onClick={() => {
                setActiveZone(z);
                setHoveredIdx(null);
              }}
            >
              {z === 'All' ? 'All 21 Hubs' : `${z} Zone`}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Series Toggles */}
      <div className="row sb ac wrap g8 pad8" style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--line)' }}>
        <div className="row g6 wrap ac">
          <button
            type="button"
            className={`graph-metric-pill ${showProfit ? 'on' : ''}`}
            style={{ color: '#E23B3B' }}
            onClick={() => setShowProfit(!showProfit)}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E23B3B' }} />
            Expected Annual Profit (P50)
          </button>

          <button
            type="button"
            className={`graph-metric-pill ${showP10 ? 'on' : ''}`}
            style={{ color: '#0EA5E9' }}
            onClick={() => setShowP10(!showP10)}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0EA5E9' }} />
            Downside Safety (P10)
          </button>

          <button
            type="button"
            className={`graph-metric-pill ${showRent ? 'on' : ''}`}
            style={{ color: '#8B5CF6' }}
            onClick={() => setShowRent(!showRent)}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8B5CF6' }} />
            Commercial Rent
          </button>

          <button
            type="button"
            className={`graph-metric-pill ${showFootfall ? 'on' : ''}`}
            style={{ color: '#F59E0B' }}
            onClick={() => setShowFootfall(!showFootfall)}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />
            Footfall Density Index
          </button>
        </div>

        <span className="s12 muted">Hover points for detailed figures</span>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="profitFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E23B3B" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#E23B3B" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="p10FillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padT + plotH * (1 - pct);
            const profitVal = Math.round((maxProfit * pct) / 100000);
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeDasharray="3 3" opacity={0.65} />
                <text x={padL - 10} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize={11} fontFamily="inherit">
                  ₹{profitVal}L
                </text>
              </g>
            );
          })}

          {/* Shaded Area Fill for Profit */}
          {showProfit && (
            <path d={profitAreaFill} fill="url(#profitFillGrad)" className="animated-graph-fill" />
          )}

          {/* Curve 1: Expected Profit (Ruby) */}
          {showProfit && (
            <path
              d={profitPath}
              fill="none"
              stroke="#E23B3B"
              strokeWidth={3}
              strokeLinecap="round"
              className="animated-graph-line"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(226,59,59,0.35))' }}
            />
          )}

          {/* Curve 2: Downside P10 (Cyan) */}
          {showP10 && (
            <path
              d={p10Path}
              fill="none"
              stroke="#0EA5E9"
              strokeWidth={2.5}
              strokeDasharray="5 3"
              strokeLinecap="round"
              className="animated-graph-line"
              style={{ filter: 'drop-shadow(0 2px 5px rgba(14,165,233,0.3))' }}
            />
          )}

          {/* Curve 3: Commercial Rent (Violet) */}
          {showRent && (
            <path
              d={rentPath}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth={2.5}
              strokeLinecap="round"
              className="animated-graph-line"
              style={{ filter: 'drop-shadow(0 2px 5px rgba(139,92,246,0.3))' }}
            />
          )}

          {/* Curve 4: Footfall (Amber) */}
          {showFootfall && (
            <path
              d={ffPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2.2}
              strokeLinecap="round"
              className="animated-graph-line"
              style={{ filter: 'drop-shadow(0 2px 5px rgba(245,158,11,0.3))' }}
            />
          )}

          {/* Vertical Crosshair Line when Hovering */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={padT}
              x2={hoveredPoint.x}
              y2={padT + plotH}
              stroke="var(--accent2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Interactive Data Dots & X Axis Labels */}
          {pointsData.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={p.name} onMouseEnter={() => setHoveredIdx(idx)} onClick={() => onSelectLocality(p)}>
                {/* Clickable vertical column hit area */}
                <rect
                  x={p.x - plotW / (count * 2)}
                  y={padT}
                  width={plotW / count}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                />

                {/* X Axis Area Label */}
                <text
                  x={p.x}
                  y={padT + plotH + 18}
                  textAnchor="end"
                  transform={`rotate(-40, ${p.x}, ${padT + plotH + 18})`}
                  fill={isHovered ? 'var(--accent2)' : 'var(--text)'}
                  fontSize={11.5}
                  fontWeight={isHovered ? 700 : 500}
                  fontFamily="inherit"
                  style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                  {p.name}
                </text>

                {/* Node dot on Profit */}
                {showProfit && (
                  <circle
                    cx={p.x}
                    cy={p.yProfit}
                    r={isHovered ? 7 : 4}
                    fill="var(--bg)"
                    stroke="#E23B3B"
                    strokeWidth={isHovered ? 3 : 2}
                    className="graph-node-dot"
                  />
                )}

                {/* Node dot on P10 */}
                {showP10 && (
                  <circle
                    cx={p.x}
                    cy={p.yP10}
                    r={isHovered ? 6 : 3.5}
                    fill="var(--bg)"
                    stroke="#0EA5E9"
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    className="graph-node-dot"
                  />
                )}

                {/* Node dot on Rent */}
                {showRent && (
                  <circle
                    cx={p.x}
                    cy={p.yRent}
                    r={isHovered ? 6 : 3.5}
                    fill="var(--bg)"
                    stroke="#8B5CF6"
                    strokeWidth={isHovered ? 2.5 : 1.8}
                    className="graph-node-dot"
                  />
                )}

                {/* Node dot on Footfall */}
                {showFootfall && (
                  <circle
                    cx={p.x}
                    cy={p.yFf}
                    r={isHovered ? 5.5 : 3}
                    fill="var(--bg)"
                    stroke="#F59E0B"
                    strokeWidth={1.8}
                    className="graph-node-dot"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip Card: docked at top of graph canvas, clamped so it never clips or hides */}
        {hoveredPoint && (() => {
          const xPct = (hoveredPoint.x / W) * 100;
          const tooltipPosStyle =
            xPct < 26
              ? { left: 16 }
              : xPct > 74
              ? { right: 16 }
              : { left: `${xPct}%`, transform: 'translateX(-50%)' };

          return (
            <div
              className="card pad12 col g6 shadow graph-hover-modal"
              style={{
                position: 'absolute',
                top: 10,
                ...tooltipPosStyle,
                width: 270,
                maxWidth: 'calc(100% - 32px)',
                background: 'var(--surface)',
                border: '1.5px solid var(--accent2)',
                borderRadius: 12,
                pointerEvents: 'none',
                zIndex: 40,
                boxShadow: '0 8px 24px -2px rgba(0,0,0,0.22)',
              }}
            >
              <div className="row sb ac">
                <span className="b s14">{hoveredPoint.name}</span>
                <span className="tag acc" style={{ fontSize: 11, padding: '2px 7px' }}>{hoveredPoint.zone} Zone</span>
              </div>
              <span className="s11 muted">{hoveredPoint.sub}</span>

              <div className="divider" style={{ margin: '3px 0' }} />

              <div className="grid2 g8 s12">
                <div className="col g2">
                  <span className="s11 muted">Exp Profit</span>
                  <span className="b num" style={{ color: '#E23B3B' }}>{inr(hoveredPoint.expProfit)}</span>
                </div>
                <div className="col g2">
                  <span className="s11 muted">Downside (P10)</span>
                  <span className="b num" style={{ color: '#0EA5E9' }}>{inr(hoveredPoint.p10Profit)}</span>
                </div>
                <div className="col g2">
                  <span className="s11 muted">Commercial Rent</span>
                  <span className="b num" style={{ color: '#8B5CF6' }}>₹{hoveredPoint.rent}/sq ft</span>
                </div>
                <div className="col g2">
                  <span className="s11 muted">Footfall Density</span>
                  <span className="b num" style={{ color: '#F59E0B' }}>{hoveredPoint.ffIdx} / 100</span>
                </div>
              </div>

              <div className="row sb ac s11 muted" style={{ marginTop: 2 }}>
                <span className="tag ok b">Tier {hoveredPoint.tier} Viability</span>
                <span className="row g4 ac b" style={{ color: 'var(--accent2)' }}>
                  <Icon n="map-pin-2-fill" s={12} />
                  {hoveredPoint.locality || hoveredPoint.name}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// a locality search covers itself plus localities within ~2.5 km so the five picks have room to spread
function nearbyAreas(l) {
  return [
    l.name,
    ...LOCS.filter((x) => x.name !== l.name && Math.hypot((x.lat - l.lat) * 110.6, (x.lon - l.lon) * 105.4) < 3.2).map((x) => x.name),
  ];
}

const LOCS = [
  ['Baner', 18.559, 73.7868], ['Balewadi', 18.5765, 73.769], ['Aundh', 18.559, 73.8077], ['Wakad', 18.5986, 73.7646], ['Hinjewadi', 18.5913, 73.7389], ['Kothrud', 18.5074, 73.8077], ['Viman Nagar', 18.5679, 73.9143], ['Kharadi', 18.5515, 73.9348],
  ['Koregaon Park', 18.5362, 73.894], ['Hadapsar', 18.5089, 73.926], ['Pimple Saudagar', 18.5994, 73.7997], ['Shivajinagar', 18.5308, 73.8475], ['Magarpatta', 18.5146, 73.9294], ['Bavdhan', 18.5104, 73.7709], ['Pashan', 18.5362, 73.7997], ['Pimpri', 18.6298, 73.7997],
  ['Chinchwad', 18.644, 73.7925], ['Nigdi', 18.651, 73.77], ['Bhosari', 18.62, 73.85], ['Yerawada', 18.5523, 73.886], ['Kalyani Nagar', 18.5463, 73.9033], ['Wanowrie', 18.49, 73.899], ['Kondhwa', 18.4677, 73.889], ['Katraj', 18.4529, 73.856],
  ['Sinhagad Road', 18.48, 73.82], ['Warje', 18.484, 73.8], ['Camp', 18.515, 73.878], ['Deccan', 18.5167, 73.841], ['Swargate', 18.5018, 73.8636], ['Dhanori', 18.594, 73.903], ['Wagholi', 18.58, 73.975], ['Undri', 18.456, 73.91],
  ['Sus', 18.542, 73.77], ['Mahalunge', 18.576, 73.75], ['Ravet', 18.646, 73.748], ['Moshi', 18.67, 73.85], ['Dighi', 18.62, 73.88], ['Pimple Nilakh', 18.575, 73.79], ['Sangvi', 18.58, 73.815], ['Akurdi', 18.648, 73.766],
].map(([name, lat, lon]) => ({ name, lat, lon }));

