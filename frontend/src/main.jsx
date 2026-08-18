import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS = API.replace(/^http/, 'ws') + '/ws'

function Metric({label, value}) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }

function Junction({j}) {
  const max = Math.max(1, j.queue)
  return <div className="junction-card">
    <div className="junction-title"><strong>{j.id}</strong><span className="phase">{j.phase} green</span></div>
    <div className="cross">
      <div className="arm north" style={{opacity: .35 + j.north/max}}>{j.north}</div>
      <div className="arm west" style={{opacity: .35 + j.west/max}}>{j.west}</div>
      <div className="center">{j.queue}</div>
      <div className="arm east" style={{opacity: .35 + j.east/max}}>{j.east}</div>
      <div className="arm south" style={{opacity: .35 + j.south/max}}>{j.south}</div>
    </div>
  </div>
}

function App() {
  const [state, setState] = useState(null)
  const [controller, setController] = useState('predictive-pressure-v1')
  const [bench, setBench] = useState([])
  const [connected, setConnected] = useState(false)
  const getState = async () => setState(await (await fetch(`${API}/api/state`)).json())
  useEffect(() => { getState() }, [])
  useEffect(() => {
    const ws = new WebSocket(WS)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = e => setState(JSON.parse(e.data))
    return () => ws.close()
  }, [])
  const avgQueue = useMemo(() => state ? Math.round(state.total_wait / Math.max(1, state.tick)) : 0, [state])
  const post = async (path, body={}) => {
    const res = await fetch(`${API}${path}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})
    const data = await res.json(); if (data.junctions) setState(data); return data
  }
  const reset = () => post('/api/reset', {controller, scenario:'normal', seed:7})
  const benchmark = async () => setBench((await (await fetch(`${API}/api/benchmark?steps=120&seed=7`)).json()).results)
  return <main>
    <header><div><p className="eyebrow">SIH PS90 · adaptive signal control</p><h1>SmartTraffic Control Room</h1><p className="sub">Network-aware traffic orchestration with reproducible simulation and live scenario injection.</p></div><div className={`status ${connected ? 'online' : ''}`}>{connected ? 'LIVE' : 'OFFLINE'}</div></header>
    <section className="metrics"><Metric label="Simulation tick" value={state?.tick ?? 0}/><Metric label="Network queue" value={state?.total_queue ?? 0}/><Metric label="Avg queue" value={avgQueue}/><Metric label="Throughput" value={state?.throughput ?? 0}/></section>
    <section className="panel controls">
      <label>Controller<select value={controller} onChange={e=>setController(e.target.value)}><option value="predictive-pressure-v1">Predictive pressure</option><option value="fixed-time">Fixed time</option></select></label>
      <button onClick={reset}>Reset scenario</button><button onClick={()=>post('/api/run')}>Run</button><button onClick={()=>post('/api/pause')}>Pause</button><button onClick={()=>post('/api/step')}>Single step</button>
      <button className="warn" onClick={()=>post('/api/event',{event:'accident'})}>Inject accident</button><button className="warn" onClick={()=>post('/api/event',{event:'rush-hour'})}>Rush hour ×2</button><button onClick={()=>post('/api/event',{event:'clear'})}>Clear event</button>
    </section>
    {state?.incident && <div className="incident">Active scenario: {state.incident}</div>}
    <section className="network">{state?.junctions?.map(j => <Junction key={j.id} j={j}/>)}</section>
    <section className="panel benchmark"><div><h2>Reproducible benchmark</h2><p>Same scenario, same seed, different controllers.</p></div><button onClick={benchmark}>Run 120-step comparison</button>{bench.length > 0 && <table><thead><tr><th>Controller</th><th>Avg queue</th><th>Final queue</th><th>Throughput</th></tr></thead><tbody>{bench.map(r=><tr key={r.controller}><td>{r.controller}</td><td>{r.average_network_queue}</td><td>{r.final_queue}</td><td>{r.throughput}</td></tr>)}</tbody></table>}</section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
