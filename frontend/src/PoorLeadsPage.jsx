import React, { useState } from 'react';
import {
  Flame, Search, Phone, Mail, Globe, Sparkles, Copy, Check, ExternalLink,
  AlertTriangle, ShieldAlert, CheckCircle2, Bookmark, Download, MapPin,
  RefreshCw, Filter, MessageSquare, Zap, Clock, Star, Layers, ArrowUpRight
} from 'lucide-react';

const POPULAR_NICHES = [
  { name: 'HVAC', icon: '❄️' },
  { name: 'Roofing', icon: '🏠' },
  { name: 'Dentist', icon: '🦷' },
  { name: 'Lawyer', icon: '⚖️' },
  { name: 'Plumber', icon: '🔧' },
  { name: 'Salon & Spa', icon: '💇‍♀️' },
  { name: 'Electrician', icon: '⚡' },
  { name: 'Auto Repair', icon: '🚗' },
  { name: 'Landscaping', icon: '🌿' }
];

export default function PoorLeadsPage({ API_BASE, showToast, bookmarkedLeads, setBookmarkedLeads }) {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(15);
  const [minScoreFilter, setMinScoreFilter] = useState(0);

  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [poorLeads, setPoorLeads] = useState([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hotOnlyFilter, setHotOnlyFilter] = useState(false);

  const [copiedId, setCopiedId] = useState(null);
  const [copiedType, setCopiedType] = useState('');

  const handleFindPoorLeads = async (e) => {
    if (e) e.preventDefault();
    if (!niche.trim()) {
      setError('Please enter a business niche (e.g. HVAC, Dentist, Roofing).');
      return;
    }

    setLoading(true);
    setError('');
    setPoorLeads([]);
    setProgressPercent(5);
    setProgressMessage(`Searching Google Maps for ${niche} businesses in ${location || 'all areas'}...`);

    let timer;
    setElapsedSeconds(0);
    timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const resp = await fetch(`${API_BASE}/api/v1/stream-poor-website-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: niche.trim(),
          location: location.trim(),
          max_results: parseInt(maxResults),
          min_score: parseInt(minScoreFilter)
        })
      });

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete chunk in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line.trim());
            if (data.type === 'progress') {
              setProgressPercent(data.percent || 10);
              if (data.message) setProgressMessage(data.message);
            } else if (data.type === 'complete') {
              setProgressPercent(100);
              setProgressMessage(data.message || 'Audit complete!');
              if (Array.isArray(data.leads)) {
                setPoorLeads(data.leads);
                showToast(`Found ${data.leads.length} qualified leads with poor websites!`);
              }
            }
          } catch (e) {
            console.warn('JSON line parse warning:', e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to fetch poor website leads: ${err.message}`);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const handleCopy = (text, type, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedType(type);
    showToast(`Copied ${type} to clipboard!`);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedType('');
    }, 2000);
  };

  const toggleBookmark = (lead) => {
    const exists = bookmarkedLeads.some(b => b.name === lead.name && b.url === lead.url);
    if (exists) {
      setBookmarkedLeads(bookmarkedLeads.filter(b => !(b.name === lead.name && b.url === lead.url)));
      showToast('Removed lead from bookmarks.');
    } else {
      setBookmarkedLeads([...bookmarkedLeads, lead]);
      showToast('Saved lead to bookmarks!');
    }
  };

  const handleExportCSV = async () => {
    if (filteredLeads.length === 0) return;
    try {
      const resp = await fetch(`${API_BASE}/api/v1/poor-website-leads/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filteredLeads)
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poor_website_leads_${niche.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Downloaded CSV of poor website leads!');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to export CSV.');
    }
  };

  const filteredLeads = poorLeads.filter(l => {
    if (hotOnlyFilter && l.lead_score < 70) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (l.name || '').toLowerCase().includes(q);
      const matchUrl = (l.url || '').toLowerCase().includes(q);
      const matchProblems = (l.problems || []).some(p => p.toLowerCase().includes(q));
      return matchName || matchUrl || matchProblems;
    }
    return true;
  });

  const hotLeadsCount = poorLeads.filter(l => l.lead_score >= 70).length;
  const avgScore = poorLeads.length > 0
    ? Math.round(poorLeads.reduce((acc, curr) => acc + curr.lead_score, 0) / poorLeads.length)
    : 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Feature Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950/60 via-slate-900 to-indigo-950/60 border border-red-500/20 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full text-red-400 text-xs font-semibold tracking-wide">
            <Flame className="w-4 h-4 text-red-500 animate-pulse" />
            <span>40-CRITERIA POOR WEBSITE QUALIFIER & OUTREACH ENGINE</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Find High-Value Local Leads with Outdated & Broken Websites
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Target businesses by niche & location. Automatically evaluate their sites against 40 technical, speed, security, and mobile criteria to score lead priority and generate instant personalized outreach hooks.
          </p>

          {/* Preset Niche Badges */}
          <div className="pt-2 flex flex-wrap gap-2">
            <span className="text-xs text-slate-400 font-medium py-1">Popular Niches:</span>
            {POPULAR_NICHES.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setNiche(item.name)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center space-x-1.5 ${
                  niche.toLowerCase() === item.name.toLowerCase()
                    ? 'bg-red-600 text-white border-red-500 font-semibold shadow-md shadow-red-600/30'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-red-500/50 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input Search Form */}
      <form onSubmit={handleFindPoorLeads} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Niche Input */}
          <div className="md:col-span-4 space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-red-400" />
              <span>Target Niche / Industry *</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. HVAC, Dentist, Roofing, Plumber..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-all font-medium"
                required
              />
            </div>
          </div>

          {/* Location Input */}
          <div className="md:col-span-4 space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span>City / Location</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Toronto ON, Austin TX, Miami FL..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Max Results Selector */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Max Leads</span>
            </label>
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white transition-all font-medium"
            >
              <option value="5">5 Leads</option>
              <option value="10">10 Leads</option>
              <option value="15">15 Leads</option>
              <option value="20">20 Leads</option>
              <option value="30">30 Leads</option>
            </select>
          </div>

          {/* Search Action Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 rounded-xl font-bold text-sm text-white transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg ${
                loading
                  ? 'bg-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 shadow-red-600/30 hover:shadow-red-600/50'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Auditing...</span>
                </>
              ) : (
                <>
                  <Flame className="w-5 h-5 text-amber-300" />
                  <span>Find Hot Leads</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Progress & Status Ticker */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
              <span className="font-semibold text-slate-200">{progressMessage}</span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
              <span>Time: {elapsedSeconds}s</span>
              <span>{progressPercent}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 h-full transition-all duration-300 ease-out shadow-[0_0_12px_#f97316]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Header & Summary Stats */}
      {poorLeads.length > 0 && (
        <div className="space-y-6">
          {/* Summary Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Leads Audited</p>
                <p className="text-2xl font-black text-white mt-1">{poorLeads.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Search className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">🔥 Hot Prospect Leads</p>
                <p className="text-2xl font-black text-red-400 mt-1">{hotLeadsCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <Flame className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Lead Score</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{avgScore}/100</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Zap className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Criteria Evaluated</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">40 Checks</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads by name or problem..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => setHotOnlyFilter(!hotOnlyFilter)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center space-x-2 ${
                  hotOnlyFilter
                    ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4 text-red-500" />
                <span>🔥 Hot Leads Only (70+)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Qualified Leads List / Grid */}
          <div className="grid grid-cols-1 gap-6">
            {filteredLeads.map((lead, idx) => {
              const isBookmarked = bookmarkedLeads.some(b => b.name === lead.name && b.url === lead.url);

              return (
                <div
                  key={idx}
                  className={`bg-slate-900 border rounded-2xl p-6 shadow-xl transition-all hover:border-slate-700 space-y-6 ${
                    lead.lead_score >= 70
                      ? 'border-red-500/40 bg-gradient-to-b from-red-950/20 via-slate-900 to-slate-900'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Lead Card Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">{lead.name}</h3>

                        {/* Lead Score Badge */}
                        <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black tracking-wide border shadow-md ${
                          lead.lead_score >= 70
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/10'
                            : lead.lead_score >= 45
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}>
                          <span>Lead Score: {lead.lead_badge}</span>
                        </span>

                        <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-md font-medium">
                          {lead.niche || niche}
                        </span>
                      </div>

                      {lead.address && (
                        <p className="text-xs text-slate-400 flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{lead.address}</span>
                        </p>
                      )}
                    </div>

                    {/* Quick Actions & Bookmark */}
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleBookmark(lead)}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isBookmarked
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                        title={isBookmarked ? "Remove bookmark" : "Save lead"}
                      >
                        <Bookmark className="w-4 h-4 fill-current" />
                      </button>

                      {lead.url && lead.url !== "No Website" && (
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 p-2.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5"
                        >
                          <Globe className="w-4 h-4 text-indigo-400" />
                          <span>Visit Site</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Contact Info Row */}
                  <div className="flex flex-wrap gap-4 text-xs font-medium bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="flex items-center space-x-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Phone className="w-4 h-4 text-emerald-500" />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-500 flex items-center space-x-1.5">
                        <Phone className="w-4 h-4" />
                        <span>Phone not listed</span>
                      </span>
                    )}

                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center space-x-2 text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-indigo-500" />
                        <span>{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-slate-500 flex items-center space-x-1.5">
                        <Mail className="w-4 h-4" />
                        <span>Email not found</span>
                      </span>
                    )}

                    {lead.google_maps_url && (
                      <a
                        href={lead.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 transition-colors ml-auto"
                      >
                        <MapPin className="w-4 h-4 text-red-400" />
                        <span>View on Google Maps</span>
                      </a>
                    )}
                  </div>

                  {/* Problems & Recommended Services Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Problems List */}
                    <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Detected Technical & Design Problems ({lead.problems.length})</span>
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {lead.problems.map((prob, pIdx) => (
                          <li key={pIdx} className="flex items-start space-x-2">
                            <span className="text-red-500 font-bold mt-0.5">✓</span>
                            <span className="leading-snug">{prob}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommended Services List */}
                    <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Recommended Upsell Services ({lead.recommended_services.length})</span>
                      </h4>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {lead.recommended_services.map((serv, sIdx) => (
                          <span
                            key={sIdx}
                            className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1"
                          >
                            <span className="text-emerald-400 font-bold">✔</span>
                            <span>{serv}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Personalized Outreach Hook Box (Highlight Feature) */}
                  <div className="bg-gradient-to-r from-indigo-950/80 via-slate-950 to-purple-950/80 border border-indigo-500/30 rounded-xl p-5 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Personalized Outreach Hook (Ready to Send)</span>
                      </h4>

                      <button
                        type="button"
                        onClick={() => handleCopy(lead.outreach_hook, 'Outreach Hook', idx)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-indigo-600/30"
                      >
                        {copiedId === idx && copiedType === 'Outreach Hook' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied Hook!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Hook</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-slate-200 text-xs italic bg-slate-950/70 p-4 rounded-lg border border-indigo-900/50 leading-relaxed">
                      "{lead.outreach_hook}"
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
