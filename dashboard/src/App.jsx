import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Play, 
  RefreshCw, 
  Terminal, 
  ArrowUpRight, 
  Cpu, 
  Database, 
  ShieldCheck, 
  CircleDot,
  Check,
  ChevronRight,
  Server,
  CornerDownRight
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || 'https://637e6fe800.execute-api.ap-south-1.amazonaws.com';
const TARGET_URL = import.meta.env.VITE_TARGET_APP_URL || 'http://15.206.190.14:3000';

export default function App() {
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [results, setResults] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  // Test Launcher State
  const [endpoint, setEndpoint] = useState('/compute');
  const [customStages, setCustomStages] = useState('5, 15, 25');
  const [duration, setDuration] = useState(5);
  const [isLaunching, setIsLaunching] = useState(false);
  const [activeExecution, setActiveExecution] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);

  // Direct Ping Inspector State
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // Live Heartbeat Stream State (Real-time target monitor)
  const [heartbeatData, setHeartbeatData] = useState([]);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

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
  const fetchResults = async (runId, silent = false) => {
    if (!runId) return;
    if (!silent) setLoadingResults(true);
    try {
      const res = await fetch(`${API_BASE}/results?run_id=${encodeURIComponent(runId)}`);
      const data = await res.json();
      if (data && !data.error) {
        setResults(data);
      }
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      if (!silent) setLoadingResults(false);
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

  // 3. Execution Polling (Polls Step Functions + Live DynamoDB results stream!)
  useEffect(() => {
    if (!activeExecution) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status?execution_arn=${encodeURIComponent(activeExecution.execution_arn)}`);
        const data = await res.json();
        setExecutionStatus(data.status);

        // Live update the results graph while test is actively running!
        fetchResults(activeExecution.run_id, true);

        if (data.status === 'SUCCEEDED' || data.status === 'FAILED' || data.status === 'TIMED_OUT') {
          clearInterval(interval);
          setIsLaunching(false);
          setActiveExecution(null);
          await fetchRuns();
          setSelectedRunId(activeExecution.run_id);
          fetchResults(activeExecution.run_id);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeExecution]);

  // 3b. Real-Time Live Server Heartbeat Stream (Sequential polling to EC2 target)
  useEffect(() => {
    if (!isLiveStreaming) return;
    let isActive = true;
    let timerId = null;

    const probe = async () => {
      const start = Date.now();
      const pingUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? '/api/target/health'
        : `${TARGET_URL}/health`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(pingUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const latencyMs = Date.now() - start;
        if (isActive) {
          setHeartbeatData(prev => {
            const next = [...prev, {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              latencyMs,
              status: res.status
            }];
            return next.slice(-28); // Keep last 28 points
          });
        }
      } catch (err) {
        const latencyMs = Date.now() - start;
        if (isActive) {
          setHeartbeatData(prev => {
            const next = [...prev, {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              latencyMs: Math.min(6000, latencyMs),
              status: 0
            }];
            return next.slice(-28);
          });
        }
      } finally {
        if (isActive) {
          timerId = setTimeout(probe, 1500); // Wait 1.5s AFTER request finishes before probing again
        }
      }
    };

    probe();

    return () => {
      isActive = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isLiveStreaming]);

  // 4. Launch New Load Test
  const handleLaunchTest = async () => {
    setIsLaunching(true);
    const parsedStages = customStages
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
    const runId = `run-${Date.now().toString().slice(-6)}`;

    // Set selected run immediately so live graph is wired up
    setSelectedRunId(runId);

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

  // 5. Target App Direct Ping (via dev proxy to avoid browser CORS)
  const handlePingTarget = async (testPath = '/health') => {
    setPingLoading(true);
    const start = Date.now();
    try {
      const pingUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `/api/target${testPath}`
        : `${TARGET_URL}${testPath}`;
      const res = await fetch(pingUrl);
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
        status: 'Err',
        latencyMs: Date.now() - start,
        error: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setPingLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      {/* Editorial Top Masthead */}
      <header style={{ 
        borderBottom: '1px solid var(--border-hairline)', 
        background: 'var(--bg-surface)',
        padding: '0 36px'
      }}>
        <div style={{ 
          maxWidth: '1380px', 
          margin: '0 auto', 
          height: '70px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Logo & Platform Name */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
            <span className="display-serif" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              LoadLite
            </span>
            <span style={{ height: '14px', width: '1px', background: 'var(--border-strong)' }}></span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>
              Closed-Loop AWS Load Benchmark
            </span>
          </div>

          {/* System Environment Callouts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-green)' }}></span>
              <span className="editorial-label" style={{ fontSize: '10px' }}>Target:</span>
              <span className="mono-numeric" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {TARGET_URL.replace(/^https?:\/\//, '')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span className="editorial-label" style={{ fontSize: '10px' }}>Region:</span>
              <span className="mono-numeric" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                ap-south-1
              </span>
            </div>

            <button 
              onClick={fetchRuns}
              disabled={loadingRuns}
              className="btn-editorial-secondary"
              title="Sync Results"
            >
              <RefreshCw size={13} className={loadingRuns ? 'spin-anim' : ''} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1380px', margin: '0 auto', padding: '36px 36px 72px' }}>
        
        {/* Architecture Grid: Control Column & Analytics Surface */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '40px', alignItems: 'start' }}>
          
          {/* ================= LEFT COLUMN: WORKFLOW CONTROLS ================= */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* Test Orchestration Console */}
            <section className="editorial-panel" style={{ padding: '24px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <span className="editorial-label">01 / Ramp Controller</span>
                <span className="editorial-pill" style={{ color: 'var(--accent-burnt)' }}>
                  Step Functions
                </span>
              </div>

              {/* Endpoint selection */}
              <div style={{ marginBottom: '22px' }}>
                <label className="editorial-label" style={{ display: 'block', marginBottom: '8px' }}>
                  Target Endpoint
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[
                    { id: '/compute', label: '/compute', sub: 'CPU loop' },
                    { id: '/db', label: '/db', sub: 'Dynamo I/O' },
                    { id: '/health', label: '/health', sub: '200 OK' }
                  ].map(ep => {
                    const active = endpoint === ep.id;
                    return (
                      <button
                        key={ep.id}
                        onClick={() => setEndpoint(ep.id)}
                        style={{
                          background: active ? 'var(--accent-ink)' : 'var(--bg-subtle)',
                          color: active ? '#ffffff' : 'var(--text-primary)',
                          border: `1px solid ${active ? 'var(--accent-ink)' : 'var(--border-hairline)'}`,
                          borderRadius: '2px',
                          padding: '10px 6px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.12s ease'
                        }}
                      >
                        <div className="mono-numeric" style={{ fontSize: '12px', fontWeight: 600 }}>
                          {ep.label}
                        </div>
                        <div style={{ fontSize: '10px', color: active ? '#a8a29e' : 'var(--text-muted)', marginTop: '2px' }}>
                          {ep.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Concurrency Stages Input */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <label className="editorial-label">Concurrency Stages</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Workers per stage</span>
                </div>
                
                {/* Presets */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  {['5, 15, 25', '10, 50, 100', '25, 75, 150'].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setCustomStages(preset)}
                      style={{
                        flex: 1,
                        background: customStages === preset ? 'var(--bg-subtle)' : 'transparent',
                        border: `1px solid ${customStages === preset ? 'var(--border-strong)' : 'var(--border-hairline)'}`,
                        borderRadius: '2px',
                        padding: '4px 2px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: customStages === preset ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={customStages}
                  onChange={e => setCustomStages(e.target.value)}
                  placeholder="5, 15, 25"
                  style={{
                    width: '100%',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: '2px',
                    padding: '8px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Duration Slider */}
              <div style={{ marginBottom: '26px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <label className="editorial-label">Stage Duration</label>
                  <span className="mono-numeric" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-burnt)' }}>
                    {duration}s <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>/ stage</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-ink)',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Launch CTA */}
              <button
                onClick={handleLaunchTest}
                disabled={isLaunching}
                className="btn-editorial-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
              >
                {isLaunching ? (
                  <>
                    <RefreshCw size={14} className="spin-anim" />
                    <span>Orchestrating ({executionStatus || 'INITIALIZING'})...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>Run Concurrency Ramp</span>
                  </>
                )}
              </button>

              {/* In-Flight Execution Progress Tracker */}
              {isLaunching && (
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  background: 'var(--bg-subtle)', 
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '2px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                    <span className="editorial-label" style={{ fontSize: '10px' }}>Active Execution:</span>
                    <span className="mono-numeric" style={{ color: 'var(--text-primary)' }}>{activeExecution?.run_id}</span>
                  </div>
                  <div style={{ height: '2px', background: 'var(--border-hairline)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '100%', background: 'var(--accent-burnt)', animation: 'livePulse 1s infinite' }}></div>
                  </div>
                </div>
              )}
            </section>

            {/* Target Direct Inspector */}
            <section className="editorial-panel" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span className="editorial-label">02 / Target Probe</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Single ping test</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                {['/health', '/compute', '/db'].map(p => (
                  <button
                    key={p}
                    onClick={() => handlePingTarget(p)}
                    disabled={pingLoading}
                    className="btn-editorial-secondary"
                    style={{ flex: 1, padding: '5px 2px', fontSize: '11px', justifyContent: 'center' }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {pingResult ? (
                <div style={{ 
                  background: 'var(--bg-subtle)', 
                  border: '1px solid var(--border-hairline)', 
                  padding: '12px',
                  borderRadius: '2px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                    <span className="mono-numeric" style={{ fontWeight: 600 }}>{pingResult.path}</span>
                    <span className="mono-numeric" style={{ 
                      color: pingResult.status === 200 ? 'var(--status-green)' : 'var(--status-red)',
                      fontWeight: 600
                    }}>
                      {pingResult.status} &bull; {pingResult.latencyMs}ms
                    </span>
                  </div>
                  <pre style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '10px', 
                    color: 'var(--text-secondary)',
                    maxHeight: '90px', 
                    overflowY: 'auto' 
                  }}>
                    {JSON.stringify(pingResult.data || pingResult.error, null, 2)}
                  </pre>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                  Probe the EC2 instance to verify baseline connectivity.
                </div>
              )}
            </section>

            {/* Past Test Runs Ledger */}
            <section className="editorial-panel" style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span className="editorial-label">03 / Run Ledger</span>
                <span className="mono-numeric" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {runs.length} recorded
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                {runs.map(run => {
                  const isSelected = run.run_id === selectedRunId;
                  return (
                    <div
                      key={run.run_id}
                      onClick={() => setSelectedRunId(run.run_id)}
                      style={{
                        padding: '10px 12px',
                        background: isSelected ? 'var(--bg-canvas)' : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--accent-burnt)' : '2px solid transparent',
                        borderBottom: '1px solid var(--border-hairline)',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                        <span className="mono-numeric" style={{ 
                          fontSize: '12px', 
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}>
                          {run.run_id}
                        </span>
                        <span className="mono-numeric" style={{ fontSize: '10px', color: 'var(--accent-burnt)' }}>
                          {run.endpoint}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span className="mono-numeric">{run.request_count} requests</span>
                        <span>{new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* ================= RIGHT COLUMN: ANALYTICS & FINDINGS ================= */}
          <div>
            {/* Live Server Telemetry & Heartbeat Oscilloscope */}
            <section className="editorial-panel" style={{ padding: '20px 24px', marginBottom: '28px', borderLeft: '3px solid var(--accent-burnt)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    background: isLiveStreaming ? 'var(--status-green)' : 'var(--text-muted)',
                    display: 'inline-block',
                    boxShadow: isLiveStreaming ? '0 0 8px rgba(21, 128, 61, 0.6)' : 'none'
                  }}></span>
                  <span className="editorial-label" style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                    Live Target Pulse
                  </span>
                  <span className="editorial-pill" style={{ fontSize: '10px' }}>
                    EC2 t3.micro &bull; /health
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {heartbeatData.length > 0 && (() => {
                    const latest = heartbeatData[heartbeatData.length - 1];
                    const isSaturated = latest.latencyMs >= 1500;
                    const isDegraded = latest.latencyMs >= 300 && latest.latencyMs < 1500;
                    return (
                      <div className="mono-numeric" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '2px 7px',
                          borderRadius: '3px',
                          background: isSaturated ? 'rgba(185, 28, 28, 0.1)' : isDegraded ? 'rgba(180, 83, 9, 0.1)' : 'rgba(21, 128, 61, 0.1)',
                          color: isSaturated ? 'var(--status-red)' : isDegraded ? 'var(--accent-burnt)' : 'var(--status-green)',
                          fontWeight: 600
                        }}>
                          {isSaturated ? 'Saturated / Queued' : isDegraded ? 'Load Elevating' : 'Responsive'}
                        </span>
                        <span>Live: <strong style={{ 
                          color: isSaturated ? 'var(--status-red)' : isDegraded ? 'var(--accent-burnt)' : 'var(--status-green)'
                        }}>{latest.latencyMs}ms</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Peak: {Math.max(...heartbeatData.map(h => h.latencyMs))}ms</span>
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                    className="btn-editorial-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    {isLiveStreaming ? 'Pause Pulse' : 'Resume Pulse'}
                  </button>
                </div>
              </div>

              {/* Oscilloscope Waveform */}
              {heartbeatData.length > 1 ? (
                <div>
                  {(() => {
                    const data = heartbeatData;
                    const maxH = Math.max(100, ...data.map(d => d.latencyMs));
                    const w = 720;
                    const h = 80;
                    const padL = 45;
                    const padR = 20;
                    const padT = 12;
                    const padB = 18;
                    const plotW = w - padL - padR;
                    const plotH = h - padT - padB;

                    const points = data.map((d, i) => ({
                      x: padL + (i / (data.length - 1)) * plotW,
                      y: padT + plotH - (Math.min(maxH, d.latencyMs) / maxH) * plotH,
                      ms: d.latencyMs,
                      status: d.status
                    }));

                    const area = `
                      M ${points[0].x} ${padT + plotH}
                      ${points.map(p => `L ${p.x} ${p.y}`).join(' ')}
                      L ${points[points.length - 1].x} ${padT + plotH}
                      Z
                    `;
                    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                    return (
                      <div style={{ width: '100%', overflowX: 'hidden' }}>
                        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                          <defs>
                            <linearGradient id="liveWave" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#b45309" stopOpacity="0.30" />
                              <stop offset="100%" stopColor="#b45309" stopOpacity="0.01" />
                            </linearGradient>
                          </defs>

                          {/* Grid line */}
                          <line x1={padL} y1={padT + plotH} x2={w - padR} y2={padT + plotH} stroke="#e6e2d8" strokeWidth="1" />
                          <line x1={padL} y1={padT} x2={w - padR} y2={padT} stroke="#f2efe8" strokeDasharray="3 3" />

                          {/* Y-axis label */}
                          <text x={padL - 8} y={padT + 7} textAnchor="end" fill="#8a8479" fontSize="9" fontFamily="var(--font-mono)">
                            {maxH}ms
                          </text>
                          <text x={padL - 8} y={padT + plotH} textAnchor="end" fill="#8a8479" fontSize="9" fontFamily="var(--font-mono)">
                            0ms
                          </text>

                          {/* Area & Line */}
                          <path d={area} fill="url(#liveWave)" />
                          <path d={line} fill="none" stroke="var(--accent-burnt)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Latest Point Pulsing Dot */}
                          {points.length > 0 && (
                            <g>
                              <circle 
                                cx={points[points.length - 1].x} 
                                cy={points[points.length - 1].y} 
                                r="4.5" 
                                fill="#ffffff" 
                                stroke="var(--accent-burnt)" 
                                strokeWidth="2.5" 
                              />
                            </g>
                          )}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                  Listening for server heartbeat pulses...
                </div>
              )}
            </section>

            {loadingResults ? (
              <div className="editorial-panel" style={{ padding: '80px', textAlign: 'center' }}>
                <RefreshCw size={24} className="spin-anim" style={{ color: 'var(--text-muted)', marginBottom: '14px' }} />
                <p className="display-serif" style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                  Compiling telemetry from DynamoDB...
                </p>
              </div>
            ) : results ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>

                {/* Run Metadata Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-end', 
                  borderBottom: '1px solid var(--border-hairline)',
                  paddingBottom: '20px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span className="editorial-label">Run Telemetry</span>
                      <span style={{ color: 'var(--border-strong)' }}>/</span>
                      <span className="mono-numeric" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {results.run_id}
                      </span>
                    </div>
                    <h2 className="display-serif" style={{ fontSize: '32px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                      Benchmarking {results.endpoint}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="editorial-pill">
                      {results.stages?.length || 1} Ramp Stages
                    </span>
                    <button 
                      onClick={() => fetchResults(results.run_id)} 
                      className="btn-editorial-secondary"
                    >
                      <RefreshCw size={12} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Big Stat Numbers Grid (Editorial broadsheet style) */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  border: '1px solid var(--border-hairline)',
                  background: 'var(--bg-surface)'
                }}>
                  {/* Total Requests */}
                  <div style={{ padding: '24px 22px', borderRight: '1px solid var(--border-hairline)' }}>
                    <div className="editorial-label" style={{ marginBottom: '8px' }}>Total Volume</div>
                    <div className="display-serif" style={{ fontSize: '42px', fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>
                      {results.total_requests.toLocaleString()}
                    </div>
                    <div className="mono-numeric" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {results.success_count} ok &bull; {results.error_count} err
                    </div>
                  </div>

                  {/* Median p50 Latency */}
                  <div style={{ padding: '24px 22px', borderRight: '1px solid var(--border-hairline)' }}>
                    <div className="editorial-label" style={{ marginBottom: '8px' }}>Median (p50)</div>
                    <div className="display-serif" style={{ fontSize: '42px', fontWeight: 600, lineHeight: 1.1, color: 'var(--text-primary)' }}>
                      {results.p50_latency_ms}<span style={{ fontSize: '20px', fontWeight: 400, color: 'var(--text-muted)' }}>ms</span>
                    </div>
                    <div className="mono-numeric" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Avg: {results.avg_latency_ms}ms
                    </div>
                  </div>

                  {/* Tail p95 Latency */}
                  <div style={{ padding: '24px 22px', borderRight: '1px solid var(--border-hairline)' }}>
                    <div className="editorial-label" style={{ marginBottom: '8px' }}>Tail (p95)</div>
                    <div className="display-serif" style={{ 
                      fontSize: '42px', 
                      fontWeight: 600, 
                      lineHeight: 1.1, 
                      color: results.p95_latency_ms > 2000 ? 'var(--accent-burnt)' : 'var(--text-primary)' 
                    }}>
                      {results.p95_latency_ms}<span style={{ fontSize: '20px', fontWeight: 400, color: 'var(--text-muted)' }}>ms</span>
                    </div>
                    <div className="mono-numeric" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      p90: {results.p90_latency_ms}ms &bull; p99: {results.p99_latency_ms}ms
                    </div>
                  </div>

                  {/* Error Rate */}
                  <div style={{ padding: '24px 22px' }}>
                    <div className="editorial-label" style={{ marginBottom: '8px' }}>Failure Rate</div>
                    <div className="display-serif" style={{ 
                      fontSize: '42px', 
                      fontWeight: 600, 
                      lineHeight: 1.1, 
                      color: results.error_rate > 0 ? 'var(--status-red)' : 'var(--status-green)' 
                    }}>
                      {results.error_rate}<span style={{ fontSize: '20px', fontWeight: 400, color: 'var(--text-muted)' }}>%</span>
                    </div>
                    <div className="mono-numeric" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {results.error_count === 0 ? 'Zero dropped frames' : `${results.error_count} dropped`}
                    </div>
                  </div>
                </div>

                {/* Section: Server Saturation & Visual Escalation Curve */}
                {results.stages && results.stages.length > 0 && (
                  <section className="editorial-panel" style={{ padding: '28px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="editorial-label">Escalation Curve</span>
                          <span style={{ color: 'var(--border-strong)' }}>/</span>
                          <span className="editorial-pill" style={{ 
                            background: results.error_rate > 10 || results.p95_latency_ms > 4000 ? '#fef2f2' : '#f0fdf4',
                            color: results.error_rate > 10 || results.p95_latency_ms > 4000 ? 'var(--status-red)' : 'var(--status-green)',
                            border: `1px solid ${results.error_rate > 10 || results.p95_latency_ms > 4000 ? '#fecaca' : '#bbf7d0'}`
                          }}>
                            {results.error_rate > 10 || results.p95_latency_ms > 4000 ? '⚠️ Server Saturated / Breaking Point' : '✅ Optimal Operating Range'}
                          </span>
                        </div>
                        <h3 className="display-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Server Latency & Saturation Curve
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Visualizing response time spiking upwards as concurrent traffic escalates
                        </p>
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '12px', height: '2px', background: 'var(--accent-burnt)', display: 'inline-block' }}></span>
                          <span className="editorial-label" style={{ fontSize: '10px', color: 'var(--accent-burnt)' }}>Tail p95</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '12px', height: '2px', background: 'var(--text-primary)', borderTop: '2px dashed var(--text-primary)', display: 'inline-block' }}></span>
                          <span className="editorial-label" style={{ fontSize: '10px' }}>Median p50</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '12px', height: '2px', borderTop: '2px dashed var(--status-red)', display: 'inline-block' }}></span>
                          <span className="editorial-label" style={{ fontSize: '10px', color: 'var(--status-red)' }}>Drop Zone</span>
                        </span>
                      </div>
                    </div>

                    {/* Visual SVG Curve going high */}
                    <div style={{ padding: '10px 0' }}>
                      {(() => {
                        const stages = results.stages;
                        const maxVal = Math.max(10500, ...stages.map(s => s.p95_latency_ms || 1));
                        const chartWidth = 720;
                        const chartHeight = 250;
                        const padLeft = 70;
                        const padRight = 40;
                        const padTop = 30;
                        const padBottom = 45;
                        const plotWidth = chartWidth - padLeft - padRight;
                        const plotHeight = chartHeight - padTop - padBottom;

                        const pointsP95 = stages.map((st, i) => {
                          const x = stages.length === 1 
                            ? padLeft + plotWidth / 2 
                            : padLeft + (i / (stages.length - 1)) * plotWidth;
                          const y = padTop + plotHeight - ((st.p95_latency_ms || 0) / maxVal) * plotHeight;
                          return { x, y, val: st.p95_latency_ms, stage: st.concurrency_stage };
                        });

                        const pointsP50 = stages.map((st, i) => {
                          const x = stages.length === 1 
                            ? padLeft + plotWidth / 2 
                            : padLeft + (i / (stages.length - 1)) * plotWidth;
                          const y = padTop + plotHeight - ((st.p50_latency_ms || 0) / maxVal) * plotHeight;
                          return { x, y, val: st.p50_latency_ms, stage: st.concurrency_stage };
                        });

                        const areaPath = pointsP95.length > 1 ? `
                          M ${pointsP95[0].x} ${padTop + plotHeight}
                          ${pointsP95.map(p => `L ${p.x} ${p.y}`).join(' ')}
                          L ${pointsP95[pointsP95.length - 1].x} ${padTop + plotHeight}
                          Z
                        ` : '';

                        const linePathP95 = pointsP95.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const linePathP50 = pointsP50.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const ceilingY = padTop + plotHeight - (10000 / maxVal) * plotHeight;

                        return (
                          <div style={{ width: '100%', overflowX: 'auto' }}>
                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                              <defs>
                                <linearGradient id="surgeGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#c2410c" stopOpacity="0.30" />
                                  <stop offset="60%" stopColor="#b45309" stopOpacity="0.15" />
                                  <stop offset="100%" stopColor="#b45309" stopOpacity="0.02" />
                                </linearGradient>
                              </defs>

                              {/* Horizontal Gridlines & Y-Axis */}
                              {[0, 2500, 5000, 7500, 10000].map((tick) => {
                                const y = padTop + plotHeight - (tick / maxVal) * plotHeight;
                                return (
                                  <g key={tick}>
                                    <line x1={padLeft} y1={y} x2={chartWidth - padRight} y2={y} stroke="#e6e2d8" strokeDasharray="3 3" />
                                    <text x={padLeft - 12} y={y + 4} textAnchor="end" fill="#8a8479" fontSize="10" fontFamily="var(--font-mono)">
                                      {tick.toLocaleString()}ms
                                    </text>
                                  </g>
                                );
                              })}

                              {/* 10,000ms Redline Ceiling */}
                              <line x1={padLeft} y1={ceilingY} x2={chartWidth - padRight} y2={ceilingY} stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="5 4" />
                              <text x={chartWidth - padRight} y={ceilingY - 6} textAnchor="end" fill="#b91c1c" fontSize="10" fontWeight="600" fontFamily="var(--font-mono)">
                                10,000ms Timeout Limit (Connections Dropped)
                              </text>

                              {/* Rising Area Gradient */}
                              {areaPath && <path d={areaPath} fill="url(#surgeGradient)" />}

                              {/* p50 Dotted Line */}
                              {linePathP50 && (
                                <path d={linePathP50} fill="none" stroke="#1c1917" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
                              )}

                              {/* p95 Solid Rising Surge Line */}
                              {linePathP95 && (
                                <path d={linePathP95} fill="none" stroke="#b45309" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              )}

                              {/* p95 Marker Dots & Values */}
                              {pointsP95.map((p, idx) => (
                                <g key={`p95-dot-${idx}`}>
                                  <circle cx={p.x} cy={p.y} r="5.5" fill="#ffffff" stroke="#b45309" strokeWidth="3" />
                                  <rect 
                                    x={p.x - 28} 
                                    y={p.y - 25} 
                                    width="56" 
                                    height="18" 
                                    rx="2" 
                                    fill="var(--bg-surface)" 
                                    stroke="var(--border-hairline)" 
                                  />
                                  <text x={p.x} y={p.y - 13} textAnchor="middle" fill="#b45309" fontSize="11" fontWeight="700" fontFamily="var(--font-mono)">
                                    {p.val}ms
                                  </text>
                                </g>
                              ))}

                              {/* p50 Marker Dots */}
                              {pointsP50.map((p, idx) => (
                                <circle key={`p50-dot-${idx}`} cx={p.x} cy={p.y} r="3.5" fill="#1c1917" />
                              ))}

                              {/* X-Axis Tiers */}
                              {pointsP95.map((p, idx) => (
                                <g key={`x-lbl-${idx}`}>
                                  <line x1={p.x} y1={padTop + plotHeight} x2={p.x} y2={padTop + plotHeight + 6} stroke="#c8c2b4" />
                                  <text x={p.x} y={padTop + plotHeight + 20} textAnchor="middle" fill="#1c1917" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)">
                                    Tier {p.stage}
                                  </text>
                                  <text x={p.x} y={padTop + plotHeight + 33} textAnchor="middle" fill="#8a8479" fontSize="9" fontFamily="var(--font-sans)">
                                    {p.stage.toLocaleString()} concurrent users
                                  </text>
                                </g>
                              ))}
                            </svg>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Saturation Analysis Note */}
                    <div style={{ 
                      marginTop: '20px', 
                      padding: '14px 18px', 
                      background: results.error_rate > 10 ? '#fffbeb' : 'var(--bg-subtle)', 
                      border: `1px solid ${results.error_rate > 10 ? '#fde68a' : 'var(--border-hairline)'}`,
                      borderRadius: '2px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <div style={{ 
                        fontSize: '18px', 
                        color: results.error_rate > 10 ? 'var(--accent-burnt)' : 'var(--status-green)',
                        lineHeight: 1
                      }}>
                        {results.error_rate > 10 ? '⚡' : '✓'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {results.error_rate > 10 ? (
                          <>
                            <strong>Breaking Point Identified:</strong> Response times shot up past the <strong>10,000ms timeout ceiling</strong> with <strong>{results.error_rate}% error rate</strong>. The server CPU and network socket backlogs were completely saturated by the concurrent flood.
                          </>
                        ) : (
                          <>
                            <strong>Healthy Operating Envelope:</strong> The server processed all concurrent tiers within sub-second latencies with <strong>0.0% dropped connections</strong>.
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Section: Throughput Timeline Chart */}
                {results.timeline && results.timeline.length > 0 && (
                  <section className="editorial-panel" style={{ padding: '28px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '12px' }}>
                      <div>
                        <h3 className="display-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Throughput Distribution
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Requests completed per elapsed second
                        </p>
                      </div>
                      <div className="mono-numeric" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Span: {results.timeline.length} seconds
                      </div>
                    </div>

                    {/* Fine Bar Columns */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-end', 
                      gap: '4px', 
                      height: '130px', 
                      borderBottom: '1px solid var(--border-strong)',
                      paddingTop: '20px',
                      overflowX: 'auto'
                    }}>
                      {results.timeline.map((point, idx) => {
                        const maxRps = Math.max(...results.timeline.map(p => p.requests_per_sec || 1));
                        const height = Math.max(6, (point.requests_per_sec / maxRps) * 100);

                        return (
                          <div
                            key={idx}
                            title={`${point.time} — ${point.requests_per_sec} req/s (${point.avg_latency_ms}ms)`}
                            style={{
                              flex: 1,
                              minWidth: '18px',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span className="mono-numeric" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                              {point.requests_per_sec}
                            </span>
                            <div style={{
                              width: '100%',
                              height: `${height}%`,
                              background: 'var(--accent-ink)',
                              opacity: 0.85,
                              transition: 'all 0.15s ease'
                            }} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                      <span>Start: {results.timeline[0]?.time}</span>
                      <span>Timeline Axis</span>
                      <span>End: {results.timeline[results.timeline.length - 1]?.time}</span>
                    </div>
                  </section>
                )}

                {/* Section: Tabular Breakdown */}
                {results.stages && (
                  <section className="editorial-panel" style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h3 className="display-serif" style={{ fontSize: '18px', fontWeight: 600 }}>
                        Tier Metrics Breakdown
                      </h3>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-hairline)', textAlign: 'left' }}>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>CONCURRENCY</th>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>TOTAL REQS</th>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>ERRORS</th>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>AVG</th>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>P50</th>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>P95</th>
                          <th className="editorial-label" style={{ padding: '8px 12px' }}>P99</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.stages.map(st => (
                          <tr key={st.concurrency_stage} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                            <td className="mono-numeric" style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {st.concurrency_stage} clients
                            </td>
                            <td className="mono-numeric" style={{ padding: '12px' }}>
                              {st.total_requests}
                            </td>
                            <td className="mono-numeric" style={{ 
                              padding: '12px', 
                              color: st.error_count > 0 ? 'var(--status-red)' : 'var(--status-green)' 
                            }}>
                              {st.error_count} ({st.error_rate}%)
                            </td>
                            <td className="mono-numeric" style={{ padding: '12px' }}>{st.avg_latency_ms}ms</td>
                            <td className="mono-numeric" style={{ padding: '12px', fontWeight: 600 }}>{st.p50_latency_ms}ms</td>
                            <td className="mono-numeric" style={{ padding: '12px', color: 'var(--accent-burnt)', fontWeight: 600 }}>{st.p95_latency_ms}ms</td>
                            <td className="mono-numeric" style={{ padding: '12px', color: 'var(--text-muted)' }}>{st.p99_latency_ms}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

              </div>
            ) : (
              <div className="editorial-panel" style={{ padding: '80px', textAlign: 'center' }}>
                <h3 className="display-serif" style={{ fontSize: '24px', fontWeight: 500, marginBottom: '8px' }}>
                  No Telemetry Selected
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Select an execution from the run ledger or launch a new ramp test.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
