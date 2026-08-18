import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS = API.replace(/^http/, 'ws') + '/ws'

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }
function congestion(queue) { if (queue >= 90) return 'critical'; if (queue >= 55) return 'heavy'; if (queue >= 30) return 'moderate'; return 'free' }
function NetworkMap({ snapshot, title = 'Live network' }) {
  if (!snapshot?.junctions) return null
  const byId = Object.fromEntries(snapshot.junctions.map(j => [j.id, j]))
  const points = { J1:[90,70], J2:[310,70], J3:[90,250], J4:[310,250] }
  const roads = [['J1','J2'],['J1','J3'],['J2','J4'],['J3','J4']]
  return <div className="map-panel"><div className="map-heading"><strong>{title}</strong><span>tick {snapshot.tick}</span></div><svg viewBox="0 0 400 320" className="network-map" role="img" aria-label={`${title}: four connected traffic junctions`}>
    {roads.map(([a,b]) => { const qa=byId[a]?.queue??0,qb=byId[b]?.queue??0; return <line key={`${a}-${b}`} x1={points[a][0]} y1={points[a][1]} x2={points[b][0]} y2={points[b][1]} className={`road ${congestion((qa+qb)/2)}`}/> })}
    {Object.entries(points).map(([id,[x,y]]) => { const j=byId[id]; if(!j)return null; return <g key={id} transform={`translate(${x},${y})`}><circle r="33" className={`node ${congestion(j.queue)}`}/><text y="-4" textAnchor="middle" className="node-id">{id}</text><text y="15" textAnchor="middle" className="node-q">{j.queue} queued</text></g> })}
  </svg><div className="legend"><span><i className="dot free"/>free</span><span><i className="dot moderate"/>moderate</span><span><i className="dot heavy"/>heavy</span><span><i className="dot critical"/>critical</span></div></div>
}
function Junction({j}) { const max=Math.max(1,j.queue); return <div className="junction-card"><div className="junction-title"><strong>{j.id}</strong><span className="phase">{j.phase} green</span></div><div className="cross"><div className="arm north" style={{opacity:.35+j.north/max}}>{j.north}</div><div className="arm west" style={{opacity:.35+j.west/max}}>{j.west}</div><div className="center">{j.queue}</div><div className="arm east" style={{opacity:.35+j.east/max}}>{j.east}</div><div className="arm south" style={{opacity:.35+j.south/max}}>{j.south}</div></div></div> }

