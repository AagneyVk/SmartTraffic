import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import './styles.css'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

function Metric({ label, value, hint }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
}

function phaseLabel(phase) {
  if (phase === 'NS') return 'N/S GREEN'
  if (phase === 'EW') return 'E/W GREEN'
  if (phase === 'AMBER') return 'AMBER · ALL RED NEXT'
  return phase || 'UNKNOWN'
}

function SignalHead({ phase, axis }) {
  const green = phase === axis
  const amber = phase === 'AMBER'
  return <div className="signal-head" aria-label={`${axis} signal`}>
    <span className={!green && !amber ? 'lamp red on' : 'lamp red'} />
    <span className={amber ? 'lamp amber on' : 'lamp amber'} />
    <span className={green ? 'lamp green on' : 'lamp green'} />
  </div>
}

function IntersectionTwin({ frame, mode, title, accent }) {
  const mount = useRef(null)
  const ctx = useRef(null)

  useEffect(() => {
    const host = mount.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1015)
    scene.fog = new THREE.Fog(0x0b1015, 55, 150)
    const camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 250)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x27323a, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.3)
    sun.position.set(30, 50, 20)
    scene.add(sun)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x373d42, roughness: .95 })
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(24, 150), roadMat)
    ns.rotation.x = -Math.PI / 2; ns.position.y = .01; scene.add(ns)
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(150, 24), roadMat)
    ew.rotation.x = -Math.PI / 2; ew.position.y = .012; scene.add(ew)

    const markMat = new THREE.MeshBasicMaterial({ color: 0xd6d8d9 })
    const stripe = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), markMat)
      m.rotation.x = -Math.PI / 2; m.position.set(x, .026, z); scene.add(m)
    }
    for (let z = -68; z <= 68; z += 10) stripe(0, z, .16, 4.5)
    for (let x = -68; x <= 68; x += 10) stripe(x, 0, 4.5, .16)
    stripe(0, -13, 19, .45); stripe(0, 13, 19, .45); stripe(-13, 0, .45, 19); stripe(13, 0, .45, 19)

    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x454d54, roughness: 1 })
    ;[[-38,-38],[38,-38],[-38,38],[38,38]].forEach(([x,z], i) => {
      const h = 8 + (i % 3) * 5
      const b = new THREE.Mesh(new THREE.BoxGeometry(28, h, 28), buildingMat)
      b.position.set(x, h / 2, z); scene.add(b)
    })

    const lampMeshes = []
    const addSignal = (x, z, axis) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,5.4), new THREE.MeshStandardMaterial({ color: 0x6f777c }))
      pole.position.set(x,2.7,z); scene.add(pole)
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.05,2.4,.7), new THREE.MeshStandardMaterial({ color: 0x15191c }))
      box.position.set(x,5.35,z); scene.add(box)
      const colors = [0xe34f4f,0xe5b94d,0x43cf7c]
      colors.forEach((c, idx) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(.22,16,16), new THREE.MeshBasicMaterial({ color: idx === 0 ? c : 0x22282c }))
        bulb.position.set(x,6.0 - idx*.62,z+.38); scene.add(bulb)
        lampMeshes.push({ bulb, axis, idx, color:c })
      })
    }
    addSignal(-9,-9,'NS'); addSignal(9,9,'NS'); addSignal(-9,9,'EW'); addSignal(9,-9,'EW')

    const pools = {}
    const dirConfig = {
      north: { lane:-4, axis:'z', sign:1, start:-14, rot:0 },
      south: { lane:4, axis:'z', sign:-1, start:14, rot:Math.PI },
      east:  { lane:4, axis:'x', sign:-1, start:14, rot:Math.PI/2 },
      west:  { lane:-4, axis:'x', sign:1, start:-14, rot:-Math.PI/2 },
    }

    const createCar = (dir, i) => {
      const c = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0,.8,4.0), new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x7d8b97 : i % 3 === 1 ? 0x58636c : 0x9a8f7c, roughness:.65 }))
      body.position.y=.55; c.add(body)
      c.visible=false
      c.userData={dir,target:new THREE.Vector3()}
      scene.add(c)
      return c
    }
    Object.keys(dirConfig).forEach(dir => pools[dir] = Array.from({length:24},(_,i)=>createCar(dir,i)))

    const resize = () => {
      const width = host.clientWidth || 600
      const height = Math.max(330, width * .64)
      renderer.setSize(width,height,false)
      camera.aspect = width/height
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(host)

    ctx.current={scene,camera,renderer,pools,dirConfig,lampMeshes,phase:'NS',queues:{north:0,south:0,east:0,west:0}}
    const clock = new THREE.Clock(); let raf=0
    const animate=()=>{
      raf=requestAnimationFrame(animate)
      const dt=Math.min(clock.getDelta(),.05)
      const c=ctx.current
      if(!c) return
      Object.entries(c.pools).forEach(([dir,cars])=>{
        const cfg=c.dirConfig[dir]
        const q=Math.min(c.queues[dir]||0,cars.length)
        cars.forEach((car,i)=>{
          car.visible=i<q
          if(!car.visible) return
          const spacing=5.4
          const along=cfg.start-cfg.sign*i*spacing
          if(cfg.axis==='z') car.userData.target.set(cfg.lane,.55,along)
          else car.userData.target.set(along,.55,cfg.lane)
          car.position.lerp(car.userData.target,Math.min(1,dt*7))
          car.rotation.y=cfg.rot
        })
      })
      c.lampMeshes.forEach(({bulb,axis,idx,color})=>{
        const isAmber = c.phase === 'AMBER' && idx === 1
        const isGreen = c.phase === axis && idx === 2
        const isRed = c.phase !== 'AMBER' && c.phase !== axis && idx === 0
        bulb.material.color.setHex(isAmber||isGreen||isRed?color:0x22282c)
      })
      c.renderer.render(c.scene,c.camera)
    }
    animate()
    return()=>{cancelAnimationFrame(raf);ro.disconnect();renderer.dispose();host.innerHTML='';ctx.current=null}
  },[])

  useEffect(()=>{
    if(!ctx.current||!frame) return
    ctx.current.phase=frame.phase
    ctx.current.queues={north:frame.north,south:frame.south,east:frame.east,west:frame.west}
  },[frame])

  useEffect(()=>{
    if(!ctx.current) return
    if(mode==='bird'){ctx.current.camera.position.set(48,58,50);ctx.current.camera.lookAt(0,0,0)}
    else {ctx.current.camera.position.set(7,4,-48);ctx.current.camera.lookAt(0,2,4)}
  },[mode])

  return <section className={`sim-card ${accent}`}>
    <div className="sim-title-row">
      <div><h2>{title}</h2><p>{title.includes('Fixed') ? 'Conventional clock-timed cycle' : 'Queue-aware predictive control'}</p></div>
      <div className="phase-readout"><SignalHead phase={frame?.phase||'NS'} axis="NS"/><span>{phaseLabel(frame?.phase)}</span></div>
    </div>
    <div className="twin" ref={mount}/>
    <div className="queue-strip">
      <span>N {frame?.north??0}</span><span>S {frame?.south??0}</span><span>E {frame?.east??0}</span><span>W {frame?.west??0}</span>
    </div>
  </section>
}

