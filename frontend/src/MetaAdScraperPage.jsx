import React, { useState, useEffect, useRef } from 'react';
import {
  Megaphone, Search, Globe, Sparkles, Copy, Check, ExternalLink,
  Download, RefreshCw, AlertCircle, Trash2, Cpu, Terminal, Play,
  Mail, Phone, CheckCircle
} from 'lucide-react';

const Facebook = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const Instagram = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);


export default function MetaAdScraperPage({ API_BASE, showToast }) {
  const [adsUrl, setAdsUrl] = useState('');
  const [profileType, setProfileType] = useState('facebook'); // 'facebook' | 'instagram'
  const [limit, setLimit] = useState(20);

  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [logFeed, setLogFeed] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedText, setCopiedText] = useState('');

  const timerRef = useRef(null);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logFeed]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogFeed((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleLaunchScraper = async (e) => {
    if (e) e.preventDefault();
    if (!adsUrl.trim()) {
      setError('Please paste a valid Meta Ad Library search URL.');
      return;
    }
    if (!adsUrl.includes('facebook.com/ads/library')) {
      setError('The URL must be a valid Meta/Facebook Ad Library link (e.g. starting with https://www.facebook.com/ads/library/...)');
      return;
    }

    setLoading(true);
    setError('');
    setLeads([]);
    setLogFeed([]);
    setProgressPercent(5);
    setProgressMessage('Launching browser and setting up Playwright context...');
    addLog('Scraper initialized.');
    addLog(`Target profile type: ${profileType.toUpperCase()}`);
    addLog(`Limit: ${limit} advertisers`);

    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const resp = await fetch(`${API_BASE}/api/v1/stream-meta-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads_library_url: adsUrl.trim(),
          profile_type: profileType,
          limit: parseInt(limit)
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
              if (data.message) {
                setProgressMessage(data.message);
                addLog(data.message);
              }
            } else if (data.type === 'complete') {
              setProgressPercent(100);
              setProgressMessage(data.message || 'Scrape complete!');
              addLog(data.message || 'Scrape complete!');
              if (Array.isArray(data.leads)) {
                setLeads(data.leads);
                showToast(`Successfully extracted ${data.leads.length} advertiser leads!`);
              }
            }
          } catch (err) {
            // Non-JSON line or partial line, ignore
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during scraping.');
      addLog(`[ERROR] Scraping failed: ${err.message}`);
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleExportCSV = async () => {
    if (leads.length === 0) return;
    try {
      const resp = await fetch(`${API_BASE}/api/v1/meta-ads/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'meta_advertiser_leads.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('CSV export downloaded successfully!');
      } else {
        showToast('Failed to export CSV');
      }
    } catch (e) {
      showToast('Error exporting CSV');
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setCopiedText(text);
    showToast('Copied to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
      setCopiedText('');
    }, 2000);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Megaphone className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Meta Ad Library Extractor & Lead Finder
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Extract active advertisers directly from Facebook Ad Library. Find page/profile owners, and auto-scrape email addresses, phone numbers, and websites.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scraper Inputs Form */}
        <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-200">Extraction Setup</h3>
          </div>

          <form onSubmit={handleLaunchScraper} className="space-y-5">
            {/* Meta Ad Library URL Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Meta Ad Library Search URL
              </label>
              <textarea
                value={adsUrl}
                onChange={(e) => setAdsUrl(e.target.value)}
                placeholder="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&q=plumber..."
                rows={4}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
              />
              <span className="text-[10px] text-slate-500 block leading-tight">
                Perform a search in your browser on Meta Ad Library, copy the entire browser URL, and paste it here.
              </span>
            </div>

            {/* Profile extraction target */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Profile Extraction Target
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProfileType('facebook')}
                  className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    profileType === 'facebook'
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  <Facebook className="w-4 h-4" />
                  <span>Facebook Pages</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProfileType('instagram')}
                  className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    profileType === 'instagram'
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800'
                  }`}
                >
                  <Instagram className="w-4 h-4" />
                  <span>Instagram Handles</span>
                </button>
              </div>
            </div>



            {/* Limit Input */}
            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-300 block">
                Max Results to Scrape
              </label>
              <input
                type="number"
                min="5"
                max="5000"
                value={limit}
                onChange={(e) => setLimit(Math.min(5000, Math.max(5, parseInt(e.target.value) || 20)))}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 block leading-tight">
                Enter a value between 5 and 5000. Large requests (e.g. 2000+) will take longer to load and enrich.
              </span>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center justify-center space-x-2 ${
                loading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-[1.01]'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scraping Meta Ads ({progressPercent}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch Playwright Scraper</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Terminal Progress feed */}
        <div className="lg:col-span-2 bg-slate-950 border border-slate-850 rounded-2xl shadow-lg relative overflow-hidden flex flex-col h-[400px] lg:h-auto">
          {/* Terminal Titlebar */}
          <div className="bg-slate-900 border-b border-slate-850 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold text-slate-300">live_crawler_logs.sh</span>
            </div>
            {loading && (
              <div className="flex items-center space-x-2 text-xs font-mono text-indigo-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>ELAPSED: {formatTime(elapsedSeconds)}</span>
              </div>
            )}
          </div>

          {/* Progress Overlay bar */}
          {loading && (
            <div className="bg-slate-900/60 border-b border-slate-800/40 p-3 shrink-0">
              <div className="flex justify-between items-center text-xs font-mono mb-1">
                <span className="text-slate-400 truncate max-w-[80%]">{progressMessage}</span>
                <span className="text-indigo-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Logs feed output */}
          <div className="flex-1 p-4 font-mono text-[11px] text-slate-400 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {logFeed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-2 p-6">
                <Cpu className="w-10 h-10 text-slate-700" />
                <p>No active extraction logs. Fill in a Meta Ad Library URL on the left and start the scraper.</p>
              </div>
            ) : (
              logFeed.map((log, idx) => {
                let colorClass = 'text-slate-400';
                if (log.includes('[ERROR]')) colorClass = 'text-red-400';
                else if (log.includes('Finished') || log.includes('Successfully')) colorClass = 'text-emerald-400';
                else if (log.includes('Scraping') || log.includes('Crawling')) colorClass = 'text-indigo-300';
                
                return (
                  <div key={idx} className={`${colorClass} break-words leading-relaxed`}>
                    {log}
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>

      {/* Scraped Results Leads Table */}
      {leads.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>Extracted Advertisers ({leads.length})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Extracted contacts from public social profiles and landing page websites.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all flex items-center space-x-2 shadow-lg shadow-emerald-600/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export to CSV</span>
              </button>
              <button
                onClick={() => setLeads([])}
                className="p-2 rounded-xl border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all"
                title="Clear Results"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Advertiser Name</th>
                  <th className="p-4">Website</th>
                  <th className="p-4">Emails</th>
                  <th className="p-4">Phone Numbers</th>
                  <th className="p-4">Profiles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/40">
                {leads.map((lead, idx) => (
                  <tr key={idx} className="hover:bg-slate-850/30 transition-colors">
                    {/* Advertiser name */}
                    <td className="p-4">
                      <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                        <span>{lead.advertiser_name}</span>
                        {lead.profile_url && (
                          <a
                            href={lead.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-indigo-400 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Page ID: {lead.page_id || 'N/A'}
                      </span>
                    </td>

                    {/* Website */}
                    <td className="p-4">
                      {lead.website ? (
                        <div className="flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline truncate max-w-[200px]"
                          >
                            {lead.website.replace(/(^\w+:|^)\/\//, '').replace('www.', '')}
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">No website found</span>
                      )}
                    </td>

                    {/* Emails */}
                    <td className="p-4">
                      {lead.emails && lead.emails.length > 0 ? (
                        <div className="flex flex-col space-y-1">
                          {lead.emails.map((email, eIdx) => (
                            <div key={eIdx} className="flex items-center space-x-1.5">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="font-mono text-slate-300">{email}</span>
                              <button
                                onClick={() => handleCopy(email, `email_${idx}_${eIdx}`)}
                                className="text-slate-600 hover:text-slate-400"
                              >
                                {copiedId === `email_${idx}_${eIdx}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">No emails found</span>
                      )}
                    </td>

                    {/* Phone Numbers */}
                    <td className="p-4">
                      {lead.phones && lead.phones.length > 0 ? (
                        <div className="flex flex-col space-y-1">
                          {lead.phones.map((phone, pIdx) => (
                            <div key={pIdx} className="flex items-center space-x-1.5">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="font-mono text-slate-300">{phone}</span>
                              <button
                                onClick={() => handleCopy(phone, `phone_${idx}_${pIdx}`)}
                                className="text-slate-600 hover:text-slate-400"
                              >
                                {copiedId === `phone_${idx}_${pIdx}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">No phones found</span>
                      )}
                    </td>

                    {/* Social profiles */}
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {lead.social_links.facebook && (
                          <a
                            href={lead.social_links.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/10 hover:border-indigo-500/30 transition-all"
                            title="Facebook Page"
                          >
                            <Facebook className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {lead.social_links.instagram && (
                          <a
                            href={lead.social_links.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/10 hover:border-pink-500/30 transition-all"
                            title="Instagram Profile"
                          >
                            <Instagram className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
