import React, { useState, useRef, useEffect } from 'react';
import {
  Megaphone, Search, Globe, Sparkles, Copy, Check, ExternalLink,
  Download, RefreshCw, AlertCircle, Trash2, Cpu, Terminal, Play,
  Mail, Phone, CheckCircle, Upload, FileText, FileSpreadsheet, Filter
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
  const [inputMode, setInputMode] = useState('csv'); // 'csv' | 'urls'
  const [selectedFile, setSelectedFile] = useState(null);
  const [rawTextUrls, setRawTextUrls] = useState('');
  const [limit, setLimit] = useState(500);

  const [loading, setLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [logFeed, setLogFeed] = useState([]);
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState('');

  // Table Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [websiteFilter, setWebsiteFilter] = useState('all'); // 'all' | 'has_website' | 'no_website'
  const [instaFilter, setInstaFilter] = useState('all'); // 'all' | 'has_insta' | 'no_insta'
  const [emailFilter, setEmailFilter] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState(false);
  
  const [copiedId, setCopiedId] = useState(null);
  const [copiedText, setCopiedText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const terminalEndRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logFeed]);

  const addLog = (msg) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogFeed((prev) => [...prev, `[${timeStr}] ${msg}`]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleLaunchConverter = async (e) => {
    e.preventDefault();
    if (inputMode === 'csv' && !selectedFile) {
      setError('Please select or drag a CSV file to convert.');
      return;
    }
    if (inputMode === 'urls' && !rawTextUrls.trim()) {
      setError('Please paste at least one Facebook Page URL or ID.');
      return;
    }

    setLoading(true);
    setError('');
    setLeads([]);
    setLogFeed([]);
    setProgressPercent(5);
    setProgressMessage('Parsing input dataset & starting converter...');
    addLog('Converter initialized.');
    addLog(`Mode: ${inputMode.toUpperCase()}`);
    if (selectedFile) addLog(`File: ${selectedFile.name}`);
    addLog(`Limit: ${limit} advertiser profiles`);

    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const formData = new FormData();
      if (inputMode === 'csv' && selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('raw_text', rawTextUrls);
      }
      formData.append('limit', limit.toString());

      const resp = await fetch(`${API_BASE}/api/v1/convert-fb-to-insta`, {
        method: 'POST',
        body: formData
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
              if (data.lead) {
                setLeads(prevLeads => {
                  const exists = prevLeads.some(l => l.page_id === data.lead.page_id && l.advertiser_name === data.lead.advertiser_name);
                  if (exists) return prevLeads;
                  return [...prevLeads, data.lead];
                });
              }
            } else if (data.type === 'complete') {
              setProgressPercent(100);
              setProgressMessage(data.message || 'Conversion complete!');
              addLog(data.message || 'Conversion complete!');
              if (Array.isArray(data.leads)) {
                setLeads(data.leads);
                showToast(`Successfully extracted ${data.leads.length} Instagram leads!`);
              }
            }
          } catch (err) {
            // Ignore non-JSON or partial chunk lines
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during conversion.');
      addLog(`[ERROR] Conversion failed: ${err.message}`);
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Filtered Leads Calculation
  const displayedLeads = leads.filter(lead => {
    // Website filter
    if (websiteFilter === 'has_website' && !lead.website) return false;
    if (websiteFilter === 'no_website' && lead.website) return false;

    // Instagram filter
    if (instaFilter === 'has_insta' && !lead.instagram_handle) return false;
    if (instaFilter === 'no_insta' && lead.instagram_handle) return false;

    // Email & Phone filters
    if (emailFilter && (!lead.emails || lead.emails.length === 0)) return false;
    if (phoneFilter && (!lead.phones || lead.phones.length === 0)) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = lead.advertiser_name?.toLowerCase().includes(q);
      const matchPageId = lead.page_id?.toLowerCase().includes(q);
      const matchInsta = lead.instagram_handle?.toLowerCase().includes(q);
      const matchWebsite = lead.website?.toLowerCase().includes(q);
      const matchEmail = lead.emails?.some(e => e.toLowerCase().includes(q));
      return matchName || matchPageId || matchInsta || matchWebsite || matchEmail;
    }

    return true;
  });

  const handleExportCSV = async () => {
    const targetLeads = displayedLeads.length > 0 ? displayedLeads : leads;
    if (targetLeads.length === 0) return;
    try {
      const resp = await fetch(`${API_BASE}/api/v1/meta-ads/export-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetLeads)
      });
      if (resp.ok) {
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `instagram_leads_export_${targetLeads.length}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast(`Downloaded ${targetLeads.length} leads to CSV!`);
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
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-400">
                <Instagram className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                FB & Ad Library CSV to Instagram Converter
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Upload any Meta Ad Library CSV dataset or paste Facebook Page URLs. Converts Facebook Page IDs into verified Instagram handles, website links, and email contacts.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scraper Inputs Form */}
        <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-pink-400" />
              <h3 className="text-base font-semibold text-slate-200">Dataset Converter</h3>
            </div>
            
            {/* Input mode switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                type="button"
                onClick={() => setInputMode('csv')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                  inputMode === 'csv'
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV File</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('urls')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center space-x-1 ${
                  inputMode === 'urls'
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste URLs</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleLaunchConverter} className="space-y-5">
            {inputMode === 'csv' ? (
              /* CSV File Upload Dropzone */
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Upload Meta Ad Library CSV File
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                    selectedFile
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-800 hover:border-pink-500/40 bg-slate-950/60 hover:bg-slate-950'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="p-3 rounded-full bg-slate-900 text-pink-400 border border-slate-800">
                    <Upload className="w-6 h-6" />
                  </div>
                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-emerald-400 font-mono truncate max-w-[220px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to change
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-300">
                        Click or drag & drop CSV file
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Supports Apify, Meta Ad Library, or custom FB dataset CSV files.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Raw URLs Textarea */
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Facebook Page URLs or IDs (One per line)
                </label>
                <textarea
                  value={rawTextUrls}
                  onChange={(e) => setRawTextUrls(e.target.value)}
                  placeholder="https://www.facebook.com/61550243665702/&#10;https://www.facebook.com/scentsnstoriesintl/&#10;104086772515156..."
                  rows={6}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 resize-none font-mono"
                />
              </div>
            )}

            {/* Limit Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Max Advertisers to Convert
              </label>
              <input
                type="number"
                min="5"
                max="10000"
                value={limit}
                onChange={(e) => setLimit(Math.min(10000, Math.max(5, parseInt(e.target.value) || 100)))}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono"
              />
              <span className="text-[10px] text-slate-500 block leading-tight">
                Unique profile count limit (e.g. 500 - 10,000).
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
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-semibold tracking-wide shadow-lg shadow-pink-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Converting & Extracting ({progressPercent}%)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Convert & Extract Instagram IDs</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Terminal & Progress Feeds */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-pink-400" />
              <h3 className="text-base font-semibold text-slate-200 font-mono text-xs">
                &gt;_ live_converter_logs.sh
              </h3>
            </div>
            {loading && (
              <div className="flex items-center space-x-2 text-xs font-mono text-pink-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>ELAPSED: {formatTime(elapsedSeconds)}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {loading && (
            <div className="space-y-1 mb-4">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span className="truncate max-w-[300px]">{progressMessage}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Terminal log output feed */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-[320px] min-h-[260px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {logFeed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-2 p-6">
                <Cpu className="w-10 h-10 text-slate-700" />
                <p>No active logs. Upload a Meta Ad Library CSV file or paste Facebook URLs on the left to start converting.</p>
              </div>
            ) : (
              logFeed.map((log, idx) => {
                let colorClass = 'text-slate-400';
                if (log.includes('[ERROR]')) colorClass = 'text-red-400';
                else if (log.includes('Finished') || log.includes('Successfully')) colorClass = 'text-emerald-400';
                else if (log.includes('Instagram')) colorClass = 'text-pink-300';
                
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
      {(leads.length > 0 || loading) && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>
                  Converted Instagram & Business Leads ({displayedLeads.length}
                  {displayedLeads.length !== leads.length && ` / ${leads.length} total`})
                </span>
                {loading && (
                  <span className="inline-flex items-center space-x-1 text-[10px] bg-pink-500/10 border border-pink-500/30 text-pink-400 px-2 py-0.5 rounded-full font-mono animate-pulse ml-2">
                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                    Live Streaming
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Resolved Instagram handles, website links, and email contacts extracted from input profiles.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleExportCSV}
                disabled={displayedLeads.length === 0 && leads.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs transition-all flex items-center space-x-2 shadow-lg shadow-emerald-600/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export ({displayedLeads.length}) CSV</span>
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

          {/* Quick Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, handle, page ID, email..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Website Filter */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setWebsiteFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${websiteFilter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All Web
                </button>
                <button
                  type="button"
                  onClick={() => setWebsiteFilter('has_website')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 ${websiteFilter === 'has_website' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Globe className="w-3 h-3" />
                  <span>Has Web</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWebsiteFilter('no_website')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 ${websiteFilter === 'no_website' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <span>No Web</span>
                </button>
              </div>

              {/* Instagram Filter */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setInstaFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${instaFilter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All Insta
                </button>
                <button
                  type="button"
                  onClick={() => setInstaFilter('has_insta')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 ${instaFilter === 'has_insta' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Instagram className="w-3 h-3" />
                  <span>Has Insta</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInstaFilter('no_insta')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center space-x-1 ${instaFilter === 'no_insta' ? 'bg-red-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <span>No Insta</span>
                </button>
              </div>

              {/* Email & Phone Toggles */}
              <button
                type="button"
                onClick={() => setEmailFilter(!emailFilter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${emailFilter ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
              >
                ✉️ Has Email
              </button>
              <button
                type="button"
                onClick={() => setPhoneFilter(!phoneFilter)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${phoneFilter ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'}`}
              >
                📞 Has Phone
              </button>

              {(websiteFilter !== 'all' || instaFilter !== 'all' || emailFilter || phoneFilter || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setWebsiteFilter('all');
                    setInstaFilter('all');
                    setEmailFilter(false);
                    setPhoneFilter(false);
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 text-[10px] text-slate-500 hover:text-red-400 font-mono underline ml-1"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Advertiser Name</th>
                  <th className="p-4">Instagram Handle</th>
                  <th className="p-4">Website</th>
                  <th className="p-4">Emails</th>
                  <th className="p-4">Phone Numbers</th>
                  <th className="p-4">Profiles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 bg-slate-900/40">
                {displayedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        {loading ? (
                          <>
                            <RefreshCw className="w-5 h-5 text-pink-400 animate-spin" />
                            <p>Converting profiles live... Instagram handles & contacts will appear here in real-time.</p>
                          </>
                        ) : (
                          <>
                            <Filter className="w-5 h-5 text-slate-600" />
                            <p>No business leads match your selected filters.</p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedLeads.map((lead, idx) => (
                    <tr key={idx} className="hover:bg-slate-850/30 transition-colors">
                      {/* Advertiser name */}
                      <td className="p-4">
                        <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                          <span>{lead.advertiser_name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          Page ID: {lead.page_id || 'N/A'}
                        </span>
                      </td>

                      {/* Instagram Handle */}
                      <td className="p-4">
                        {lead.instagram_handle ? (
                          <div className="flex items-center space-x-2">
                            <a
                              href={lead.instagram_url || `https://instagram.com/${lead.instagram_handle}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 font-mono font-semibold hover:bg-pink-500/20 transition-all flex items-center space-x-1"
                            >
                              <Instagram className="w-3.5 h-3.5 shrink-0" />
                              <span>@{lead.instagram_handle}</span>
                              <ExternalLink className="w-3 h-3 text-pink-500/60" />
                            </a>
                            <button
                              onClick={() => handleCopy(`@${lead.instagram_handle}`, `insta_${idx}`)}
                              className="text-slate-600 hover:text-slate-400"
                              title="Copy Handle"
                            >
                              {copiedId === `insta_${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 font-mono">No Instagram found</span>
                        )}
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
                              className="text-indigo-400 hover:underline truncate max-w-[180px]"
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
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
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
                          {lead.social_links && lead.social_links.facebook && (
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
                          {lead.social_links && lead.social_links.instagram && (
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
