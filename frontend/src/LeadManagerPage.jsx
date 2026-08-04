import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin, Plus, Trash2, Search, CheckCircle2, Circle, Send, Sparkles,
  ChevronDown, ChevronRight, Filter, Layers, Zap, Download, RefreshCw,
  Building2, Globe, ArrowRight, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { USA_STATES_DATA, PRESET_NICHES } from './usaStatesCitiesData';

const API_BASE = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (typeof window !== 'undefined' ? window.location.origin : '')
);

export default function LeadManagerPage({ onExtractFromTarget, showToast }) {
  // Niches State
  const [niches, setNiches] = useState([]);
  const [activeNicheId, setActiveNicheId] = useState(null);
  const [newNicheName, setNewNicheName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Targets State for active niche: mapping "STATECODE_CityName" => status ('targeted' | 'outreached' | 'skipped')
  const [targets, setTargets] = useState({});
  const [targetsLoading, setTargetsLoading] = useState(false);

  // Filters & Accordion State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'targeted' | 'outreached' | 'untargeted'
  const [regionFilter, setRegionFilter] = useState('all'); // 'all' | 'West' | 'South' | 'Midwest' | 'Northeast'
  const [expandedStates, setExpandedStates] = useState({});

  // Fetch Niches on mount
  useEffect(() => {
    fetchNiches();
  }, []);

  // Fetch targets when active niche changes
  useEffect(() => {
    if (activeNicheId) {
      fetchNicheTargets(activeNicheId);
    } else {
      setTargets({});
    }
  }, [activeNicheId]);

  const fetchNiches = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/niches`);
      if (resp.ok) {
        const data = await resp.json();
        setNiches(data);
        if (data.length > 0 && !activeNicheId) {
          setActiveNicheId(data[0].id);
        }
      } else {
        fallbackLocalStorageNiches();
      }
    } catch (e) {
      console.warn("Backend niches fetch failed, using local storage fallback", e);
      fallbackLocalStorageNiches();
    } finally {
      setLoading(false);
    }
  };

  const fallbackLocalStorageNiches = () => {
    try {
      const local = JSON.parse(localStorage.getItem('gmaps_lead_niches') || '[]');
      if (local.length === 0) {
        // Initial default niche
        const defaultNiche = { id: 1, name: "Roofing Contractors", description: "Roofing & Siding Specialists", created_at: new Date().toISOString(), targeted_count: 0, outreached_count: 0 };
        setNiches([defaultNiche]);
        setActiveNicheId(1);
        localStorage.setItem('gmaps_lead_niches', JSON.stringify([defaultNiche]));
      } else {
        setNiches(local);
        if (!activeNicheId && local.length > 0) {
          setActiveNicheId(local[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNicheTargets = async (nicheId) => {
    setTargetsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/v1/niches/${nicheId}/targets`);
      if (resp.ok) {
        const data = await resp.json();
        const map = {};
        data.forEach(t => {
          map[`${t.state_code}_${t.city_name}`] = t.status;
        });
        setTargets(map);
      } else {
        fallbackLocalStorageTargets(nicheId);
      }
    } catch (e) {
      fallbackLocalStorageTargets(nicheId);
    } finally {
      setTargetsLoading(false);
    }
  };

  const fallbackLocalStorageTargets = (nicheId) => {
    try {
      const key = `gmaps_niche_targets_${nicheId}`;
      const local = JSON.parse(localStorage.getItem(key) || '{}');
      setTargets(local);
    } catch (e) {
      setTargets({});
    }
  };

  const saveLocalTargets = (nicheId, newTargets) => {
    try {
      localStorage.setItem(`gmaps_niche_targets_${nicheId}`, JSON.stringify(newTargets));
    } catch (e) {}
  };

  // Add Niche
  const handleCreateNiche = async (nameToAdd) => {
    const title = (nameToAdd || newNicheName).trim();
    if (!title) return;

    try {
      const resp = await fetch(`${API_BASE}/api/v1/niches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title })
      });
      if (resp.ok) {
        const created = await resp.json();
        setNiches(prev => {
          const exists = prev.some(n => n.id === created.id);
          if (exists) return prev;
          return [created, ...prev];
        });
        setActiveNicheId(created.id);
        if (showToast) showToast(`Added niche "${created.name}"`);
      } else {
        // Fallback local add
        const newObj = { id: Date.now(), name: title, created_at: new Date().toISOString(), targeted_count: 0, outreached_count: 0 };
        const updated = [newObj, ...niches];
        setNiches(updated);
        setActiveNicheId(newObj.id);
        localStorage.setItem('gmaps_lead_niches', JSON.stringify(updated));
        if (showToast) showToast(`Added niche "${title}"`);
      }
    } catch (e) {
      const newObj = { id: Date.now(), name: title, created_at: new Date().toISOString(), targeted_count: 0, outreached_count: 0 };
      const updated = [newObj, ...niches];
      setNiches(updated);
      setActiveNicheId(newObj.id);
      localStorage.setItem('gmaps_lead_niches', JSON.stringify(updated));
      if (showToast) showToast(`Added niche "${title}"`);
    }

    setNewNicheName('');
    setShowAddModal(false);
  };

  // Delete Niche
  const handleDeleteNiche = async (e, nicheId, name) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the niche "${name}"?`)) return;

    try {
      await fetch(`${API_BASE}/api/v1/niches/${nicheId}`, { method: 'DELETE' });
    } catch (err) {}

    const updated = niches.filter(n => n.id !== nicheId);
    setNiches(updated);
    localStorage.setItem('gmaps_lead_niches', JSON.stringify(updated));
    localStorage.removeItem(`gmaps_niche_targets_${nicheId}`);

    if (activeNicheId === nicheId) {
      setActiveNicheId(updated.length > 0 ? updated[0].id : null);
    }
    if (showToast) showToast(`Deleted niche "${name}"`);
  };

  // Single City Toggle Target
  const handleToggleCityTarget = async (stateObj, cityName, nextStatus) => {
    if (!activeNicheId) return;

    const key = `${stateObj.code}_${cityName}`;
    const newTargets = { ...targets };

    if (nextStatus === 'untargeted') {
      delete newTargets[key];
    } else {
      newTargets[key] = nextStatus;
    }

    setTargets(newTargets);
    saveLocalTargets(activeNicheId, newTargets);

    // Call API
    try {
      await fetch(`${API_BASE}/api/v1/niches/${activeNicheId}/targets/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_code: stateObj.code,
          state_name: stateObj.name,
          city_name: cityName,
          status: nextStatus
        })
      });
    } catch (e) {}
  };

  // State-wide Toggle (Check All / Uncheck All / Mark All Outreached)
  const handleStateBulkToggle = async (stateObj, nextStatus) => {
    if (!activeNicheId) return;

    const newTargets = { ...targets };
    stateObj.cities.forEach(city => {
      const key = `${stateObj.code}_${city}`;
      if (nextStatus === 'untargeted') {
        delete newTargets[key];
      } else {
        newTargets[key] = nextStatus;
      }
    });

    setTargets(newTargets);
    saveLocalTargets(activeNicheId, newTargets);

    try {
      await fetch(`${API_BASE}/api/v1/niches/${activeNicheId}/targets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_code: stateObj.code,
          state_name: stateObj.name,
          cities: stateObj.cities,
          status: nextStatus
        })
      });
    } catch (e) {}

    if (showToast) {
      showToast(`${nextStatus === 'untargeted' ? 'Cleared' : 'Updated'} all ${stateObj.cities.length} cities in ${stateObj.name}`);
    }
  };

  // Toggle Accordion State
  const toggleStateExpand = (stateCode) => {
    setExpandedStates(prev => ({ ...prev, [stateCode]: !prev[stateCode] }));
  };

  const expandAllStates = () => {
    const all = {};
    USA_STATES_DATA.forEach(s => all[s.code] = true);
    setExpandedStates(all);
  };

  const collapseAllStates = () => {
    setExpandedStates({});
  };

  // Analytics Computation for Active Niche
  const activeNiche = niches.find(n => n.id === activeNicheId);

  const stats = useMemo(() => {
    let targetedCount = 0;
    let outreachedCount = 0;
    const targetedStatesSet = new Set();

    Object.entries(targets).forEach(([key, status]) => {
      const [stCode] = key.split('_');
      if (status === 'targeted') {
        targetedCount++;
        targetedStatesSet.add(stCode);
      } else if (status === 'outreached') {
        outreachedCount++;
        targetedStatesSet.add(stCode);
      }
    });

    const totalUSACities = USA_STATES_DATA.reduce((acc, s) => acc + s.cities.length, 0);

    return {
      targetedCount,
      outreachedCount,
      totalTargeted: targetedCount + outreachedCount,
      targetedStatesCount: targetedStatesSet.size,
      totalUSACities,
      coveragePercent: totalUSACities > 0 ? Math.round(((targetedCount + outreachedCount) / totalUSACities) * 100) : 0
    };
  }, [targets]);

  // Filtered States & Cities
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return USA_STATES_DATA.filter(st => {
      if (regionFilter !== 'all' && st.region !== regionFilter) return false;

      if (!q && statusFilter === 'all') return true;

      // Match state name or code
      const matchStateName = st.name.toLowerCase().includes(q) || st.code.toLowerCase().includes(q);

      // Match city in state
      const matchingCities = st.cities.filter(city => {
        const key = `${st.code}_${city}`;
        const status = targets[key] || 'untargeted';

        if (statusFilter === 'targeted' && status !== 'targeted') return false;
        if (statusFilter === 'outreached' && status !== 'outreached') return false;
        if (statusFilter === 'untargeted' && status !== 'untargeted') return false;

        if (!q) return true;
        return city.toLowerCase().includes(q) || matchStateName;
      });

      return matchStateName || matchingCities.length > 0;
    });
  }, [searchQuery, statusFilter, regionFilter, targets]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Lead Manager Info */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Niche & USA Territory Outreach Manager
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Add your target business niche, select states and cities across the United States, check off outreach locations, and launch lead extraction with one click.
            </p>
          </div>

          {/* Quick Add Niche Action */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Niche</span>
            </button>
          </div>
        </div>

        {/* Active Niche Performance Bar */}
        {activeNiche && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/60">
              <span className="text-xs text-slate-400 font-medium">Active Niche</span>
              <p className="text-lg font-semibold text-indigo-300 truncate">{activeNiche.name}</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/60">
              <span className="text-xs text-slate-400 font-medium">Targeted US Cities</span>
              <p className="text-lg font-semibold text-emerald-400">{stats.targetedCount} / {stats.totalUSACities}</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/60">
              <span className="text-xs text-slate-400 font-medium">Outreached Cities</span>
              <p className="text-lg font-semibold text-purple-400">{stats.outreachedCount}</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/60">
              <span className="text-xs text-slate-400 font-medium">Targeted States</span>
              <p className="text-lg font-semibold text-amber-400">{stats.targetedStatesCount} / 50 States</p>
            </div>
          </div>
        )}
      </div>

      {/* Niches Selector Navigation Cards */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-200">Select Business Niche</h3>
          </div>
          <span className="text-xs text-slate-400">{niches.length} Saved Niches</span>
        </div>

        {/* Niche Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
          {niches.map((n) => {
            const isActive = n.id === activeNicheId;
            return (
              <div
                key={n.id}
                onClick={() => setActiveNicheId(n.id)}
                className={`group cursor-pointer px-4 py-2.5 rounded-xl border transition-all flex items-center space-x-3 whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span className="text-sm font-medium">{n.name}</span>

                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteNiche(e, n.id, n.name)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-1 rounded-md hover:bg-slate-800 ml-1"
                  title="Delete Niche"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {niches.length === 0 && (
            <div className="text-xs text-slate-500 italic py-2">
              No niches added yet. Add your first niche to start targeting USA cities!
            </div>
          )}
        </div>

        {/* Quick Presets row if user wants inspiration */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center space-x-2 text-xs text-slate-400 overflow-x-auto scrollbar-none">
          <span className="text-slate-500 shrink-0 font-medium">Quick Presets:</span>
          {PRESET_NICHES.slice(0, 6).map((preset) => (
            <button
              key={preset}
              onClick={() => handleCreateNiche(preset)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-300 transition-all shrink-0"
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main USA Territory Matrix Controls & Checklist */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search state (e.g. California, TX) or city (e.g. Los Angeles)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Filters & Batch Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Status: All Cities</option>
              <option value="targeted">Status: Targeted Only</option>
              <option value="outreached">Status: Outreached Only</option>
              <option value="untargeted">Status: Untargeted Only</option>
            </select>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Region: All USA</option>
              <option value="West">West</option>
              <option value="South">South</option>
              <option value="Midwest">Midwest</option>
              <option value="Northeast">Northeast</option>
            </select>

            {/* Expand / Collapse All */}
            <button
              onClick={expandAllStates}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-all"
            >
              Expand All
            </button>
            <button
              onClick={collapseAllStates}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-all"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* State Accordion List */}
        <div className="space-y-3">
          {filteredData.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium text-sm">No US states or cities match your search filter.</p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setRegionFilter('all'); }}
                className="mt-3 text-xs text-indigo-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filteredData.map((stateObj) => {
              const isExpanded = expandedStates[stateObj.code] || searchQuery.length > 0;

              // Calculate how many cities in this state are targeted or outreached
              let stateTargetedCount = 0;
              let stateOutreachedCount = 0;
              stateObj.cities.forEach(city => {
                const k = `${stateObj.code}_${city}`;
                if (targets[k] === 'targeted') stateTargetedCount++;
                if (targets[k] === 'outreached') stateOutreachedCount++;
              });

              const totalInState = stateObj.cities.length;
              const allTargeted = stateTargetedCount + stateOutreachedCount === totalInState;

              return (
                <div
                  key={stateObj.code}
                  className="bg-slate-950 border border-slate-800/90 rounded-xl overflow-hidden transition-all"
                >
                  {/* State Header Row */}
                  <div
                    onClick={() => toggleStateExpand(stateObj.code)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-3">
                      {/* State Master Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStateBulkToggle(stateObj, allTargeted ? 'untargeted' : 'targeted');
                        }}
                        className="text-slate-400 hover:text-indigo-400 transition-colors p-1"
                        title={allTargeted ? "Uncheck all in state" : "Check all in state"}
                      >
                        {allTargeted ? (
                          <CheckSquare className="w-5 h-5 text-indigo-500" />
                        ) : stateTargetedCount > 0 ? (
                          <CheckSquare className="w-5 h-5 text-indigo-400/60" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600" />
                        )}
                      </button>

                      {/* State Flag Badge / Title */}
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-mono text-xs font-bold">
                          {stateObj.code}
                        </span>
                        <h4 className="text-base font-semibold text-slate-100">{stateObj.name}</h4>
                        <span className="text-xs text-slate-500">({stateObj.region})</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Stats Pills */}
                      <div className="flex items-center space-x-2 text-xs">
                        <span className={`px-2.5 py-1 rounded-full font-medium ${
                          stateTargetedCount > 0 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-500'
                        }`}>
                          {stateTargetedCount} Targeted
                        </span>
                        {stateOutreachedCount > 0 && (
                          <span className="px-2.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/30 font-medium">
                            {stateOutreachedCount} Outreached
                          </span>
                        )}
                        <span className="text-slate-500">{totalInState} Cities</span>
                      </div>

                      {/* State Master Action Buttons */}
                      <div className="flex items-center space-x-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleStateBulkToggle(stateObj, 'targeted')}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 text-xs border border-slate-800 transition-colors"
                        >
                          Check All
                        </button>
                        <button
                          onClick={() => handleStateBulkToggle(stateObj, 'outreached')}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-purple-950 text-slate-400 hover:text-purple-300 text-xs border border-slate-800 transition-colors"
                        >
                          Mark Sent
                        </button>
                        <button
                          onClick={() => handleStateBulkToggle(stateObj, 'untargeted')}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 text-xs border border-slate-800 transition-colors"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Expand Arrow */}
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded City Grid */}
                  {isExpanded && (
                    <div className="p-4 pt-1 border-t border-slate-900 bg-slate-950/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {stateObj.cities.map((city) => {
                        const key = `${stateObj.code}_${city}`;
                        const status = targets[key] || 'untargeted';

                        return (
                          <div
                            key={city}
                            className={`group p-3 rounded-xl border transition-all flex items-center justify-between ${
                              status === 'targeted'
                                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                : status === 'outreached'
                                ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                                : status === 'skipped'
                                ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60'
                                : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {/* City Checkbox & Name */}
                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                              <button
                                onClick={() => {
                                  const next = status === 'targeted' ? 'untargeted' : 'targeted';
                                  handleToggleCityTarget(stateObj, city, next);
                                }}
                                className="shrink-0 text-slate-400 hover:text-indigo-400 transition-colors"
                              >
                                {status === 'targeted' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : status === 'outreached' ? (
                                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                                )}
                              </button>

                              <span className="text-xs font-medium truncate" title={`${city}, ${stateObj.code}`}>
                                {city}
                              </span>
                            </div>

                            {/* City Status & Actions */}
                            <div className="flex items-center space-x-1 shrink-0">
                              {/* Toggle Outreached State */}
                              <button
                                onClick={() => {
                                  const next = status === 'outreached' ? 'targeted' : 'outreached';
                                  handleToggleCityTarget(stateObj, city, next);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                  status === 'outreached'
                                    ? 'bg-purple-600 text-white border-purple-500'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-purple-300'
                                }`}
                                title="Toggle Outreached / Sent"
                              >
                                {status === 'outreached' ? 'Sent' : 'Outreach'}
                              </button>

                              {/* Extract Lead Direct Launcher */}
                              {onExtractFromTarget && activeNiche && (
                                <button
                                  onClick={() => {
                                    onExtractFromTarget(activeNiche.name, `${city}, ${stateObj.code}`);
                                  }}
                                  className="p-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 transition-all"
                                  title={`Extract leads for ${activeNiche.name} in ${city}, ${stateObj.code}`}
                                >
                                  <Zap className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Custom Niche Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Create Target Business Niche</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Niche Name
                </label>
                <input
                  type="text"
                  value={newNicheName}
                  onChange={(e) => setNewNicheName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNiche()}
                  placeholder="e.g. Solar Panel Installers, Med Spas, Roofers"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Or pick a popular preset:
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                  {PRESET_NICHES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleCreateNiche(preset)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500 text-xs text-slate-300 hover:text-indigo-300 transition-all text-left"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateNiche()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/30"
              >
                Save Niche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
