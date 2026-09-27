import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Zap, 
  Server, 
  Database, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  TrendingUp, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  ArrowUpRight 
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || 'https://fnjnyxtvxi.execute-api.us-east-1.amazonaws.com';
const TARGET_URL = import.meta.env.VITE_TARGET_APP_URL || 'http://44.200.70.13:3000';

export default function App() {
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [results, setResults] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  // Test Launcher State
  const [endpoint, setEndpoint] = useState('/compute');
  const [stages, setStages] = useState([5, 15, 25]);
  const [customStages, setCustomStages] = useState('5, 15, 25');
  const [duration, setDuration] = useState(5);
  const [isLaunching, setIsLaunching] = useState(false);
  const [activeExecution, setActiveExecution] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);

  // Ping Inspector State
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // 1. Fetch Runs
  const fetchRuns = async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch(`${API_BASE}/runs`);
      const data = await res.json();
      if (data.runs && data.runs.length > 0) {
        setRuns(data.runs);
        if (!selectedRunId || !data.runs.some(r => r.run_id === selectedRunId)) {
          setSelectedRunId(data.runs[0].run_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setLoadingRuns(false);
    }
  };

  // 2. Fetch Results for Selected Run
  const fetchResults = async (runId) => {
    if (!runId) return;
    setLoadingResults(true);
    try {
      const res = await fetch(`${API_BASE}/results?run_id=${encodeURIComponent(runId)}`);
      const data = await res.json();
      if (data && !data.error) {
        setResults(data);
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      fetchResults(selectedRunId);
    }
  }, [selectedRunId]);

  // 3. Execution Polling
  useEffect(() => {
    if (!activeExecution) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status?execution_arn=${encodeURIComponent(activeExecution.execution_arn)}`);
        const data = await res.json();
        setExecutionStatus(data.status);

        if (data.status === 'SUCCEEDED' || data.status === 'FAILED' || data.status === 'TIMED_OUT') {
          clearInterval(interval);
          setIsLaunching(false);
          setActiveExecution(null);
          // Refresh runs & select new one
          await fetchRuns();
          setSelectedRunId(activeExecution.run_id);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeExecution]);

  // 4. Launch New Load Test
  const handleLaunchTest = async () => {
    setIsLaunching(true);
    const parsedStages = customStages.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    const runId = `run-${Date.now().toString().slice(-6)}`;

    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: runId,
          endpoint,
          stages: parsedStages.length > 0 ? parsedStages : [5, 15, 25],
          stage_duration_seconds: duration
        })
      });
      const data = await res.json();
      if (data.execution_arn) {
        setActiveExecution({ execution_arn: data.execution_arn, run_id: runId });
        setExecutionStatus('RUNNING');
      }
    } catch (err) {
      console.error('Failed to start test:', err);
      setIsLaunching(false);
    }
  };

  // 5. Direct Target App Ping
  const handlePingTarget = async (testPath = '/health') => {
    setPingLoading(true);
    const start = Date.now();
    try {
      const res = await fetch(`${TARGET_URL}${testPath}`, { mode: 'cors' });
      const json = await res.json();
      setPingResult({
        path: testPath,
        status: res.status,
        latencyMs: Date.now() - start,
        data: json,
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (err) {
      setPingResult({
        path: testPath,
        status: 'Error',
        latencyMs: Date.now() - start,
        error: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setPingLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
          }}>
            <Zap size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>
                LoadLite
              </h1>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                AWS Closed-Loop
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Self-Hosted Load Generator & Target Benchmarking Platform
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
            <span style={{ color: 'var(--text-muted)' }}>Target EC2:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: '#a5f3fc' }}>44.200.70.13:3000</span>
          </div>

          <div className="glass-panel" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <Database size={14} color="#a855f7" />
            <span style={{ color: 'var(--text-muted)' }}>DynamoDB:</span>
            <span style={{ color: '#d8b4fe', fontWeight: 500 }}>load_test_results</span>
          </div>

          <button 
            onClick={fetchRuns} 
            className="btn-secondary" 
            title="Refresh Runs"
            disabled={loadingRuns}
          >
            <RefreshCw size={14} className={loadingRuns ? 'spin-anim' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Left Launcher & Right Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Launcher & Target Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Test Launcher Card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <Play size={18} color="#6366f1" />
              <h2 style={{ fontSize: '17px', fontWeight: 600 }}>Launch Ramp Test</h2>
            </div>

            {/* Target Endpoint Selection */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Target Endpoint
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                {[
                  { path: '/compute', label: 'CPU Loop', icon: Cpu },
                  { path: '/db', label: 'DDB I/O', icon: Database },
                  { path: '/health', label: '200 OK', icon: ShieldCheck }
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = endpoint === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => setEndpoint(item.path)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: isActive ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                        background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? '#c7d2fe' : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon size={16} color={isActive ? '#818cf8' : '#64748b'} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Concurrency Stages Preset */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Concurrency Ramp Stages
                </label>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {[
                  { label: '5 → 15 → 25', val: '5, 15, 25' },
                  { label: '10 → 50 → 100', val: '10, 50, 100' },
                  { label: '20 → 100 → 250', val: '20, 100, 250' }
                ].map(preset => (
                  <button
                    key={preset.val}
                    onClick={() => setCustomStages(preset.val)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      background: customStages === preset.val ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      borderColor: customStages === preset.val ? '#06b6d4' : 'var(--border-subtle)',
                      color: customStages === preset.val ? '#67e8f9' : 'var(--text-dim)',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customStages}
                onChange={e => setCustomStages(e.target.value)}
                placeholder="e.g. 10, 50, 100, 250"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            {/* Stage Duration */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Duration Per Stage
                </label>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{duration}s</span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10))}
                style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
              />
            </div>

            {/* Launch Button */}
            <button
              onClick={handleLaunchTest}
              disabled={isLaunching}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            >
              {isLaunching ? (
                <>
                  <RefreshCw size={16} className="spin-anim" />
                  <span>Orchestrating Stages ({executionStatus || 'INITIALIZING'})...</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>Start Step Functions Test</span>
                </>
              )}
            </button>

            {isLaunching && (
              <div style={{ marginTop: '16px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                  <span style={{ color: '#a5b4fc' }}>Execution Active:</span>
                  <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{activeExecution?.run_id}</span>
                </div>
                <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #6366f1, #06b6d4)', animation: 'pulseGlow 1.5s infinite' }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Target App Ping Inspector */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="#10b981" />
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Target Inspector</h3>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['/health', '/compute', '/db'].map(p => (
                  <button
                    key={p}
                    onClick={() => handlePingTarget(p)}
                    disabled={pingLoading}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {pingResult ? (
              <div style={{ background: 'rgba(0, 0, 0, 0.4)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ping: <strong style={{ color: '#fff' }}>{pingResult.path}</strong></span>
                  <span style={{ color: pingResult.status === 200 ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                    {pingResult.status} ({pingResult.latencyMs}ms)
                  </span>
                </div>
                <pre style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'var(--font-mono)', maxHeight: '100px', overflowY: 'auto' }}>
                  {JSON.stringify(pingResult.data || pingResult.error, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', padding: '12px' }}>
                Click an endpoint above to fire an instant test ping.
              </div>
            )}
          </div>

          {/* Test Runs History Selector */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="#a855f7" />
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Test Run History</h3>
              </div>
              <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe' }}>
                {runs.length} Runs
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {runs.map(run => {
                const isSelected = run.run_id === selectedRunId;
                return (
                  <div
                    key={run.run_id}
                    onClick={() => setSelectedRunId(run.run_id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                      border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#fff' : 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        {run.run_id}
                      </span>
                      <span style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 500 }}>
                        {run.endpoint || '/compute'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
                      <span>{run.request_count} requests</span>
                      <span>{new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Analytics & Visualizations */}
        <div>
          {loadingResults ? (
            <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
              <RefreshCw size={28} className="spin-anim" style={{ color: '#6366f1', marginBottom: '16px' }} />
              <p style={{ color: 'var(--text-muted)' }}>Aggregating test metrics from DynamoDB...</p>
            </div>
          ) : results ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Header of Selected Run */}
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#fff' }}>
                      {results.run_id}
                    </span>
                    <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#67e8f9', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                      {results.endpoint}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Aggregated across {results.stages?.length || 1} ramp stage(s) &bull; Tested on EC2 ({TARGET_URL})
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => fetchResults(results.run_id)} className="btn-secondary" style={{ fontSize: '12px' }}>
                    <RefreshCw size={13} />
                    <span>Reload Run</span>
                  </button>
                </div>
              </div>

              {/* KPI Metrics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                
                {/* Total Requests */}
                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Requests</span>
                    <CheckCircle2 size={16} color="#10b981" />
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '4px' }}>
                    {results.total_requests.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '11px', color: '#10b981' }}>
                    {results.success_count} success &bull; {results.error_count} errors
                  </div>
                </div>

                {/* Error Rate */}
                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Error Rate</span>
                    <AlertTriangle size={16} color={results.error_rate > 0 ? '#f43f5e' : '#10b981'} />
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: results.error_rate > 0 ? '#f43f5e' : '#10b981', marginBottom: '4px' }}>
                    {results.error_rate}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {results.error_count === 0 ? 'Zero dropped connections' : `${results.error_count} dropped requests`}
                  </div>
                </div>

                {/* Average Latency */}
                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Avg Latency</span>
                    <Clock size={16} color="#6366f1" />
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#c7d2fe', marginBottom: '4px' }}>
                    {results.avg_latency_ms}<span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-dim)' }}>ms</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Median (p50): <strong style={{ color: '#e0e7ff' }}>{results.p50_latency_ms}ms</strong>
                  </div>
                </div>

                {/* p95 & p99 Tail Latency */}
                <div className="glass-panel" style={{ padding: '18px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tail Latency</span>
                    <TrendingUp size={16} color="#f59e0b" />
                  </div>
                  <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-heading)', color: '#fde68a', marginBottom: '4px' }}>
                    {results.p95_latency_ms}<span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-dim)' }}>ms</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    p90: {results.p90_latency_ms}ms &bull; p99: {results.p99_latency_ms}ms
                  </div>
                </div>
              </div>

              {/* Concurrency Stages Breakdown Chart */}
              {results.stages && results.stages.length > 0 && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                        Concurrency Stage Escalation
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Latency degradation curve as concurrent clients increase
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '11px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8' }}>
                        <span style={{ width: '10px', height: '10px', background: '#6366f1', borderRadius: '2px' }}></span> p50
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b' }}>
                        <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px' }}></span> p95
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#06b6d4' }}>
                        <span style={{ width: '10px', height: '10px', background: '#06b6d4', borderRadius: '2px' }}></span> Avg
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Stage Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {results.stages.map((stage) => {
                      const maxStageLatency = Math.max(...results.stages.map(s => s.p95_latency_ms || 1));
                      const p50Width = Math.max(8, ((stage.p50_latency_ms || 1) / maxStageLatency) * 100);
                      const p95Width = Math.max(8, ((stage.p95_latency_ms || 1) / maxStageLatency) * 100);

                      return (
                        <div key={stage.concurrency_stage} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: '#38bdf8' }}>
                                Stage: {stage.concurrency_stage} Concurrency
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                ({stage.total_requests} requests)
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                              <span style={{ color: '#818cf8' }}>p50: {stage.p50_latency_ms}ms</span>
                              <span style={{ color: '#f59e0b' }}>p95: {stage.p95_latency_ms}ms</span>
                              <span style={{ color: '#38bdf8' }}>avg: {stage.avg_latency_ms}ms</span>
                            </div>
                          </div>

                          {/* Dual Bar Representation */}
                          <div style={{ position: 'relative', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            {/* p95 Bar */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: `${p95Width}%`,
                              background: 'linear-gradient(90deg, #f59e0b, #f43f5e)',
                              borderRadius: '4px'
                            }}></div>
                            {/* p50 Bar Overlay */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: `${p50Width}%`,
                              background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                              borderRadius: '4px'
                            }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Second-by-Second Throughput Timeline */}
              {results.timeline && results.timeline.length > 0 && (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Throughput & Latency Timeline</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Requests/sec and average response time per second</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', paddingTop: '20px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
                    {results.timeline.map((point, idx) => {
                      const maxRps = Math.max(...results.timeline.map(p => p.requests_per_sec || 1));
                      const barHeight = Math.max(12, (point.requests_per_sec / maxRps) * 100);

                      return (
                        <div
                          key={idx}
                          title={`${point.time}: ${point.requests_per_sec} req/s, ${point.avg_latency_ms}ms`}
                          style={{
                            flex: 1,
                            minWidth: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            gap: '4px'
                          }}
                        >
                          <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {point.requests_per_sec}
                          </span>
                          <div
                            style={{
                              width: '100%',
                              height: `${barHeight}%`,
                              background: 'linear-gradient(180deg, #06b6d4 0%, #6366f1 100%)',
                              borderRadius: '4px 4px 0 0',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                          ></div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                    <span>{results.timeline[0]?.time}</span>
                    <span>Elapsed Seconds ({results.timeline.length}s total)</span>
                    <span>{results.timeline[results.timeline.length - 1]?.time}</span>
                  </div>
                </div>
              )}

              {/* Tabular Stage Summary */}
              {results.stages && (
                <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px' }}>Stage Summary Table</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                        <th style={{ padding: '8px 12px' }}>CONCURRENCY</th>
                        <th style={{ padding: '8px 12px' }}>REQUESTS</th>
                        <th style={{ padding: '8px 12px' }}>ERRORS</th>
                        <th style={{ padding: '8px 12px' }}>AVG</th>
                        <th style={{ padding: '8px 12px' }}>P50</th>
                        <th style={{ padding: '8px 12px' }}>P95</th>
                        <th style={{ padding: '8px 12px' }}>P99</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.stages.map(st => (
                        <tr key={st.concurrency_stage} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                            {st.concurrency_stage} workers
                          </td>
                          <td style={{ padding: '10px 12px' }}>{st.total_requests}</td>
                          <td style={{ padding: '10px 12px', color: st.error_count > 0 ? '#f43f5e' : '#10b981' }}>
                            {st.error_count} ({st.error_rate}%)
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>{st.avg_latency_ms}ms</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#818cf8' }}>{st.p50_latency_ms}ms</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>{st.p95_latency_ms}ms</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#f43f5e' }}>{st.p99_latency_ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '80px', textAlign: 'center' }}>
              <Layers size={36} color="#64748b" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>No Test Run Selected</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Select a previous run from the sidebar or click "Start Step Functions Test" to launch your first load test.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