function App(){
  const [data,setData]=useState(null)
  const [running,setRunning]=useState(false)
  const [tick,setTick]=useState(0)
  const [view,setView]=useState('pov')
  const [scenario,setScenario]=useState('north-surge')
  const [speed,setSpeed]=useState(1)
  const [error,setError]=useState('')

  const load=async()=>{
    try{
      setError('')
      const url=`${API}/api/single-junction/comparison?steps=100&seed=7&scenario=${scenario}`
      const res=await fetch(url)
      const contentType=res.headers.get('content-type')||''
      if(!res.ok) throw new Error(`backend returned HTTP ${res.status}`)
      if(!contentType.includes('application/json')) throw new Error(`backend did not return JSON from ${url}`)
      const payload=await res.json()
      setData(payload);setTick(0);setRunning(false)
    }catch(e){
      setData(null)
      setRunning(false)
      setError(`Cannot reach SmartTraffic backend at ${API}. Start FastAPI with: cd backend && uvicorn app.main:app --reload --port 8000. (${e.message})`)
    }
  }
  useEffect(()=>{load()},[scenario])
  useEffect(()=>{
    if(!running||!data) return
    const id=setInterval(()=>setTick(t=>t>=data.steps-1?0:t+1),Math.max(100,650/speed))
    return()=>clearInterval(id)
  },[running,data,speed])

  const fixed=data?.fixed.frames?.[tick]
  const adaptive=data?.adaptive.frames?.[tick]
  const fs=data?.fixed.summary
  const as=data?.adaptive.summary
  const queueGain=fs&&as?Math.round((1-as.average_queue/fs.average_queue)*100):0
  const waitGain=fs&&as?Math.round((1-as.average_wait_per_tick/fs.average_wait_per_tick)*100):0
  const throughputGain=fs&&as?Math.round((as.throughput/fs.throughput-1)*100):0

  return <main>
    <header className="hero">
      <div><p className="eyebrow">SIH PS90 · single-intersection proof</p><h1>SmartTraffic: same junction, same traffic, two signal policies</h1><p className="sub">Left is conventional fixed-clock timing. Right is our adaptive controller. Both receive the exact same seeded arrivals, so any difference comes from signal decisions—not a different traffic pattern.</p></div>
      <div className="hero-status">{error?'BACKEND OFFLINE':'LOCAL A/B'}</div>
    </header>

    <div className="controls">
      <button onClick={()=>setRunning(r=>!r)} disabled={!data}>{running?'⏸ Pause':'▶ Run comparison'}</button>
      <button onClick={()=>{setTick(0);setRunning(false)}}>Reset</button>
      <button onClick={()=>setView(v=>v==='pov'?'bird':'pov')}>{view==='pov'?'Bird’s-eye':'Intersection POV'}</button>
      <button onClick={load}>Reconnect backend</button>
      <label>Traffic pattern<select value={scenario} onChange={e=>setScenario(e.target.value)}><option value="north-surge">North/south surge</option><option value="east-surge">East/west surge</option><option value="balanced">Balanced traffic</option></select></label>
      <label>Speed<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    </div>

    {error&&<div className="error-box">{error}</div>}

    <div className="comparison-grid">
      <IntersectionTwin frame={fixed} mode={view} title="Fixed Clock Signal" accent="baseline"/>
      <IntersectionTwin frame={adaptive} mode={view} title="SmartTraffic Adaptive" accent="smart"/>
    </div>

    <div className="timeline"><span>T+{tick}</span><input type="range" min="0" max={data?data.steps-1:99} value={tick} onChange={e=>setTick(Number(e.target.value))}/><span>{data?.steps??100} ticks</span></div>

    <div className="metric-grid">
      <Metric label="Average queue reduction" value={`${queueGain}%`} hint="adaptive vs fixed-clock"/>
      <Metric label="Average wait reduction" value={`${waitGain}%`} hint="same arrivals"/>
      <Metric label="Throughput change" value={`${throughputGain>=0?'+':''}${throughputGain}%`} hint="vehicles cleared"/>
      <Metric label="Current fixed queue" value={fixed?.total_queue??0} hint={`SmartTraffic: ${adaptive?.total_queue??0}`}/>
    </div>

    <section className="explain">
      <h2>What the judge is seeing</h2>
      <p>The fixed controller changes direction on a clock even when one side is almost empty. SmartTraffic measures opposing queue pressure, uses recent queue growth as a short-horizon demand estimate, keeps a minimum green to avoid rapid switching, and enforces a maximum green so the cross-road cannot starve.</p>
      <p>Both simulations use exactly the same arrival schedule. Cars are placed from measured queue lengths with fixed spacing behind the stop line, and signal transitions include amber clearance.</p>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>)
