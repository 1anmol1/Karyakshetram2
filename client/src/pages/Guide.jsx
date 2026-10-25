import { Link } from 'react-router-dom';
import { useAuth } from '../lib/state.jsx';
import { Header, Footer } from '../components/Layout.jsx';
import { Icon } from '../components/ui.jsx';

const Box = ({ t, s, hl, to }) => {
  const c = <div className="flowbox" style={hl ? { borderColor: 'var(--accent)', background: 'var(--accentSoft)', color: 'var(--accent)' } : undefined}>{t}{s && <div className="s11 muted" style={{ fontWeight: 400, marginTop: 2 }}>{s}</div>}</div>;
  return to ? <Link to={to}>{c}</Link> : c;
};
const Down = () => <div className="row jc"><Icon n="arrow-down-line" s={18} c="var(--muted)" /></div>;

export default function Guide() {
  const { user } = useAuth();
  return (
    <div className="page">
      <Header back={!!user} showCategory={false} crumb="Help & guide" />
      <div className="wrapx col g24" style={{ padding: 28 }}>
        <div className="col g4"><h1 className="h2">How Karyakshetram works</h1><span className="muted s14">Landing to shortlist in 5 interactions after onboarding. The menu in the top right reaches every page.</span></div>
        <div className="row as g16 stack-md">
          <div className="col g8" style={{ width: 220 }}><Box t="Sign up / Sign in" s="email" /><Down /><Box t="1 · Business" s="category, role" hl /><Down /><Box t="2 · Market" s="city, areas, grid" hl /><Down /><Box t="3 · Your stores" s="CSV / manual" hl /><Down /><Box t="4 · Format & economics" s="category-specific" hl /><Down /><Box t="5 · Goals & constraints" s="budget, rent, k" hl /></div>
          <div className="row ac"><Icon n="arrow-right-line" s={18} c="var(--muted)" /></div>
          <div className="col g8" style={{ width: 220, paddingTop: 120 }}><Box t="Dashboard" s="map, picks, shops, AI summary" to="/app" /></div>
          <div className="row ac"><Icon n="arrow-right-line" s={18} c="var(--muted)" /></div>
          <div className="grid3 f1" style={{ gap: 10, paddingTop: 60 }}>
            <Box t="Location page" s="Summary · Why here · Risks · Neighbourhood · Money" /><Box t="AI summary panel" s="overlays similar list" /><Box t="Check a location" s="pass → location · fail → reasons + 3 alternatives" to="/check" />
            <Box t="Compare (≤ 3)" s="why A over B" to="/compare" /><Box t="Cannibalisation" s="own stores yes / no / none nearby" to="/cannibalisation" /><Box t="Portfolio planner" s="k sites vs naive top-k" to="/portfolio" />
            <Box t="Saved / shortlist" s="export CSV" to="/saved" /><Box t="Feedback & outcomes" s="recalibrate intervals" /><Box t="Trust Center" s="from every footer" to="/trust" />
            <Box t="Profile" s="edit onboarding data" to="/profile" /><Box t="Chatbot" s="bottom right, any page" /><Box t="Theme" s="day / night toggle" />
          </div>
        </div>
        <div className="grid3">
          {[['Tiers', 'A: profitable even in a weak year (P10 profit > 0). B: profitable on average. C: not expected to cover costs.'], ['Confidence', 'High / Medium / Low from map-data coverage and whether the site is inside the range of training stores.'], ['Cannibalisation', 'Revenue a new site takes from your own stores, from a Huff model recomputed with the site added.'], ['Stress tests', 'Dominant competitor 500 m away, rent +25%, demand −15%, margin −2 pp. A test passes if expected profit stays positive.'], ['ML Model Predictions', 'Revenue, rent index, downside safety and margins are evaluated by the live trained Random Forest regressor with calibrated risk quantiles.'], ['Keyboard', 'Press / to jump to search. Esc closes menus and dialogs.']].map(([t, d]) => <div key={t} className="panel pad20 col g6"><b>{t}</b><span className="s13 muted" style={{ lineHeight: 1.55 }}>{d}</span></div>)}
        </div>
      </div>
      <Footer />
    </div>
  );
}
