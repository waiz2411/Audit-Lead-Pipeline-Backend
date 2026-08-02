import React, { useState, useEffect } from 'react';
import {
  MapPin, Search, Phone, Mail, Globe, Star, FileSpreadsheet, FileJson, Copy,
  Check, ExternalLink, Filter, Sparkles, RefreshCw, Bookmark, Share2, Layers,
  MessageCircle, AlertCircle, ShieldCheck, Download, UploadCloud, FileText
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (typeof window !== 'undefined' ? window.location.origin : '')
);

const InstagramIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const LinkedinIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

function App() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(15);
  const [deepEnrich, setDeepEnrich] = useState(true);
  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [csvFile, setCsvFile] = useState(null);

  // Filters
  const [filterEmailOnly, setFilterEmailOnly] = useState(false);
  const [filterPhoneOnly, setFilterPhoneOnly] = useState(false);
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast / Copy status
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedType, setCopiedType] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Bookmarks
  const [bookmarkedLeads, setBookmarkedLeads] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gmaps_bookmarked_leads') || '[]');
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('extractor'); // 'extractor' | 'saved'

  useEffect(() => {
    localStorage.setItem('gmaps_bookmarked_leads', JSON.stringify(bookmarkedLeads));
  }, [bookmarkedLeads]);

  useEffect(() => {
    let timer;
    if (loading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleExtractLeads = async (e) => {
    if (e) e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setError('');
    setLeads([]);
    setProgressPercent(5);
    setProgressMessage('Launching Playwright Google Maps extractor...');

    try {
      const resp = await fetch(`${API_BASE}/api/v1/stream-gmaps-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          location: location.trim(),
          max_results: parseInt(maxResults),
          deep_enrich: deepEnrich
        })
      });

      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line.trim());
              if (evt.percent !== undefined) setProgressPercent(evt.percent);
              if (evt.message) setProgressMessage(evt.message);

              if (evt.type === 'complete') {
                setLeads(evt.leads || []);
                if (!evt.leads || evt.leads.length === 0) {
                  setError('No Google Maps leads found for this keyword. Try broadening your location or niche query.');
                } else {
                  showToast(`Successfully extracted ${evt.leads.length} local business leads!`);
                }
              }
            } catch (parseErr) {
              console.error("Parse line error:", parseErr);
            }
          }
        }
      } else {
        const errData = await resp.json().catch(() => ({}));
        setError(errData.detail || 'Extraction failed. Please check server logs.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error connecting to extraction backend.');
    } finally {
      setLoading(false);
    }
  };

  const parseCSVText = (text) => {
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return [];

    const parseRow = (str) => {
      const arr = [];
      let quote = false;
      let col = '';
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === '"') {
          quote = !quote;
        } else if (c === ',' && !quote) {
          arr.push(col.trim());
          col = '';
        } else {
          col += c;
        }
      }
      arr.push(col.trim());
      return arr;
    };

    const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ''));

    const findCol = (keywords) => {
      return headers.find((h) => keywords.some((k) => h.includes(k)));
    };

    const nameCol = findCol(['title', 'name', 'company', 'business', 'place']);
    const webCol = findCol(['website', 'domain', 'site', 'url', 'web']);
    const phoneCol = findCol(['phone', 'tel', 'mobile', 'contact']);
    const scoreCol = findCol(['totalscore', 'score', 'rating', 'stars']);
    const reviewCol = findCol(['reviewscount', 'reviews', 'review']);
    const catCol = findCol(['categoryname', 'category', 'categories/0', 'type']);
    const urlCol = findCol(['maps_url', 'google_maps_url']) || (headers.includes('url') ? 'url' : null);
    const streetCol = findCol(['street', 'address']);
    const cityCol = findCol(['city']);
    const stateCol = findCol(['state']);

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = parseRow(lines[i]).map((v) => v.replace(/^"|"$/g, ''));
      const getVal = (colName) => {
        if (!colName) return '';
        const idx = headers.indexOf(colName);
        return idx !== -1 ? vals[idx] || '' : '';
      };

      const name = getVal(nameCol) || 'Local Business';
      let website = getVal(webCol);
      if (website && !website.startsWith('http') && website.includes('.')) {
        website = `https://${website}`;
      }
      const phone = getVal(phoneCol);
      const rating = parseFloat(getVal(scoreCol)) || 4.5;
      const reviews_count = parseInt(getVal(reviewCol)) || 15;
      const category = getVal(catCol) || 'Local Business';
      const google_maps_url = getVal(urlCol);

      const addrParts = [getVal(streetCol), getVal(cityCol), getVal(stateCol)].filter(Boolean);
      const address = addrParts.length > 0 ? addrParts.join(', ') : 'Local Area';

      items.push({
        name,
        website,
        phone,
        rating,
        reviews_count,
        category,
        address,
        google_maps_url
      });
    }
    return items;
  };

  const handleUploadCSVAndEnrich = async (e) => {
    if (e) e.preventDefault();
    if (!csvFile) return;

    setLoading(true);
    setError('');
    setLeads([]);
    setProgressPercent(5);
    setProgressMessage('Reading CSV dataset locally in browser...');

    try {
      const text = await csvFile.text();
      const rawItems = parseCSVText(text);

      if (!rawItems || rawItems.length === 0) {
        setError('No valid data rows found in uploaded CSV file.');
        setLoading(false);
        return;
      }

      const totalItems = rawItems.length;
      setProgressPercent(10);
      setProgressMessage(`Parsed ${totalItems} business listings from CSV. Starting fast email crawler...`);

      const BATCH_SIZE = 25;
      const chunks = [];
      for (let i = 0; i < rawItems.length; i += BATCH_SIZE) {
        chunks.push(rawItems.slice(i, i + BATCH_SIZE));
      }

      let processedCount = 0;
      const CONCURRENCY = 4; // 4 parallel batch workers

      for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const currentBatchGroup = chunks.slice(i, i + CONCURRENCY);

        const promises = currentBatchGroup.map(async (chunk) => {
          try {
            const resp = await fetch(`${API_BASE}/api/v1/enrich-csv-batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chunk)
            });
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) {
                setLeads((prev) => [...prev, ...data]);
              }
            }
          } catch (err) {
            console.error('Batch enrich error:', err);
          } finally {
            processedCount += chunk.length;
            const pct = Math.min(99, Math.round((processedCount / totalItems) * 90) + 10);
            setProgressPercent(pct);
            setProgressMessage(`Crawling websites & extracting emails (${Math.min(processedCount, totalItems)}/${totalItems} businesses)...`);
          }
        });

        await Promise.all(promises);
      }

      setProgressPercent(100);
      setProgressMessage(`Successfully enriched all ${totalItems} business leads!`);
      showToast(`Finished processing all ${totalItems} business leads!`);
    } catch (err) {
      console.error(err);
      setError('Failed to parse or process CSV file.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (text, type, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setCopiedType(type);
    showToast(`Copied ${type}: ${text}`);
    setTimeout(() => {
      setCopiedIndex(null);
      setCopiedType('');
    }, 2000);
  };

  const handleCopyAllEmails = () => {
    const emails = displayedLeads.map(l => l.email).filter(Boolean);
    if (emails.length === 0) {
      showToast('No emails available to copy.');
      return;
    }
    const uniqueEmails = Array.from(new Set(emails)).join(', ');
    navigator.clipboard.writeText(uniqueEmails);
    showToast(`Copied ${emails.length} emails to clipboard!`);
  };

  const handleExportCSV = async () => {
    if (displayedLeads.length === 0) return;
    try {
      const resp = await fetch(`${API_BASE}/api/v1/gmaps-leads/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(displayedLeads)
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `google_maps_leads_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Downloaded CSV leads file!');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to generate CSV export.');
    }
  };

  const handleExportJSON = () => {
    if (displayedLeads.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(displayedLeads, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `google_maps_leads_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Downloaded JSON leads file!');
  };

  const toggleBookmark = (lead) => {
    const exists = bookmarkedLeads.some(b => b.name === lead.name && b.address === lead.address);
    if (exists) {
      setBookmarkedLeads(bookmarkedLeads.filter(b => !(b.name === lead.name && b.address === lead.address)));
      showToast('Removed from saved leads.');
    } else {
      setBookmarkedLeads([...bookmarkedLeads, lead]);
      showToast('Saved to bookmarked leads list!');
    }
  };

  const currentLeadsList = activeTab === 'extractor' ? leads : bookmarkedLeads;

  const displayedLeads = currentLeadsList.filter(l => {
    if (filterEmailOnly && !l.email) return false;
    if (filterPhoneOnly && !l.phone) return false;
    if (filterMinRating > 0 && l.rating < filterMinRating) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = l.name.toLowerCase().includes(q);
      const matchCat = l.category.toLowerCase().includes(q);
      const matchAddress = l.address.toLowerCase().includes(q);
      const matchEmail = l.email.toLowerCase().includes(q);
      const matchPhone = l.phone.includes(q);
      return matchName || matchCat || matchAddress || matchEmail || matchPhone;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Sticky Global Loading Bar */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1.5 bg-slate-950/80 backdrop-blur-sm overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_12px_#6366f1]"
            style={{ width: `${Math.max(3, progressPercent)}%` }}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 border border-indigo-400 animate-bounce">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              MapMiner AI
            </h1>
            <p className="text-xs text-slate-400 font-medium">Google Maps Lead Extractor & Contact Finder</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('extractor')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'extractor'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Lead Extractor</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'csv'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Email Enricher</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'saved'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved Leads ({bookmarkedLeads.length})</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Extractor Search Box */}
        {activeTab === 'extractor' && (
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <span>Discover Verified Local Business Leads</span>
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Extract business name, phone, verified email, website, ratings, and social profiles straight from Google Maps.
                </p>
              </div>

              <form onSubmit={handleExtractLeads} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Keyword / Niche Input */}
                  <div className="md:col-span-4 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Niche (e.g. Plumbers, Dentists, Roofers)"
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-slate-500 rounded-2xl pl-12 pr-4 py-3.5 text-base transition-all outline-none"
                    />
                  </div>

                  {/* City / Location Input */}
                  <div className="md:col-span-4 relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Location (e.g. Miami, FL or Austin, TX)"
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-white placeholder-slate-500 rounded-2xl pl-12 pr-4 py-3.5 text-base transition-all outline-none"
                    />
                  </div>

                  {/* Max Results Selector */}
                  <div className="md:col-span-2">
                    <select
                      value={maxResults}
                      onChange={(e) => setMaxResults(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-indigo-500 text-white rounded-2xl px-4 py-3.5 text-base outline-none cursor-pointer"
                    >
                      <option value="15">15 Leads (Quick)</option>
                      <option value="50">50 Leads</option>
                      <option value="100">100 Leads</option>
                      <option value="250">250 Leads</option>
                      <option value="500">500 Leads</option>
                      <option value="1000">1,000 Bulk Leads</option>
                      <option value="5000">5,000 Enterprise Leads</option>
                      <option value="10000">10,000 Mega Extraction</option>
                    </select>
                  </div>

                  {/* Action Button */}
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={loading || !keyword.trim()}
                      className="w-full h-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-2xl px-6 py-3.5 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Extracting...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5" />
                          <span>Extract</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Deep Enrich Toggle */}
                <div className="flex items-center space-x-3 pt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deepEnrich}
                      onChange={(e) => setDeepEnrich(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-3 text-sm font-medium text-slate-300">
                      Deep Contact Scraping (Scrape website for Emails & Social links)
                    </span>
                  </label>
                </div>
              </form>

              {/* Progress Bar & Real-time Status */}
              {loading && (
                <div className="bg-slate-950/95 border border-indigo-500/50 rounded-2xl p-6 shadow-2xl shadow-indigo-950/40 space-y-4 mt-6 backdrop-blur-xl transition-all duration-300">
                  
                  {/* Header & Percentage */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2.5 text-indigo-300 font-semibold text-base">
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 flex-shrink-0" />
                        <span>{progressMessage || 'Extracting local business leads from Google Maps...'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 pl-7">
                        <span className="bg-indigo-500/10 text-indigo-300 px-2.5 py-0.5 rounded-md border border-indigo-500/20 font-medium">
                          {progressPercent < 45 ? 'Step 1/2: Scraping Google Maps' : 'Step 2/2: Enriching Emails & Phones'}
                        </span>
                        <span className="font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          Elapsed: {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}s
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-auto">
                      <span className="font-mono text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">
                        {progressPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Track */}
                  <div className="w-full bg-slate-900 rounded-full h-4 p-0.5 border border-slate-800 overflow-hidden relative shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-400 transition-all duration-300 ease-out shadow-lg shadow-indigo-500/40 relative"
                      style={{ width: `${Math.max(2, progressPercent)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-2 border-t border-slate-900/80">
                    <span>Query: <strong className="text-slate-200">"{keyword} {location ? `in ${location}` : ''}"</strong></span>
                    <span>Target: <strong className="text-slate-200">{maxResults} Leads</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CSV Email Enricher Upload Box */}
        {activeTab === 'csv' && (
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                  <span>Batch CSV Email & Contact Enricher</span>
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Upload any Google Places or lead CSV export (e.g., <code className="text-purple-300 font-mono text-xs">dataset_crawler-google-places_....csv</code>). We will automatically crawl the website domains to extract verified emails, phones, and social links.
                </p>
              </div>

              <form onSubmit={handleUploadCSVAndEnrich} className="space-y-4">
                <div className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/80 rounded-3xl p-8 text-center transition-all bg-slate-950/60 relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div className="space-y-3 pointer-events-none">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    {csvFile ? (
                      <div className="space-y-1">
                        <p className="text-base font-bold text-white flex items-center justify-center space-x-2">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                          <span>{csvFile.name}</span>
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {(csvFile.size / 1024).toFixed(1)} KB • Ready for extraction
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-base font-medium text-slate-200">
                          Drop your CSV file here or <span className="text-indigo-400 font-semibold underline">browse file</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Supports Google Places Crawler CSVs, Apify exports, or custom domain CSV lists
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-400">
                    Auto-detects: <span className="text-slate-300 font-mono">Title, Website, Phone, Rating, Address, Category</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !csvFile}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-2xl px-8 py-3.5 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Crawling Websites...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Start Email Crawling</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Progress Bar & Real-time Status */}
              {loading && (
                <div className="bg-slate-950/95 border border-indigo-500/50 rounded-2xl p-6 shadow-2xl shadow-indigo-950/40 space-y-4 mt-6 backdrop-blur-xl transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2.5 text-indigo-300 font-semibold text-base">
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400 flex-shrink-0" />
                        <span>{progressMessage || 'Crawling website domains for verified contact emails...'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 pl-7">
                        <span className="bg-indigo-500/10 text-indigo-300 px-2.5 py-0.5 rounded-md border border-indigo-500/20 font-medium">
                          {progressPercent < 15 ? 'Step 1/2: Parsing CSV File' : 'Step 2/2: Multi-threaded Website Crawling'}
                        </span>
                        <span className="font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          Elapsed: {Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}s
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-start sm:self-auto">
                      <span className="font-mono text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">
                        {progressPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-4 p-0.5 border border-slate-800 overflow-hidden relative shadow-inner">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-400 transition-all duration-300 ease-out shadow-lg shadow-indigo-500/40 relative"
                      style={{ width: `${Math.max(2, progressPercent)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Results Section */}
        <div className="space-y-4">
          
          {/* Header Controls & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-white">
                {activeTab === 'extractor' ? 'Extracted Business Leads' : (activeTab === 'csv' ? 'CSV Enriched Business Leads' : 'Bookmarked Leads')}
              </h3>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-3 py-1 rounded-full font-semibold">
                {displayedLeads.length} Leads
              </span>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by name or city..."
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:border-indigo-500"
                />
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              <button
                onClick={() => setFilterEmailOnly(!filterEmailOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                  filterEmailOnly
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Has Email</span>
              </button>

              <button
                onClick={() => setFilterPhoneOnly(!filterPhoneOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                  filterPhoneOnly
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Has Phone</span>
              </button>

              {/* Export Toolbar */}
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <button
                  onClick={handleCopyAllEmails}
                  title="Copy all extracted emails"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-xl border border-slate-700 flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Emails</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  title="Export leads to CSV file"
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center space-x-1 font-semibold transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  title="Export leads to JSON file"
                  className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs px-3 py-1.5 rounded-xl border border-purple-500/30 flex items-center space-x-1 font-semibold transition-all cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results Table */}
          {displayedLeads.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                <MapPin className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-semibold text-slate-300">No Business Leads to Display</h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {loading
                  ? 'Extracting local businesses from Google Maps... Please wait a few seconds.'
                  : 'Enter a keyword above (e.g. "Roofers in Dallas, TX") and click Extract to generate your lead list.'}
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="py-4 px-6">Business Name</th>
                      <th className="py-4 px-6">Rating & Reviews</th>
                      <th className="py-4 px-6">Phone Number</th>
                      <th className="py-4 px-6">Verified Email</th>
                      <th className="py-4 px-6">Website</th>
                      <th className="py-4 px-6">Social Links</th>
                      <th className="py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {displayedLeads.map((lead, idx) => {
                      const isBookmarked = bookmarkedLeads.some(b => b.name === lead.name && b.address === lead.address);
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          
                          {/* Name & Address */}
                          <td className="py-4 px-6 max-w-xs">
                            <div className="space-y-1">
                              <div className="font-bold text-white text-base flex items-center space-x-2">
                                <span>{lead.name}</span>
                                {lead.google_maps_url && (
                                  <a
                                    href={lead.google_maps_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300"
                                    title="Open Google Maps"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              <div className="text-xs text-indigo-300/80 font-medium">{lead.category}</div>
                              <div className="text-xs text-slate-400 flex items-center space-x-1">
                                <MapPin className="w-3 h-3 flex-shrink-0 text-slate-500" />
                                <span className="truncate">{lead.address}</span>
                              </div>
                            </div>
                          </td>

                          {/* Rating */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-1.5">
                              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span className="font-bold text-white">{lead.rating}</span>
                              <span className="text-xs text-slate-400">({lead.reviews_count})</span>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="py-4 px-6">
                            {lead.phone ? (
                              <div className="flex items-center space-x-2">
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="text-xs font-mono font-medium text-slate-200 hover:text-indigo-400 flex items-center space-x-1"
                                >
                                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{lead.phone}</span>
                                </a>
                                <button
                                  onClick={() => handleCopyText(lead.phone, 'Phone', idx)}
                                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                  title="Copy phone"
                                >
                                  {copiedIndex === idx && copiedType === 'Phone' ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600 font-mono">N/A</span>
                            )}
                          </td>

                          {/* Email */}
                          <td className="py-4 px-6">
                            {lead.email ? (
                              <div className="flex items-center space-x-2">
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-xs font-mono px-2.5 py-1 rounded-lg hover:bg-indigo-500/20 transition-all flex items-center space-x-1"
                                >
                                  <Mail className="w-3 h-3" />
                                  <span className="truncate max-w-[160px]">{lead.email}</span>
                                </a>
                                <button
                                  onClick={() => handleCopyText(lead.email, 'Email', idx)}
                                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                                  title="Copy email"
                                >
                                  {copiedIndex === idx && copiedType === 'Email' ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600 font-mono">No Email Found</span>
                            )}
                          </td>

                          {/* Website */}
                          <td className="py-4 px-6">
                            {lead.website ? (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-mono text-indigo-400 hover:underline flex items-center space-x-1 truncate max-w-[140px]"
                              >
                                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-600 font-mono">No Website</span>
                            )}
                          </td>

                          {/* Social Links */}
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              {lead.instagram && (
                                <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-pink-400 hover:text-pink-300 p-1" title="Instagram">
                                  <InstagramIcon className="w-4 h-4" />
                                </a>
                              )}
                              {lead.facebook && (
                                <a href={lead.facebook} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 p-1" title="Facebook">
                                  <FacebookIcon className="w-4 h-4" />
                                </a>
                              )}
                              {lead.linkedin && (
                                <a href={lead.linkedin} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 p-1" title="LinkedIn">
                                  <LinkedinIcon className="w-4 h-4" />
                                </a>
                              )}
                              {lead.whatsapp && (
                                <a href={lead.whatsapp} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 p-1" title="WhatsApp">
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                              {!lead.instagram && !lead.facebook && !lead.linkedin && !lead.whatsapp && (
                                <span className="text-xs text-slate-600">-</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6">
                            <button
                              onClick={() => toggleBookmark(lead)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                isBookmarked
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                              }`}
                              title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Lead'}
                            >
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
