import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'remixicon/fonts/remixicon.css';
import './styles.css';
import App from './App.jsx';
import { AuthProvider, ThemeProvider, ToastProvider, AppProvider } from './lib/state.jsx';

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (<div className="col ac jc g12" style={{ minHeight: '100vh', padding: 24, textAlign: 'center' }}>
      <div className="h2">Something broke on this page</div><p className="muted">{String(this.state.err.message || this.state.err)}</p>
      <button className="btn ink" onClick={() => { this.setState({ err: null }); window.location.assign('/app'); }}>Back to dashboard</button></div>);
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider><ToastProvider><AuthProvider><AppProvider><Boundary><App /></Boundary></AppProvider></AuthProvider></ToastProvider></ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