function App() {
  const [state,setState]=useState(null), [future,setFuture]=useState(null), [controller,setController]=useState('predictive-pressure-v1'), [bench,setBench]=useState([]), [connected,setConnected]=useState(false)
  const [replay,setReplay]=useState(null), [frame,setFrame]=useState(0), [playing,setPlaying]=useState(false)
  useEffect(()=>{fetch(`${API}/api/state`).then(r=>r.json()).then(setState)},[])
  useEffect(()=>{const ws=new WebSocket(WS); ws.onopen=()=>setConnected(true); ws.onclose=()=>setConnected(false); ws.onmessage=e=>{setState(JSON.parse(e.data));setFuture(null)}; return()=>ws.close()},[])
  useEffect(()=>{if(!playing||!replay)return; const timer=setInterval(()=>setFrame(current=>{if(current>=replay.steps){setPlaying(false);return current}return current+1}),170); return()=>clearInterval(timer)},[playing,replay])
  const avgQueue=useMemo(()=>state?Math.round(state.total_wait/Math.max(1,state.tick)):0,[state])
  const post=async(path,body={})=>{const res=await fetch(`${API}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await res.json(); if(data.junctions){setState(data);setFuture(null)} return data}
  const reset=()=>post('/api/reset',{controller,scenario:'normal',seed:7})
  const benchmark=async()=>setBench((await(await fetch(`${API}/api/benchmark?steps=120&seed=7`)).json()).results)
  const forecast=async()=>setFuture(await(await fetch(`${API}/api/forecast?horizon=15`)).json())
  const loadReplay=async()=>{const data=await(await fetch(`${API}/api/comparison?left=fixed-time&right=predictive-pressure-v1&steps=90&seed=7&event=accident&event_tick=20`)).json();setReplay(data);setFrame(0);setPlaying(true)}
  return <main><header><div><p className="eyebrow">SIH PS90 · adaptive signal control</p><h1>SmartTraffic Control Room</h1><p className="sub">See congestion as a connected network, predict where it propagates, and coordinate signals before downstream queues lock the corridor.</p></div><div className={`status ${connected?'online':''}`}>{connected?'LIVE':'OFFLINE'}</div></header>
  <section className="metrics"><Metric label="Simulation tick" value={state?.tick??0}/><Metric label="Network queue" value={state?.total_queue??0}/><Metric label="Avg queue" value={avgQueue}/><Metric label="Throughput" value={state?.throughput??0}/></section>
  <section className="panel controls"><label>Controller<select value={controller} onChange={e=>setController(e.target.value)}><option value="predictive-pressure-v1">Predictive pressure</option><option value="max-pressure">Max pressure</option><option value="fixed-time">Fixed time</option></select></label><button onClick={reset}>Reset scenario</button><button onClick={()=>post('/api/run')}>Run</button><button onClick={()=>post('/api/pause')}>Pause</button><button onClick={()=>post('/api/step')}>Single step</button><button onClick={forecast}>Predict +15 ticks</button><button className="warn" onClick={()=>post('/api/event',{event:'accident'})}>Inject accident</button><button className="warn" onClick={()=>post('/api/event',{event:'rush-hour'})}>Rush hour ×2</button><button className="priority" onClick={()=>post('/api/event',{event:'emergency'})}>Emergency corridor</button><button onClick={()=>post('/api/event',{event:'clear'})}>Clear event</button></section>
  {state?.incident&&<div className="incident">Active scenario: {state.incident}</div>}<section className={`maps ${future?'split':''}`}><NetworkMap snapshot={state}/>{future&&<NetworkMap snapshot={future} title="Predicted +15 ticks"/>}</section>
  <section className="panel replay"><div><h2>Judge comparison replay</h2><p>Both controllers receive the identical starting state, random seed, and accident at tick 20.</p></div><div className="replay-controls"><button onClick={loadReplay}>Load accident comparison</button>{replay&&<><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause replay':'Play replay'}</button><input aria-label="Replay frame" type="range" min="0" max={replay.steps} value={frame} onChange={e=>{setPlaying(false);setFrame(Number(e.target.value))}}/></>}</div>{replay&&<div className="comparison-maps"><NetworkMap snapshot={replay.left.frames[frame]} title={`Baseline · ${replay.left.controller}`}/><NetworkMap snapshot={replay.right.frames[frame]} title={`SmartTraffic · ${replay.right.controller}`}/></div>}{replay&&<div className="replay-caption">Frame {frame}/{replay.steps}{frame>=replay.event_tick?' · accident active':''}</div>}</section>
  <details className="details"><summary>Intersection diagnostics</summary><section className="network">{state?.junctions?.map(j=><Junction key={j.id} j={j}/>)}</section></details>
  <section className="panel benchmark"><div><h2>Reproducible A/B/C benchmark</h2><p>Fixed-time, local max-pressure, and network-aware predictive pressure run on the same seed and demand.</p></div><button onClick={benchmark}>Run 120-step comparison</button>{bench.length>0&&<table><thead><tr><th>Controller</th><th>Avg queue</th><th>Final queue</th><th>Throughput</th></tr></thead><tbody>{bench.map(r=><tr key={r.controller} className={r.controller===controller?'selected':''}><td>{r.controller}</td><td>{r.average_network_queue}</td><td>{r.final_queue}</td><td>{r.throughput}</td></tr>)}</tbody></table>}<p className="footnote">Mock-engine results are development evidence only. Final SIH claims should come from the SUMO benchmark suite.</p></section></main>
}

createRoot(document.getElementById('root')).render(<App />)
