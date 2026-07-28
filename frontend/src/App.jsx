import React, { useState, useEffect } from 'react';
import {
  BarChart3, LayoutDashboard, Database, Settings as SettingsIcon, Bell, Search,
  Moon, Sun, CheckCircle2, AlertTriangle, Play, RefreshCw, Trash2, FileDown,
  ArrowUpRight, ExternalLink, ShieldCheck, Accessibility as A11yIcon, Zap, Sparkles,
  Smartphone, Tablet, Laptop, Compass, X, AlertOctagon, HelpCircle, ChevronRight, FileSpreadsheet, FileJson,
  Mail, Send, Edit3, Check, Bookmark, Star
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (typeof window !== 'undefined' ? window.location.origin : '')
);


function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dark, setDark] = useState(true);

  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [results, setResults] = useState([]);

  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [manualJobName, setManualJobName] = useState('');
  const [manualDomains, setManualDomains] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const [settings, setSettings] = useState({
    concurrency: 3,
    timeout: 30,
    retry_count: 2,
    screenshot_resolution_desktop: '1920x1080',
    dark_mode: 1,
    export_format: 'csv',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_sender_name: 'Audit Team',
    smtp_sender_email: '',
    smtp_use_tls: 1,
    email_template_subject: 'Website Audit Report for {domain}',
    email_template_body: 'Hi there,\n\nWe audited your website {domain} and found some performance and SEO issues. Your overall score is {score_overall}/100.\n\nBest regards,\nAudit Team'
  });

  const [testingSMTP, setTestingSMTP] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState(null);

  const [editingContactId, setEditingContactId] = useState(null);
  const [editingContactValue, setEditingContactValue] = useState('');

  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [outreachResult, setOutreachResult] = useState(null);
  const [outreachRecipient, setOutreachRecipient] = useState('');
  const [outreachSubject, setOutreachSubject] = useState('');
  const [outreachBody, setOutreachBody] = useState('');
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [outreachError, setOutreachError] = useState('');

  // Keyword Lead Finder state
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMaxResults, setSearchMaxResults] = useState(15);
  const [searchOutdatedOnly, setSearchOutdatedOnly] = useState(true);
  const [searchingLeads, setSearchingLeads] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [savingLeadsJob, setSavingLeadsJob] = useState(false);
  const [jobSaveSuccess, setJobSaveSuccess] = useState('');

  // Shortlisted leads state
  const [shortlistedLeads, setShortlistedLeads] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('shortlisted_leads') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('shortlisted_leads', JSON.stringify(shortlistedLeads));
  }, [shortlistedLeads]);

  const handleToggleShortlist = (lead) => {
    const exists = shortlistedLeads.some(item => item.domain === lead.domain);
    if (exists) {
      setShortlistedLeads(shortlistedLeads.filter(item => item.domain !== lead.domain));
    } else {
      setShortlistedLeads([...shortlistedLeads, lead]);
    }
  };


  const handleSaveLeadsAsJob = async () => {
    if (!searchResults || searchResults.length === 0) return;
    setSavingLeadsJob(true);
    setJobSaveSuccess('');
    try {
      const r = await fetch(`${API_BASE}/api/v1/search-leads/save-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_name: `Leads: ${searchKeyword || 'Keyword Search'}`,
          leads: searchResults
        })
      });
      if (r.ok) {
        const data = await r.json();
        setJobSaveSuccess(`Saved ${data.saved_count} leads to Jobs! Redirecting...`);
        loadJobs();
        loadStats();
        loadResults();
        setTimeout(() => {
          setActiveTab('jobs');
          setJobSaveSuccess('');
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingLeadsJob(false);
    }
  };


  const handleSearchLeads = async (e) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return;
    setSearchingLeads(true);
    setSearchError('');
    try {
      const r = await fetch(`${API_BASE}/api/v1/search-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKeyword,
          max_results: searchMaxResults,
          outdated_only: searchOutdatedOnly
        })
      });
      if (r.ok) {
        const data = await r.json();
        setSearchResults(data);
      } else {
        const err = await r.json();
        setSearchError(err.detail || 'Search failed.');
      }
    } catch (ex) {
      setSearchError('Failed to connect to backend server.');
    } finally {
      setSearchingLeads(false);
    }
  };


  const handleTestSMTP = async () => {
    setTestingSMTP(true);
    setSmtpTestResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/settings/test-smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await r.json();
      if (r.ok) {
        setSmtpTestResult({ success: true, message: data.message });
      } else {
        setSmtpTestResult({ success: false, message: data.detail || 'Test failed.' });
      }
    } catch (e) {
      setSmtpTestResult({ success: false, message: 'Network error trying to contact SMTP server.' });
    } finally {
      setTestingSMTP(false);
    }
  };

  const handleSaveContactEmail = async (resultId, emailValue) => {
    try {
      const r = await fetch(`${API_BASE}/api/results/${resultId}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_email: emailValue })
      });
      if (r.ok) {
        setEditingContactId(null);
        loadResults();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenOutreach = (res) => {
    setOutreachResult(res);
    setOutreachRecipient(res.contact_email || '');
    setOutreachError('');
    
    const criticalIssues = res.issues ? res.issues.filter(i => i.severity === 'High').map(i => i.problem) : [];
    const warningIssues = res.issues ? res.issues.filter(i => i.severity === 'Medium').map(i => i.problem) : [];
    
    let issuesSummary = '';
    if (criticalIssues.length > 0) {
      issuesSummary += "Critical Issues:\n" + criticalIssues.slice(0, 5).map(ci => `- ${ci}`).join('\n') + '\n';
    }
    if (warningIssues.length > 0) {
      issuesSummary += "\nWarnings:\n" + warningIssues.slice(0, 5).map(wi => `- ${wi}`).join('\n');
    }
    if (!issuesSummary) {
      issuesSummary = "No major issues found.";
    }

    const context = {
      domain: res.domain,
      score_overall: res.score_overall,
      score_seo: res.score_seo,
      score_performance: res.score_performance,
      score_accessibility: res.score_accessibility,
      score_security: res.score_security,
      score_design: res.score_design,
      issues_summary: issuesSummary
    };

    const render = (template) => {
      if (!template) return '';
      let t = template;
      Object.entries(context).forEach(([k, v]) => {
        t = t.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
      return t;
    };

    setOutreachSubject(render(settings.email_template_subject));
    setOutreachBody(render(settings.email_template_body));
    setShowOutreachModal(true);
  };

  const handleSendOutreach = async (e) => {
    e.preventDefault();
    if (!outreachRecipient.trim()) return;
    setSendingOutreach(true);
    setOutreachError('');
    try {
      const r = await fetch(`${API_BASE}/api/results/${outreachResult.id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: outreachRecipient,
          subject: outreachSubject,
          body: outreachBody
        })
      });
      if (r.ok) {
        setShowOutreachModal(false);
        loadResults();
        alert('Outreach email sent successfully!');
      } else {
        const err = await r.json();
        setOutreachError(err.detail || 'Failed to send outreach email.');
      }
    } catch (ex) {
      setOutreachError('Network error sending outreach.');
    } finally {
      setSendingOutreach(false);
    }
  };

  const [filterDomain, setFilterDomain] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterScore, setFilterScore] = useState('All');
  const [sortOrder, setSortOrder] = useState('Newest');

  const loadStats = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/dashboard/stats`);
      if (r.ok) {
        const d = await r.json();
        setStats(d);
      }
    } catch (e) { console.error(e); }
  };

  const loadJobs = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/jobs`);
      if (r.ok) {
        const d = await r.json();
        setJobs(d);
      }
    } catch (e) { console.error(e); }
  };

  const loadResults = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/results`);
      if (r.ok) {
        const d = await r.json();
        setResults(d);
      }
    } catch (e) { console.error(e); }
  };

  const loadSettings = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/settings`);
      if (r.ok) {
        const d = await r.json();
        setSettings(d);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadStats();
    loadJobs();
    loadResults();
    loadSettings();

    const timer = setInterval(() => {
      loadStats();
      loadJobs();
      loadResults();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualDomains.trim()) return;
    setSubmittingManual(true);
    setManualError('');
    const domainsArray = manualDomains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
    try {
      const r = await fetch(`${API_BASE}/api/jobs/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualJobName || 'Manual Audit Job',
          domains: domainsArray
        })
      });
      if (r.ok) {
        setManualJobName('');
        setManualDomains('');
        setShowAuditModal(false);
        setActiveTab('jobs');
        loadJobs();
      } else {
        const err = await r.json();
        setManualError(err.detail || 'Failed to submit domains');
      }
    } catch (ex) {
      setManualError('Network error starting audit');
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    try {
      await fetch(`${API_BASE}/api/jobs/${jobId}`, { method: 'DELETE' });
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(null);
      }
      if (viewingReport && viewingReport.job_id === jobId) {
        setViewingReport(null);
      }
      if (selectedResult && selectedResult.job_id === jobId) {
        setSelectedResult(null);
      }
      loadJobs();
      loadStats();
      loadResults();
    } catch (e) { console.error(e); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const r = await fetch(`${API_BASE}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (r.ok) {
        alert('Settings saved successfully!');
      }
    } catch (e) { console.error(e); }
  };

  const getRating = (score) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (score >= 80) return { label: 'Good', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
    if (score >= 70) return { label: 'Average', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    if (score >= 60) return { label: 'Poor', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
    return { label: 'Critical', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const filteredResults = results.filter(r => {
    const matchesDomain = r.domain.toLowerCase().includes(filterDomain.toLowerCase());
    const matchesStatus = filterStatus === 'All' || r.status === filterStatus;
    const matchesScore = filterScore === 'All' ||
      (filterScore === 'Excellent' && r.score_overall >= 90) ||
      (filterScore === 'Good' && r.score_overall >= 80 && r.score_overall < 90) ||
      (filterScore === 'Average' && r.score_overall >= 70 && r.score_overall < 80) ||
      (filterScore === 'Poor' && r.score_overall >= 60 && r.score_overall < 70) ||
      (filterScore === 'Critical' && r.score_overall < 60);
    return matchesDomain && matchesStatus && matchesScore;
  }).sort((a, b) => {
    if (sortOrder === 'Highest Score') return b.score_overall - a.score_overall;
    if (sortOrder === 'Lowest Score') return a.score_overall - b.score_overall;
    if (sortOrder === 'Highest Design') return b.score_design - a.score_design;
    if (sortOrder === 'Lowest Design') return a.score_design - b.score_design;
    if (sortOrder === 'Oldest') return new Date(a.created_at) - new Date(b.created_at);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className={`flex min-h-screen ${dark ? 'bg-neutral-950 text-neutral-100' : 'bg-neutral-50 text-neutral-900'} transition-colors duration-200`}>
      <aside className={`w-64 border-r ${dark ? 'border-neutral-800 bg-neutral-950' : 'border-neutral-200 bg-white'} flex flex-col`}>
        <div className="p-6 flex items-center gap-3 border-b border-neutral-800/10">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-sm">Audit Pipeline</h1>
            <p className="text-xs text-neutral-500">Lead Qualifier System</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'jobs', label: 'Jobs', icon: Play },
            { id: 'results', label: 'Results', icon: Database },
            { id: 'finder', label: 'Keyword Lead Finder', icon: Search },
            { id: 'shortlist', label: `Shortlisted (${shortlistedLeads.length})`, icon: Bookmark },
            { id: 'email', label: 'Email Outreach', icon: Mail },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setViewingReport(null); setSelectedJob(null); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                  : dark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
              >
                <Icon className="h-4.5 w-4.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-neutral-500 font-medium">Worker Active</span>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className={`p-2 rounded-lg border ${dark ? 'border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200' : 'border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <header className={`sticky top-0 z-10 px-8 py-4 border-b flex items-center justify-between backdrop-blur-md ${dark ? 'border-neutral-800 bg-neutral-950/80' : 'border-neutral-200 bg-white/80'}`}>
          <div className="flex items-center gap-3 w-96 relative">
            <Search className="absolute left-3 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Quick search domain..."
              value={filterDomain}
              onChange={(e) => {
                setFilterDomain(e.target.value);
                if (activeTab !== 'results') setActiveTab('results');
              }}
              className={`w-full pl-10 pr-4 py-1.5 rounded-lg text-sm outline-none border transition-all ${dark
                ? 'bg-neutral-900/50 border-neutral-800 text-neutral-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                : 'bg-neutral-100 border-neutral-200 text-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                }`}
            />
          </div>
          <div className="flex items-center gap-4">
            <button className={`p-2 rounded-lg border relative ${dark ? 'border-neutral-800 hover:bg-neutral-900 text-neutral-400' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-600'}`}>
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500" />
            </button>
            <div className="flex items-center gap-3 border-l border-neutral-800/10 pl-4">
              <div className="h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-200">
                AD
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold">Admin Developer</p>
                <p className="text-[10px] text-neutral-500">Agency Partner</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 min-h-0">
          {viewingReport ? (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <button onClick={() => setViewingReport(null)} className="text-xs text-indigo-400 font-semibold mb-2 hover:underline flex items-center gap-1">
                    ← Back to Results
                  </button>
                  <h2 className="text-2xl font-bold tracking-tight">Website Audit Report</h2>
                  <p className="text-neutral-500 mt-1 flex items-center gap-2">
                    {viewingReport.domain}
                    <a href={`https://${viewingReport.domain}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5 text-xs">
                      Visit site <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
                <div className="flex gap-3">
                  <a
                    href={`${API_BASE}/api/jobs/${viewingReport.job_id}/export?format=csv`}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-neutral-700"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Export CSV
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                  <h3 className="text-sm text-neutral-500 font-medium mb-4">Overall Audit Score</h3>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-36 h-36 transform -rotate-90">
                      <circle cx="72" cy="72" r="60" strokeWidth="8" stroke={dark ? '#262626' : '#e5e5e5'} fill="transparent" />
                      <circle cx="72" cy="72" r="60" strokeWidth="8" stroke="#4f46e5" fill="transparent"
                        strokeDasharray={377}
                        strokeDashoffset={377 - (377 * viewingReport.score_overall) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-3xl font-black tracking-tight">{Math.round(viewingReport.score_overall)}</div>
                  </div>
                  <div className={`mt-6 px-3 py-1 rounded-full text-xs font-bold border ${getRating(viewingReport.score_overall).color}`}>
                    {getRating(viewingReport.score_overall).label} Rating
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border col-span-1 lg:col-span-2 ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                  <h3 className="text-sm text-neutral-500 font-medium mb-4">Sub-category Breakdown</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" radius="80%" data={[
                        { subject: 'SEO', A: viewingReport.score_seo },
                        { subject: 'Performance', A: viewingReport.score_performance },
                        { subject: 'A11y', A: viewingReport.score_accessibility },
                        { subject: 'Security', A: viewingReport.score_security },
                        { subject: 'Responsive', A: viewingReport.score_responsive },
                        { subject: 'Design', A: viewingReport.score_design },
                      ]}>
                        <PolarGrid stroke={dark ? '#404040' : '#d4d4d4'} />
                        <PolarAngleAxis dataKey="subject" stroke={dark ? '#a3a3a3' : '#525252'} tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke={dark ? '#404040' : '#d4d4d4'} />
                        <Radar name="Scores" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold tracking-tight">Responsive Capture</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: 'Desktop (1920px)', path: viewingReport.screenshot_path_desktop, icon: Laptop, ratio: 'aspect-video' },
                    { title: 'Tablet (768px)', path: viewingReport.screenshot_path_tablet, icon: Tablet, ratio: 'aspect-[3/4] w-2/3 mx-auto' },
                    { title: 'Mobile (375px)', path: viewingReport.screenshot_path_mobile, icon: Smartphone, ratio: 'aspect-[9/16] w-1/2 mx-auto' }
                  ].map((scr, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border flex flex-col ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200'}`}>
                      <div className="flex items-center gap-2 mb-3 text-xs text-neutral-500 font-semibold">
                        <scr.icon className="h-4 w-4 text-indigo-400" />
                        {scr.title}
                      </div>
                      <div className={`rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center ${scr.ratio}`}>
                        {scr.path ? (
                          <img src={`${API_BASE}${scr.path}`} alt={scr.title} className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500 cursor-zoom-in" onClick={() => window.open(`${API_BASE}${scr.path}`)} />
                        ) : (
                          <span className="text-[10px] text-neutral-600">Capture unavailable</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-bold tracking-tight">Identified Issues & Action Plan</h3>
                {viewingReport.issues && viewingReport.issues.length > 0 ? (
                  <div className="space-y-4">
                    {viewingReport.issues.map((iss, index) => (
                      <div
                        key={index}
                        className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${dark ? 'bg-neutral-900/30 border-neutral-800/80 hover:border-neutral-700/50' : 'bg-white border-neutral-200 hover:shadow-md'
                          }`}
                      >
                        <div className={`p-2.5 rounded-xl border ${iss.severity === 'High'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : iss.severity === 'Medium'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
                          {iss.severity === 'High' ? <AlertOctagon className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tracking-wider text-indigo-400 uppercase">{iss.category}</span>
                            <span className="text-xs font-semibold text-neutral-500">•</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${iss.severity === 'High'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : iss.severity === 'Medium'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                              }`}>{iss.severity} Impact</span>
                          </div>
                          <h4 className="font-bold text-sm tracking-tight text-neutral-100">{iss.problem}</h4>
                          <p className="text-xs text-neutral-400 leading-relaxed"><strong className="text-neutral-300">Why it matters:</strong> {iss.why_it_matters}</p>
                          <p className="text-xs text-neutral-400 leading-relaxed"><strong className="text-neutral-300">Actionable Fix:</strong> {iss.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-2xl">
                    No audit issues identified. Excellent job!
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'dashboard' ? (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                  { label: 'Total Websites', value: stats?.total_websites || 0, icon: Database, color: 'text-indigo-400' },
                  { label: 'Completed', value: stats?.completed || 0, icon: CheckCircle2, color: 'text-emerald-400' },
                  { label: 'Running', value: stats?.running || 0, icon: RefreshCw, color: 'text-indigo-400' },
                  { label: 'Failed Audits', value: stats?.failed || 0, icon: AlertOctagon, color: 'text-rose-400' },
                  { label: 'Average Score', value: stats ? `${stats.average_score}/100` : '0/100', icon: Sparkles, color: 'text-indigo-400' }
                ].map((card, idx) => (
                  <div key={idx} className={`p-6 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800/80' : 'bg-white border-neutral-200 shadow-sm'} flex flex-col justify-between h-32`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500 font-medium">{card.label}</span>
                      <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
                    </div>
                    <span className="text-2xl font-bold tracking-tight">{card.value}</span>
                  </div>
                ))}
              </div>

              <div className={`p-6 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'} max-w-xl flex flex-col justify-between`}>
                <div>
                  <h3 className="text-sm font-bold tracking-tight mb-2">Audit New Websites</h3>
                  <p className="text-xs text-neutral-500 mb-4">Manually enter domain names to run a full diagnostic audit on SEO, performance, accessibility, security, and design responsiveness.</p>
                </div>
                <button
                  onClick={() => setShowAuditModal(true)}
                  className="w-fit px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white shadow-lg shadow-indigo-600/10 flex items-center gap-2 transition-all hover:scale-[1.02]"
                >
                  <Play className="h-3.5 w-3.5" /> Start New Audit
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`p-6 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                  <h3 className="text-sm font-bold tracking-tight mb-6">Score Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats ? Object.entries(stats.score_distribution).map(([k, v]) => ({ name: k, count: v })) : []}>
                        <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#262626' : '#f5f5f5'} />
                        <XAxis dataKey="name" stroke={dark ? '#737373' : '#525252'} tick={{ fontSize: 11 }} />
                        <YAxis stroke={dark ? '#737373' : '#525252'} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                  <h3 className="text-sm font-bold tracking-tight mb-6">Category Average Scores</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { name: 'SEO', score: stats?.average_seo || 0 },
                        { name: 'Perf', score: stats?.average_perf || 0 },
                        { name: 'A11y', score: stats?.average_a11y || 0 },
                        { name: 'Sec', score: stats?.average_sec || 0 },
                        { name: 'Design', score: stats?.average_design || 0 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#262626' : '#f5f5f5'} />
                        <XAxis dataKey="name" stroke={dark ? '#737373' : '#525252'} tick={{ fontSize: 11 }} />
                        <YAxis stroke={dark ? '#737373' : '#525252'} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="score" stroke="#818cf8" fill="#4f46e5" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className={`p-6 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                <h3 className="text-sm font-bold tracking-tight mb-4">Top Issues Found Across Sites</h3>
                <div className="space-y-3">
                  {stats?.top_issues && stats.top_issues.length > 0 ? stats.top_issues.map((iss, index) => (
                    <div key={index} className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-800/10 bg-neutral-900/20">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 block mb-0.5">{iss.category}</span>
                        <span className="text-xs font-semibold text-neutral-200">{iss.problem}</span>
                      </div>
                      <span className="text-xs font-bold bg-neutral-800 px-3 py-1 rounded-full border border-neutral-700/50">{iss.count} occurrences</span>
                    </div>
                  )) : (
                    <p className="text-xs text-neutral-500 text-center py-6">No audit data available yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'jobs' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold tracking-tight">Audit Jobs History</h2>
              </div>

              <div className={`border rounded-2xl overflow-hidden ${dark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-200 bg-white shadow-sm'}`}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-neutral-800 text-neutral-400 bg-neutral-900/30' : 'border-neutral-200 text-neutral-600 bg-neutral-50'}`}>
                      <th className="p-4 font-semibold">Job Name</th>
                      <th className="p-4 font-semibold">Date Created</th>
                      <th className="p-4 font-semibold">Websites</th>
                      <th className="p-4 font-semibold">Progress</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/10">
                    {jobs.map(job => (
                      <tr key={job.id} className="hover:bg-neutral-900/10 transition-colors">
                        <td className="p-4 font-semibold text-neutral-200">{job.name}</td>
                        <td className="p-4 text-neutral-400">{new Date(job.created_at).toLocaleString()}</td>
                        <td className="p-4 font-medium">
                          <span className="text-emerald-400">{job.completed_websites}</span> /
                          <span className="text-indigo-400"> {job.running_websites} running</span> /
                          <span className="text-rose-400"> {job.failed_websites} failed</span> ({job.total_websites} total)
                        </td>
                        <td className="p-4 w-64">
                          <div className="flex items-center gap-3">
                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                              <div
                                className="h-full bg-indigo-500 transition-all duration-300"
                                style={{ width: `${((job.completed_websites + job.failed_websites) / job.total_websites) * 100}%` }}
                              />
                            </div>
                            <span className="font-bold text-[10px]">
                              {Math.round(((job.completed_websites + job.failed_websites) / job.total_websites) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${job.status === 'finished'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : job.status === 'running'
                              ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 animate-pulse'
                              : 'text-neutral-400 bg-neutral-800 border-neutral-700'
                            }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedJob(job); setActiveTab('results'); }}
                            className="p-1.5 rounded-lg border border-neutral-800/80 hover:bg-neutral-900 text-indigo-400 hover:text-indigo-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <a
                            href={`${API_BASE}/api/jobs/${job.id}/export?format=csv`}
                            className="p-1.5 rounded-lg border border-neutral-800/80 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-200"
                            title="Download CSV"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="p-1.5 rounded-lg border border-neutral-800/80 hover:bg-neutral-900 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'results' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">Audit Results</h2>
                  {selectedJob && (
                    <span className="text-xs bg-neutral-800 border border-neutral-700 px-3 py-1 rounded-full text-indigo-300 flex items-center gap-1.5">
                      Job: {selectedJob.name}
                      <button onClick={() => setSelectedJob(null)} className="hover:text-white font-bold">×</button>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedJob ? selectedJob.id : 'All'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'All') {
                        setSelectedJob(null);
                      } else {
                        const job = jobs.find(j => j.id === parseInt(val));
                        setSelectedJob(job || null);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200'}`}
                  >
                    <option value="All">All Jobs</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>{job.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200'}`}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Finished">Finished</option>
                    <option value="Failed">Failed</option>
                    <option value="Queued">Queued</option>
                    <option value="Fetching">Fetching</option>
                    <option value="Crawling">Crawling</option>
                    <option value="Screenshot">Screenshot</option>
                  </select>

                  <select
                    value={filterScore}
                    onChange={(e) => setFilterScore(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200'}`}
                  >
                    <option value="All">All Scores</option>
                    <option value="Excellent">Excellent (90-100)</option>
                    <option value="Good">Good (80-89)</option>
                    <option value="Average">Average (70-79)</option>
                    <option value="Poor">Poor (60-69)</option>
                    <option value="Critical">Critical (&lt; 60)</option>
                  </select>

                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-300' : 'bg-white border-neutral-200'}`}
                  >
                    <option value="Newest">Newest</option>
                    <option value="Oldest">Oldest</option>
                    <option value="Highest Score">Highest Score</option>
                    <option value="Lowest Score">Lowest Score</option>
                    <option value="Highest Design">Highest Design Score</option>
                    <option value="Lowest Design">Lowest Design Score</option>
                  </select>
                </div>
              </div>

              <div className={`border rounded-2xl overflow-hidden ${dark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-200 bg-white shadow-sm'}`}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${dark ? 'border-neutral-800 text-neutral-400 bg-neutral-900/30' : 'border-neutral-200 text-neutral-600 bg-neutral-50'}`}>
                      <th className="p-4 font-semibold">Domain</th>
                      <th className="p-4 font-semibold">Thumbnail</th>
                      <th className="p-4 font-semibold">Overall</th>
                      <th className="p-4 font-semibold">Contact Email</th>
                      <th className="p-4 font-semibold">Outreach</th>
                      <th className="p-4 font-semibold">SEO</th>
                      <th className="p-4 font-semibold">Performance</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/10">
                    {filteredResults.filter(r => !selectedJob || r.job_id === selectedJob.id).map(res => (
                      <tr key={res.id} className="hover:bg-neutral-900/10 transition-colors">
                        <td className="p-4 font-bold text-neutral-200">
                          <a 
                            href={res.domain.startsWith('http') ? res.domain : `https://${res.domain}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-indigo-400 hover:underline inline-flex items-center gap-1 transition-colors"
                          >
                            {res.domain}
                            <ExternalLink className="h-3 w-3 text-neutral-500 hover:text-indigo-400" />
                          </a>
                        </td>
                        <td className="p-4">
                          {res.screenshot_path_desktop ? (
                            <div className="h-8 w-12 rounded bg-neutral-800 border border-neutral-700 overflow-hidden cursor-pointer hover:border-indigo-500 transition-all" onClick={() => window.open(`${API_BASE}${res.screenshot_path_desktop}`)}>
                              <img src={`${API_BASE}${res.screenshot_path_desktop}`} alt="" className="w-full h-full object-cover object-top" />
                            </div>
                          ) : (
                            <span className="text-[10px] text-neutral-600">No capture</span>
                          )}
                        </td>
                        <td className="p-4 font-bold">{res.status === 'Finished' ? Math.round(res.score_overall) : '-'}</td>
                        <td className="p-4">
                          {editingContactId === res.id ? (
                            <div className="flex items-center gap-1">
                              <input 
                                type="email" 
                                value={editingContactValue} 
                                onChange={(e) => setEditingContactValue(e.target.value)}
                                className={`px-2 py-1 rounded text-xs outline-none border w-36 ${dark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-100 border-neutral-300'}`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveContactEmail(res.id, editingContactValue);
                                  if (e.key === 'Escape') setEditingContactId(null);
                                }}
                                autoFocus
                              />
                              <button onClick={() => handleSaveContactEmail(res.id, editingContactValue)} className="p-1 text-emerald-400 hover:text-emerald-300">
                                <Check className="h-3 w-3" />
                              </button>
                              <button onClick={() => setEditingContactId(null)} className="p-1 text-neutral-400 hover:text-neutral-300">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span className={res.contact_email ? (dark ? 'text-neutral-300' : 'text-neutral-700') : 'text-neutral-500 italic'}>
                                {res.contact_email || 'No email found'}
                              </span>
                              <button 
                                onClick={() => { setEditingContactId(res.id); setEditingContactValue(res.contact_email || ''); }}
                                className="p-1 text-neutral-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit Email"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span 
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-help ${
                              res.outreach_status === 'Sent'
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                : res.outreach_status === 'Sending'
                                  ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 animate-pulse'
                                  : res.outreach_status === 'Failed'
                                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                    : 'text-neutral-500 bg-neutral-800/20 border-neutral-700/30'
                            }`}
                            title={res.outreach_error ? `Error: ${res.outreach_error}` : res.outreach_sent_at ? `Sent at: ${new Date(res.outreach_sent_at).toLocaleString()}` : 'Not contacted yet'}
                          >
                            {res.outreach_status || 'Unsent'}
                          </span>
                        </td>
                        <td className="p-4">{res.status === 'Finished' ? Math.round(res.score_seo) : '-'}</td>
                        <td className="p-4">{res.status === 'Finished' ? Math.round(res.score_performance) : '-'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${res.status === 'Finished'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : res.status === 'Failed'
                              ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                              : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                            }`}>
                            {res.status}
                          </span>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-2">
                          {res.status === 'Finished' && (
                            <>
                              <button
                                onClick={() => handleOpenOutreach(res)}
                                className={`p-1.5 rounded-lg border ${dark ? 'border-neutral-800 hover:bg-neutral-900 text-indigo-400 hover:text-indigo-300' : 'border-neutral-200 hover:bg-neutral-100 text-indigo-600 hover:text-indigo-500'}`}
                                title="Send Email Outreach"
                              >
                                <Mail className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setViewingReport(res)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white rounded-lg shadow-md shadow-indigo-600/10"
                              >
                                Open Report
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'finder' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Keyword Lead Finder</h2>
                  <p className="text-xs text-neutral-400 mt-1">
                    Discover local businesses, audit site design outdatedness, and extract Email, Instagram, Facebook, WhatsApp & LinkedIn contacts.
                  </p>
                </div>
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveLeadsAsJob}
                      disabled={savingLeadsJob}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg flex items-center gap-2 text-white shadow-lg shadow-indigo-600/20 transition-all"
                    >
                      <Database className="h-4 w-4" /> {savingLeadsJob ? 'Saving to Jobs...' : `Save ${searchResults.length} Leads to Jobs`}
                    </button>
                    <button
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," 
                          + ["Domain,Title,URL,Design Score,Outdated,Emails,Instagram,Facebook,LinkedIn,WhatsApp,Phones"].join(",") + "\n"
                          + searchResults.map(r => [
                              `"${r.domain}"`,
                              `"${(r.title || '').replace(/"/g, '""')}"`,
                              `"${r.url}"`,
                              r.score_design,
                              r.is_outdated ? "Yes" : "No",
                              `"${(r.contacts.emails || []).join('; ')}"`,
                              `"${(r.contacts.instagram || []).join('; ')}"`,
                              `"${(r.contacts.facebook || []).join('; ')}"`,
                              `"${(r.contacts.linkedin || []).join('; ')}"`,
                              `"${(r.contacts.whatsapp || []).join('; ')}"`,
                              `"${(r.contacts.phones || []).join('; ')}"`
                            ].join(",")).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `leads_${searchKeyword.replace(/\s+/g, '_')}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-2 border border-neutral-700 text-neutral-200"
                    >
                      <FileDown className="h-4 w-4 text-emerald-400" /> Export CSV ({searchResults.length})
                    </button>
                  </div>
                )}
              </div>

              {jobSaveSuccess && (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {jobSaveSuccess}
                </div>
              )}

              {/* Search Control Card */}
              <form onSubmit={handleSearchLeads} className={`p-6 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'} space-y-4`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs text-neutral-400 font-semibold block">Search Keyword / Niche & City</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                      <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder='e.g. "plumbers in Miami", "dentist Chicago"'
                        className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200 focus:border-indigo-500' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-indigo-500'}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-semibold block">Max Results (Large Crawling Support)</label>
                    <select
                      value={searchMaxResults}
                      onChange={(e) => setSearchMaxResults(parseInt(e.target.value))}
                      className={`w-full px-3 py-2 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-900'}`}
                    >
                      <option value={10}>10 Sites</option>
                      <option value={25}>25 Sites</option>
                      <option value={50}>50 Sites</option>
                      <option value={100}>100 Sites</option>
                      <option value={250}>250 Sites</option>
                      <option value={500}>500 Sites</option>
                      <option value={1000}>1000 Sites</option>
                    </select>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={searchingLeads || !searchKeyword.trim()}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 transition-all"
                    >
                      {searchingLeads ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Crawling & Auditing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" /> Find Outdated Leads
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/10">
                  <input
                    type="checkbox"
                    id="outdatedOnlyToggle"
                    checked={searchOutdatedOnly}
                    onChange={(e) => setSearchOutdatedOnly(e.target.checked)}
                    className="rounded border-neutral-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="outdatedOnlyToggle" className="text-xs text-neutral-400 font-medium cursor-pointer">
                    Show Outdated / High-Opportunity Designs Only (Design Score &lt; 65)
                  </label>
                </div>
              </form>

              {searchError && (
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> {searchError}
                </div>
              )}

              {/* Results Table */}
              {searchResults.length > 0 ? (
                <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`border-b ${dark ? 'border-neutral-800 bg-neutral-900/60 text-neutral-400' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}>
                          <th className="p-4 font-semibold">Business / Domain</th>
                          <th className="p-4 font-semibold">Design Score</th>
                          <th className="p-4 font-semibold">Outdated Issues</th>
                          <th className="p-4 font-semibold">Extracted Contacts</th>
                          <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dark ? 'divide-neutral-800/60 text-neutral-300' : 'divide-neutral-200 text-neutral-700'}`}>
                        {searchResults.map((lead, idx) => (
                          <tr key={idx} className={`${dark ? 'hover:bg-neutral-900/30' : 'hover:bg-neutral-50/50'} transition-colors`}>
                            <td className="p-4">
                              <p className="font-bold text-sm text-neutral-100">{lead.title || lead.domain}</p>
                              <a href={lead.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-0.5">
                                {lead.domain} <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${lead.score_design >= 65 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                  {lead.score_design}/100
                                </span>
                                {lead.is_outdated && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Outdated Design
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 max-w-xs">
                              <div className="flex flex-wrap gap-1">
                                {(lead.outdated_reasons || []).slice(0, 3).map((r, rIdx) => (
                                  <span key={rIdx} className="text-[10px] bg-neutral-800 text-neutral-350 px-2 py-0.5 rounded border border-neutral-700/50">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="space-y-1.5 text-xs">
                                {lead.contacts.emails && lead.contacts.emails.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                    <Mail className="h-3.5 w-3.5" />
                                    <a href={`mailto:${lead.contacts.emails[0]}`} className="hover:underline">
                                      {lead.contacts.emails[0]}
                                    </a>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 pt-0.5">
                                  {lead.contacts.instagram && lead.contacts.instagram.length > 0 && (
                                    <a href={lead.contacts.instagram[0]} target="_blank" rel="noreferrer" className="text-pink-400 hover:text-pink-300 font-semibold text-[10px] bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">
                                      Instagram
                                    </a>
                                  )}
                                  {lead.contacts.facebook && lead.contacts.facebook.length > 0 && (
                                    <a href={lead.contacts.facebook[0]} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 font-semibold text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                      Facebook
                                    </a>
                                  )}
                                  {lead.contacts.linkedin && lead.contacts.linkedin.length > 0 && (
                                    <a href={lead.contacts.linkedin[0]} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 font-semibold text-[10px] bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                      LinkedIn
                                    </a>
                                  )}
                                  {lead.contacts.whatsapp && lead.contacts.whatsapp.length > 0 && (
                                    <a href={lead.contacts.whatsapp[0]} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 font-semibold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleShortlist(lead)}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  shortlistedLeads.some(s => s.domain === lead.domain)
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : dark ? 'border-neutral-800 text-neutral-400 hover:text-amber-400 hover:bg-neutral-900' : 'border-neutral-200 text-neutral-600 hover:text-amber-500 hover:bg-neutral-100'
                                }`}
                                title={shortlistedLeads.some(s => s.domain === lead.domain) ? "Remove from Shortlist" : "Shortlist Lead"}
                              >
                                <Star className={`h-4 w-4 ${shortlistedLeads.some(s => s.domain === lead.domain) ? 'fill-amber-400 text-amber-400' : ''}`} />
                              </button>
                              <button
                                onClick={() => {
                                  setManualDomains(lead.domain);
                                  setManualJobName(`Audit for ${lead.domain}`);
                                  setShowAuditModal(true);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow border border-indigo-500"
                              >
                                Full Audit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : !searchingLeads && (
                <div className={`p-12 text-center rounded-2xl border ${dark ? 'bg-neutral-900/20 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <Search className="h-8 w-8 text-neutral-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-neutral-400">No lead results to display yet.</p>
                  <p className="text-xs text-neutral-500 mt-1">Enter a City or Country (e.g. "Miami", "Chicago", "Texas") or specific business niche above.</p>
                </div>
              )}
            </div>
          ) : activeTab === 'shortlist' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Shortlisted Leads</h2>
                  <p className="text-xs text-neutral-400 mt-1">
                    Your saved high-priority leads with extracted emails, phone numbers, and social channels.
                  </p>
                </div>
                {shortlistedLeads.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSaveLeadsAsJob()}
                      disabled={savingLeadsJob}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg flex items-center gap-2 text-white shadow"
                    >
                      <Database className="h-4 w-4" /> Save Shortlist to Audit Job
                    </button>
                    <button
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," 
                          + ["Domain,Title,URL,Design Score,Emails,Instagram,Facebook,LinkedIn,WhatsApp,Phones"].join(",") + "\n"
                          + shortlistedLeads.map(r => [
                              `"${r.domain}"`,
                              `"${(r.title || '').replace(/"/g, '""')}"`,
                              `"${r.url}"`,
                              r.score_design,
                              `"${(r.contacts?.emails || []).join('; ')}"`,
                              `"${(r.contacts?.instagram || []).join('; ')}"`,
                              `"${(r.contacts?.facebook || []).join('; ')}"`,
                              `"${(r.contacts?.linkedin || []).join('; ')}"`,
                              `"${(r.contacts?.whatsapp || []).join('; ')}"`,
                              `"${(r.contacts?.phones || []).join('; ')}"`
                            ].join(",")).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `shortlisted_leads.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-2 border border-neutral-700 text-neutral-200"
                    >
                      <FileDown className="h-4 w-4 text-emerald-400" /> Export Shortlist CSV
                    </button>
                  </div>
                )}
              </div>

              {shortlistedLeads.length > 0 ? (
                <div className={`rounded-2xl border overflow-hidden ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`border-b ${dark ? 'border-neutral-800 bg-neutral-900/60 text-neutral-400' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}`}>
                          <th className="p-4 font-semibold">Business / Domain</th>
                          <th className="p-4 font-semibold">Design Score</th>
                          <th className="p-4 font-semibold">Contacts</th>
                          <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${dark ? 'divide-neutral-800/60 text-neutral-300' : 'divide-neutral-200 text-neutral-700'}`}>
                        {shortlistedLeads.map((lead, idx) => (
                          <tr key={idx} className={`${dark ? 'hover:bg-neutral-900/30' : 'hover:bg-neutral-50/50'} transition-colors`}>
                            <td className="p-4">
                              <p className="font-bold text-sm text-neutral-100">{lead.title || lead.domain}</p>
                              <a href={lead.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-0.5">
                                {lead.domain} <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${lead.score_design >= 65 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                {lead.score_design}/100
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="space-y-1 text-xs">
                                {lead.contacts?.emails && lead.contacts.emails.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                                    <Mail className="h-3.5 w-3.5" />
                                    <a href={`mailto:${lead.contacts.emails[0]}`} className="hover:underline">
                                      {lead.contacts.emails[0]}
                                    </a>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 pt-0.5">
                                  {lead.contacts?.instagram && lead.contacts.instagram.length > 0 && (
                                    <a href={lead.contacts.instagram[0]} target="_blank" rel="noreferrer" className="text-pink-400 font-semibold text-[10px] bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">
                                      Instagram
                                    </a>
                                  )}
                                  {lead.contacts?.facebook && lead.contacts.facebook.length > 0 && (
                                    <a href={lead.contacts.facebook[0]} target="_blank" rel="noreferrer" className="text-blue-400 font-semibold text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                      Facebook
                                    </a>
                                  )}
                                  {lead.contacts?.whatsapp && lead.contacts.whatsapp.length > 0 && (
                                    <a href={lead.contacts.whatsapp[0]} target="_blank" rel="noreferrer" className="text-emerald-400 font-semibold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleShortlist(lead)}
                                className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                                title="Remove from Shortlist"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setManualDomains(lead.domain);
                                  setManualJobName(`Audit for ${lead.domain}`);
                                  setShowAuditModal(true);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow"
                              >
                                Full Audit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className={`p-12 text-center rounded-2xl border ${dark ? 'bg-neutral-900/20 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <Bookmark className="h-8 w-8 text-neutral-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-neutral-400">No shortlisted leads yet.</p>
                  <p className="text-xs text-neutral-500 mt-1">Click the ⭐ star icon next to any lead in Keyword Lead Finder to add it here.</p>
                </div>
              )}
            </div>
          ) : activeTab === 'email' ? (
            <div className="max-w-4xl space-y-6 animate-in fade-in duration-200">
              <h2 className="text-xl font-bold tracking-tight">Email Outreach Manager</h2>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: SMTP Settings */}
                  <div className={`p-8 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'} space-y-6`}>
                    <h3 className="text-sm font-bold tracking-tight border-b pb-2 border-neutral-800/10">Email Outreach SMTP Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs text-neutral-400 font-semibold block">SMTP Host</label>
                        <input
                          type="text"
                          value={settings.smtp_host || ''}
                          onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                          placeholder="e.g. smtp.gmail.com"
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">SMTP Port</label>
                        <input
                          type="number"
                          value={settings.smtp_port || 587}
                          onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
                          placeholder="587"
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">Use TLS Encryption</label>
                        <select
                          value={settings.smtp_use_tls === undefined ? 1 : settings.smtp_use_tls}
                          onChange={(e) => setSettings({ ...settings, smtp_use_tls: parseInt(e.target.value) })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        >
                          <option value={1}>Yes (TLS / STARTTLS)</option>
                          <option value={0}>No (Standard SMTP)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">SMTP Username</label>
                        <input
                          type="text"
                          value={settings.smtp_username || ''}
                          onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">SMTP Password</label>
                        <input
                          type="password"
                          value={settings.smtp_password || ''}
                          onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">Sender Name</label>
                        <input
                          type="text"
                          value={settings.smtp_sender_name || ''}
                          onChange={(e) => setSettings({ ...settings, smtp_sender_name: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">Sender Email</label>
                        <input
                          type="email"
                          value={settings.smtp_sender_email || ''}
                          onChange={(e) => setSettings({ ...settings, smtp_sender_email: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleTestSMTP}
                        disabled={testingSMTP}
                        className={`flex-1 px-4 py-2 border rounded-lg text-xs font-semibold text-center transition-all ${
                          dark ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-350 bg-neutral-900/50' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700 bg-neutral-50'
                        }`}
                      >
                        {testingSMTP ? 'Testing Connection...' : 'Test SMTP Connection'}
                      </button>
                    </div>
                    {smtpTestResult && (
                      <p className={`text-xs font-semibold mt-2 ${smtpTestResult.success ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {smtpTestResult.message}
                      </p>
                    )}
                  </div>

                  {/* Right Column: Email Template Settings */}
                  <div className={`p-8 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'} flex flex-col justify-between`}>
                    <div className="space-y-6">
                      <h3 className="text-sm font-bold tracking-tight border-b pb-2 border-neutral-800/10">Email Outreach Template</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">Subject Line Template</label>
                        <input
                          type="text"
                          value={settings.email_template_subject || ''}
                          onChange={(e) => setSettings({ ...settings, email_template_subject: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800 font-medium' : 'bg-neutral-50 border-neutral-200 font-medium'}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-neutral-400 font-semibold block">Body Template</label>
                        <textarea
                          rows={10}
                          value={settings.email_template_body || ''}
                          onChange={(e) => setSettings({ ...settings, email_template_body: e.target.value })}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border font-mono ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                        />
                      </div>

                      <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg space-y-1">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Available Placeholders</span>
                        <div className="flex flex-wrap gap-1.5 text-[9px] font-mono text-neutral-450">
                          {['{domain}', '{score_overall}', '{score_seo}', '{score_performance}', '{score_accessibility}', '{score_security}', '{score_design}', '{issues_summary}'].map(ph => (
                            <span key={ph} className="bg-neutral-800/30 px-1.5 py-0.5 rounded border border-neutral-700/50">{ph}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t border-neutral-800/10 mt-6">
                      <button
                        type="submit"
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white shadow-lg shadow-indigo-600/10 transition-all hover:scale-[1.02]"
                      >
                        Save Configurations
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6 animate-in fade-in duration-200">
              <h2 className="text-xl font-bold tracking-tight">Audit Pipeline Settings</h2>

              <form onSubmit={handleSaveSettings} className={`p-8 rounded-2xl border ${dark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'} space-y-6`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-semibold block">Concurrency Limit</label>
                    <input
                      type="number"
                      value={settings.concurrency}
                      onChange={(e) => setSettings({ ...settings, concurrency: parseInt(e.target.value) })}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-semibold block">Timeout (Seconds)</label>
                    <input
                      type="number"
                      value={settings.timeout}
                      onChange={(e) => setSettings({ ...settings, timeout: parseInt(e.target.value) })}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-semibold block">Retry Count</label>
                    <input
                      type="number"
                      value={settings.retry_count}
                      onChange={(e) => setSettings({ ...settings, retry_count: parseInt(e.target.value) })}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-neutral-400 font-semibold block">Export Format Preference</label>
                    <select
                      value={settings.export_format}
                      onChange={(e) => setSettings({ ...settings, export_format: e.target.value })}
                      className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                      <option value="excel">Excel</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white shadow-lg shadow-indigo-600/10"
                  >
                    Save Configuration
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-2xl border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800 shadow-2xl'} overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`px-6 py-4 border-b ${dark ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-100 bg-neutral-50'} flex justify-between items-center`}>
              <h3 className="font-bold text-sm tracking-tight">Audit New Domains</h3>
              <button
                onClick={() => setShowAuditModal(false)}
                className={`p-1.5 rounded-lg hover:bg-neutral-800/10 ${dark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400">Job Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. My Manual Website Audit"
                  value={manualJobName}
                  onChange={(e) => setManualJobName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800 focus:border-indigo-500' : 'bg-neutral-50 border-neutral-200 focus:border-indigo-500'
                    }`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400">Domains / URLs</label>
                <textarea
                  rows={6}
                  placeholder="Enter one domain or URL per line&#10;e.g.&#10;google.com&#10;https://github.com"
                  value={manualDomains}
                  onChange={(e) => setManualDomains(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs outline-none border font-mono ${dark ? 'bg-neutral-950 border-neutral-800 focus:border-indigo-500' : 'bg-neutral-50 border-neutral-200 focus:border-indigo-500'
                    }`}
                  required
                />
              </div>
              {manualError && (
                <p className="text-xs text-rose-500 font-semibold">{manualError}</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border ${dark ? 'border-neutral-800 hover:bg-neutral-800' : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual || !manualDomains.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-semibold rounded-lg text-white shadow-lg shadow-indigo-600/10 flex items-center gap-2"
                >
                  {submittingManual ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Start Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOutreachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-2xl border ${dark ? 'bg-neutral-900 border-neutral-800 text-neutral-200' : 'bg-white border-neutral-200 text-neutral-800 shadow-2xl'} overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`px-6 py-4 border-b ${dark ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-100 bg-neutral-50'} flex justify-between items-center`}>
              <div>
                <h3 className="font-bold text-sm tracking-tight">Send Email Outreach</h3>
                <p className="text-[10px] text-neutral-500 mt-0.5">Audited Lead: {outreachResult?.domain}</p>
              </div>
              <button
                onClick={() => setShowOutreachModal(false)}
                className={`p-1.5 rounded-lg hover:bg-neutral-800/10 ${dark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSendOutreach} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400">Recipient Email Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={outreachRecipient}
                  onChange={(e) => setOutreachRecipient(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800 focus:border-indigo-500' : 'bg-neutral-50 border-neutral-200 focus:border-indigo-500'
                    }`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400">Email Subject Line</label>
                <input
                  type="text"
                  value={outreachSubject}
                  onChange={(e) => setOutreachSubject(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs outline-none border ${dark ? 'bg-neutral-950 border-neutral-800 focus:border-indigo-500' : 'bg-neutral-50 border-neutral-200 focus:border-indigo-500'
                    }`}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400">Email Body Message</label>
                <textarea
                  rows={10}
                  value={outreachBody}
                  onChange={(e) => setOutreachBody(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs outline-none border font-mono ${dark ? 'bg-neutral-950 border-neutral-800 focus:border-indigo-500' : 'bg-neutral-50 border-neutral-200 focus:border-indigo-500'
                    }`}
                  required
                />
              </div>

              {outreachError && (
                <p className="text-xs text-rose-500 font-semibold">{outreachError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOutreachModal(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border ${dark ? 'border-neutral-800 hover:bg-neutral-800' : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingOutreach || !outreachRecipient.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-xs font-semibold rounded-lg text-white shadow-lg shadow-indigo-600/10 flex items-center gap-2"
                >
                  {sendingOutreach ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send Outreach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
