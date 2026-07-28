import React, { useState, useEffect } from 'react';
import { Globe, Trash2, Activity, Plus, RefreshCw, CheckCircle2, XCircle, Clock, CalendarDays, Calendar, Database, Search, Timer, ArrowRight, ArrowUpRight, Server, ShieldCheck, ChevronRight, Cloud } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';

interface PingEvent {
  timestamp: number;
  sizeBytes: number;
  status: number;
  ok: boolean;
}

interface Target {
  id: string;
  url: string;
  interval: number;
  lastPing: string | null;
  status: 'pending' | 'success' | 'error';
  statusCode: number | null;
  history: PingEvent[];
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function App() {
  const [url, setUrl] = useState('');
  const [intervalVal, setIntervalVal] = useState('3');
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);

// Cloudflare Worker and KV have been configured
  const fetchTargets = async () => {
    try {
      const res = await fetch('/api/targets');
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      setTargets(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
      setError('');
    } catch (err) {
      console.error('Failed to fetch targets:', err);
      // Don't show aggressive error if it's just a dev server restart
    }
  };

  useEffect(() => {
    fetchTargets();
    const interval = setInterval(fetchTargets, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), interval: intervalVal })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Gagal menambahkan URL');
      } else {
        setUrl('');
        setIntervalVal('3');
        setSelectedId(data.id);
        fetchTargets();
      }
    } catch (err) {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/targets/${id}`, { method: 'DELETE' });
      if (selectedId === id) setSelectedId(null);
      fetchTargets();
    } catch (err) {
      console.error('Failed to delete target:', err);
    }
  };

  const selectedTarget = targets.find(t => t.id === selectedId) || targets[0];
  const filteredTargets = targets.filter(t => t.url.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-300 font-sans flex flex-col md:flex-row overflow-hidden selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <aside className="w-full md:w-96 flex-shrink-0 bg-[#0F1423] border-r border-slate-800/60 flex flex-col h-screen md:h-screen">
        <div className="p-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="text-white" size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Nexus Pinger</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-slate-500 font-medium tracking-wide">ENTERPRISE KEEP-ALIVE</p>
                <button 
                  onClick={() => setShowDeployModal(true)}
                  className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center gap-1 hover:bg-orange-500/20 transition-colors"
                  title="Deploy to Cloudflare"
                >
                  <Cloud size={10} />
                  CF READY
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Globe size={16} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://app.onrender.com"
                  required
                  className="w-full bg-[#151B2B] border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
              </div>
              
              <div className="flex gap-3">
                <div className="relative flex-1 group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Timer size={16} className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={intervalVal}
                    onChange={(e) => setIntervalVal(e.target.value)}
                    placeholder="Interval"
                    required
                    className="w-full bg-[#151B2B] border border-slate-700/50 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-xs text-slate-500 font-medium">Menit</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                  Add
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs font-medium px-1">{error}</p>}
          </form>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-4 space-y-2">
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari domain..."
                className="w-full bg-[#0B0F19] border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-600 transition-colors"
              />
            </div>

            {filteredTargets.length === 0 ? (
              <div className="text-center py-8 px-4 text-sm text-slate-500">
                Belum ada domain yang sesuai.
              </div>
            ) : (
              filteredTargets.map(target => (
                <button
                  key={target.id}
                  onClick={() => setSelectedId(target.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group relative overflow-hidden ${
                    selectedId === target.id
                      ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-indigo-500/30'
                      : 'bg-[#151B2B] border-transparent hover:border-slate-700 hover:bg-[#1A2235]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 relative z-10">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          target.status === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
                          target.status === 'error' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]' :
                          'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse'
                        }`} />
                        <span className={`text-sm font-medium truncate ${selectedId === target.id ? 'text-indigo-300' : 'text-slate-300 group-hover:text-white'}`}>
                          {target.url.replace(/^https?:\/\//, '')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-1"><Clock size={10} /> {target.interval}m</span>
                        <span>•</span>
                        <span>{target.lastPing ? format(new Date(target.lastPing), 'HH:mm') : 'Menunggu'}</span>
                      </div>
                    </div>
                    
                    <div
                      onClick={(e) => handleDelete(target.id, e)}
                      className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </div>
                  </div>
                  {selectedId === target.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto bg-[#0B0F19] relative">
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
        
        {selectedTarget ? (
          <div className="max-w-5xl mx-auto p-6 md:p-12 space-y-8 relative z-10">
            
            {/* Target Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-400">
                  <Server size={12} />
                  <span>Target Configuration</span>
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                  {selectedTarget.url}
                  <a href={selectedTarget.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-indigo-400 transition-colors">
                    <ArrowUpRight size={24} strokeWidth={2.5} />
                  </a>
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className={selectedTarget.status === 'success' ? 'text-emerald-400' : 'text-slate-500'} />
                    <span>Status: <strong className={`capitalize ${
                      selectedTarget.status === 'success' ? 'text-emerald-400' :
                      selectedTarget.status === 'error' ? 'text-red-400' : 'text-amber-400'
                    }`}>{selectedTarget.status}</strong></span>
                  </div>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-500" />
                    <span>Interval: <strong>{selectedTarget.interval} Menit</strong></span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-500 mb-1">Ping Terakhir</div>
                  <div className="font-mono text-sm text-slate-300">
                    {selectedTarget.lastPing ? format(new Date(selectedTarget.lastPing), 'dd MMM yyyy, HH:mm:ss') : '-'}
                  </div>
                </div>
              </div>
            </header>

            {/* Metrics */}
            {(() => {
              const history = selectedTarget.history || [];
              const dailyCount = history.filter(h => isToday(h.timestamp)).length;
              const weeklyCount = history.filter(h => isThisWeek(h.timestamp)).length;
              const monthlyCount = history.filter(h => isThisMonth(h.timestamp)).length;
              
              const successRate = history.length > 0 
                ? Math.round((history.filter(h => h.ok).length / history.length) * 100) 
                : 0;

              return (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#151B2B] p-5 rounded-2xl border border-slate-800/60 shadow-lg shadow-black/20">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Request</span>
                        <Activity size={16} className="text-indigo-400" />
                      </div>
                      <div className="text-3xl font-bold text-white">{history.length}</div>
                    </div>
                    
                    <div className="bg-[#151B2B] p-5 rounded-2xl border border-slate-800/60 shadow-lg shadow-black/20">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hari Ini</span>
                        <Clock size={16} className="text-emerald-400" />
                      </div>
                      <div className="text-3xl font-bold text-white">{dailyCount}</div>
                    </div>
                    
                    <div className="bg-[#151B2B] p-5 rounded-2xl border border-slate-800/60 shadow-lg shadow-black/20">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Minggu Ini</span>
                        <CalendarDays size={16} className="text-amber-400" />
                      </div>
                      <div className="text-3xl font-bold text-white">{weeklyCount}</div>
                    </div>
                    
                    <div className="bg-[#151B2B] p-5 rounded-2xl border border-slate-800/60 shadow-lg shadow-black/20 relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Success Rate</span>
                          <ShieldCheck size={16} className="text-blue-400" />
                        </div>
                        <div className="text-3xl font-bold text-white">{successRate}%</div>
                      </div>
                      <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                        <Activity size={100} className="text-blue-400 translate-x-1/4 translate-y-1/4" />
                      </div>
                    </div>
                  </div>

                  {/* History Table */}
                  <div className="bg-[#151B2B] rounded-2xl border border-slate-800/60 shadow-xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg">
                          <Database size={18} className="text-slate-300" />
                        </div>
                        <h3 className="font-semibold text-white">Riwayat Payload & Request</h3>
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        Menampilkan {Math.min(history.length, 50)} data terakhir
                      </div>
                    </div>
                    
                    {history.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                          <thead className="bg-[#1A2235] text-slate-400 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="px-6 py-4 font-medium">Timestamp</th>
                              <th className="px-6 py-4 font-medium">Status HTTP</th>
                              <th className="px-6 py-4 font-medium">Resolusi</th>
                              <th className="px-6 py-4 font-medium text-right">Ukuran Payload</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {history.slice(0, 50).map((ping, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                                  {format(new Date(ping.timestamp), 'dd MMM, HH:mm:ss')}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${ping.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    <span className="font-mono">{ping.status || 'ERR'}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                                    ping.ok 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                                  }`}>
                                    {ping.ok ? 'Berhasil' : 'Gagal'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="text-slate-300 font-medium bg-[#0B0F19] px-3 py-1 rounded-md border border-slate-800">
                                    {formatBytes(ping.sizeBytes)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500 space-y-4">
                        <Activity size={32} className="text-slate-700" />
                        <p>Belum ada riwayat ping untuk domain ini.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-6 relative z-10">
            <div className="w-24 h-24 rounded-3xl bg-[#151B2B] border border-slate-800 flex items-center justify-center shadow-2xl">
              <Globe size={40} className="text-slate-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-white">Tidak Ada Domain Terpilih</h2>
              <p className="max-w-xs mx-auto">Tambahkan URL baru di sidebar sebelah kiri untuk memulai monitoring.</p>
            </div>
          </div>
        )}
      </main>

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F1423] border border-slate-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#151B2B]">
              <div className="flex items-center gap-3">
                <Cloud className="text-orange-400" size={24} />
                <h3 className="text-xl font-bold text-white">Cloudflare Pages & KV Ready</h3>
              </div>
              <button onClick={() => setShowDeployModal(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6 text-slate-300">
              <p>
                Aplikasi ini telah dikonfigurasi sepenuhnya untuk <strong>Cloudflare Pages</strong> dengan Cron Triggers dan KV Storage yang Anda minta.
              </p>
              
              <div className="bg-[#151B2B] p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 size={16} /> KV Namespace Tersambung
                </div>
                <div className="text-sm font-mono text-slate-400 bg-[#0B0F19] p-3 rounded-lg border border-slate-800">
                  <span className="text-pink-400">binding</span> = <span className="text-green-400">"vles_kv"</span><br/>
                  <span className="text-pink-400">id</span> = <span className="text-green-400">"684d85d704bf4ef6bb4ddec1cfe30320"</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-white">Cara Deploy:</h4>
                <ol className="list-decimal list-inside space-y-3 text-sm text-slate-400">
                  <li>Export / Download project ini ke komputer Anda atau push ke GitHub repository.</li>
                  <li>Pastikan Anda sudah login di Cloudflare CLI (<code className="bg-[#1A2235] px-1.5 py-0.5 rounded text-indigo-300">npx wrangler login</code>).</li>
                  <li>Jalankan perintah build: <code className="bg-[#1A2235] px-1.5 py-0.5 rounded text-indigo-300">npm run build</code>.</li>
                  <li>Deploy ke Pages: <code className="bg-[#1A2235] px-1.5 py-0.5 rounded text-indigo-300">npx wrangler pages deploy dist</code>.</li>
                </ol>
              </div>
              
              <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex items-start gap-3">
                <Server className="text-orange-400 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-orange-200/80 leading-relaxed">
                  File <strong>worker.js</strong> dan <strong>wrangler.toml</strong> telah dibuat otomatis di dalam project ini. File ini mengatur Cron API dan database KV (vles_kv).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}

