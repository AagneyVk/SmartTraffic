import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { buildVehicleModel, vehicleKindForSeed } from './vehicleModels.js'
import './styles.css'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

const DIRS = ['north', 'south', 'east', 'west']
const AXIS = { north: 'NS', south: 'NS', east: 'EW', west: 'EW' }

function Metric({ label, value, hint }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
}

function phaseLabel(phase) {
  if (phase === 'NS') return 'N/S GREEN'
  if (phase === 'EW') return 'E/W GREEN'
  if (phase === 'AMBER') return 'AMBER CLEARANCE'
  return phase || 'UNKNOWN'
}

function SignalHead({ phase, axis }) {
  const green = phase === axis
  const amber = phase === 'AMBER'
  return <div className="signal-head" aria-label={`${axis} traffic signal`}>
    <span className={!green && !amber ? 'lamp red on' : 'lamp red'} />
    <span className={amber ? 'lamp amber on' : 'lamp amber'} />
    <span className={green ? 'lamp green on' : 'lamp green'} />
  </div>
}

function vehicleKind(seed) {
  return vehicleKindForSeed(seed)
}

function buildVehicle(kind, colorIndex = 0) {
  return buildVehicleModel(kind, colorIndex)
}

function IntersectionTwin({ frame, previousFrame, mode, title, accent }) {
  const mount = useRef(null)
  const ctx = useRef(null)

  useEffect(() => {
    const host = mount.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1015)
    scene.fog = new THREE.Fog(0x0b1015, 78, 190)
    const camera = new THREE.PerspectiveCamera(54, 1.6, .1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x27323a, 2.1))
    const sun = new THREE.DirectionalLight(0xffffff, 1.55)
    sun.position.set(28, 55, 18); sun.castShadow = true; scene.add(sun)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ color: 0x232a2d, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; scene.add(ground)

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x353b40, roughness: .92 })
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(28, 190), roadMat)
    ns.rotation.x = -Math.PI / 2; ns.position.y = .01; scene.add(ns)
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(190, 28), roadMat)
    ew.rotation.x = -Math.PI / 2; ew.position.y = .012; scene.add(ew)

    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x596167, roughness: 1 })
    ;[[-18,0],[18,0]].forEach(([x,z]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(4,.24,190), sidewalkMat); s.position.set(x,.1,z); scene.add(s)
    })
    ;[[0,-18],[0,18]].forEach(([x,z]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(190,.24,4), sidewalkMat); s.position.set(x,.1,z); scene.add(s)
    })

    const markMat = new THREE.MeshBasicMaterial({ color: 0xd7dbdd })
    const stripe = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), markMat)
      m.rotation.x = -Math.PI / 2; m.position.set(x, .03, z); scene.add(m)
    }
    for (let z = -88; z <= 88; z += 11) stripe(0, z, .16, 5.2)
    for (let x = -88; x <= 88; x += 11) stripe(x, 0, 5.2, .16)
    stripe(0, -15, 22, .48); stripe(0, 15, 22, .48); stripe(-15, 0, .48, 22); stripe(15, 0, .48, 22)

    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x454d54, roughness: 1 })
    ;[[-43,-43],[43,-43],[-43,43],[43,43]].forEach(([x,z], i) => {
      const h = 11 + (i % 3) * 7
      const b = new THREE.Mesh(new THREE.BoxGeometry(30,h,30),buildingMat)
      b.position.set(x,h/2,z); b.castShadow = true; scene.add(b)
    })

    const signalMeshes = []
    const addSignal = (x,z,axis,rot=0) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,5.8), new THREE.MeshStandardMaterial({color:0x747b80}))
      pole.position.set(x,2.9,z); scene.add(pole)
      const housing = new THREE.Mesh(new THREE.BoxGeometry(1.2,2.65,.82), new THREE.MeshStandardMaterial({color:0x111518}))
      housing.position.set(x,5.65,z); housing.rotation.y=rot; scene.add(housing)
      const colors=[0xe64e4e,0xe3b749,0x43cf7c]
      colors.forEach((color,idx)=>{
        const bulb=new THREE.Mesh(new THREE.SphereGeometry(.25,16,16),new THREE.MeshBasicMaterial({color:0x20262a}))
        bulb.position.set(x,6.37-idx*.67,z+.44); scene.add(bulb)
        signalMeshes.push({bulb,axis,idx,color})
      })
    }
    addSignal(-10,-10,'NS'); addSignal(10,10,'NS',Math.PI); addSignal(-10,10,'EW',Math.PI/2); addSignal(10,-10,'EW',-Math.PI/2)

    const cfg = {
      north:{lane:-5,axis:'z',sign:1,start:-16,rot:0,exit:88},
      south:{lane:5,axis:'z',sign:-1,start:16,rot:Math.PI,exit:-88},
      east:{lane:5,axis:'x',sign:-1,start:16,rot:Math.PI/2,exit:-88},
      west:{lane:-5,axis:'x',sign:1,start:-16,rot:-Math.PI/2,exit:88},
    }

    const queuePools = {}
    DIRS.forEach((dir,di)=>{
      queuePools[dir]=Array.from({length:28},(_,i)=>{
        const v=buildVehicle(vehicleKind(i+di*11),i+di)
        v.visible=false; v.userData.target=new THREE.Vector3(); scene.add(v); return v
      })
    })

    const moving=[]
    const spawnDeparture=(dir,index,tick)=>{
      const d=cfg[dir]
      const v=buildVehicle(vehicleKind(tick*3+index+DIRS.indexOf(dir)*7), tick+index)
      const offset=(index%2)*2.55
      if(d.axis==='z') v.position.set(d.lane+offset,.02,d.start+d.sign*1.5)
      else v.position.set(d.start+d.sign*1.5,.02,d.lane+offset)
      v.rotation.y=d.rot
      v.userData.dir=dir
      v.userData.speed=0
      v.userData.targetSpeed=v.userData.maxSpeed || 17
      v.userData.accel=v.userData.accel || 6
      v.userData.progress=0
      scene.add(v); moving.push(v)
    }

    const resize=()=>{
      const width=host.clientWidth||600; const height=Math.max(350,width*.64)
      renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix()
    }
    resize(); const ro=new ResizeObserver(resize); ro.observe(host)

    ctx.current={scene,camera,renderer,signalMeshes,queuePools,moving,cfg,phase:'NS',queues:{north:0,south:0,east:0,west:0},spawnDeparture}
    const clock=new THREE.Clock(); let raf=0
    const animate=()=>{
      raf=requestAnimationFrame(animate)
      const dt=Math.min(clock.getDelta(),.05); const c=ctx.current; if(!c)return

      DIRS.forEach(dir=>{
        const vehicles=c.queuePools[dir]; const d=c.cfg[dir]; const q=Math.min(c.queues[dir]||0,vehicles.length)
        let cumulative=0
        vehicles.forEach((v,i)=>{
          v.visible=i<q; if(!v.visible)return
          if(i>0){
            const prev=vehicles[i-1]
            cumulative += prev.userData.length/2 + v.userData.length/2 + Math.max(prev.userData.queueGap||1.2,v.userData.queueGap||1.2)
          }
          const along=d.start-d.sign*cumulative
          if(d.axis==='z')v.userData.target.set(d.lane,.02,along)
          else v.userData.target.set(along,.02,d.lane)
          v.position.lerp(v.userData.target,Math.min(1,dt*8)); v.rotation.y=d.rot
        })
      })

      for(let i=c.moving.length-1;i>=0;i--){
        const v=c.moving[i]; const d=c.cfg[v.userData.dir]
        v.userData.speed=Math.min(v.userData.targetSpeed, v.userData.speed + v.userData.accel*dt)
        const delta=d.sign*v.userData.speed*dt
        if(d.axis==='z')v.position.z+=delta; else v.position.x+=delta
        v.userData.progress+=Math.abs(delta)
        if(v.userData.progress>105){c.scene.remove(v);c.moving.splice(i,1)}
      }

      c.signalMeshes.forEach(({bulb,axis,idx,color})=>{
        const amber=c.phase==='AMBER'&&idx===1
        const green=c.phase===axis&&idx===2
        const red=c.phase!=='AMBER'&&c.phase!==axis&&idx===0
        bulb.material.color.setHex(amber||green||red?color:0x20262a)
      })
      c.renderer.render(c.scene,c.camera)
    }
    animate()
    return()=>{cancelAnimationFrame(raf);ro.disconnect();renderer.dispose();host.innerHTML='';ctx.current=null}
  },[])

  useEffect(()=>{
    if(!ctx.current||!frame)return
    ctx.current.phase=frame.phase
    ctx.current.queues={north:frame.north,south:frame.south,east:frame.east,west:frame.west}
    if(previousFrame && frame.tick!==previousFrame.tick){
      DIRS.forEach(dir=>{
        const count=frame.moved?.[dir]||0
        for(let i=0;i<count;i++)ctx.current.spawnDeparture(dir,i,frame.tick)
      })
    }
  },[frame,previousFrame])

  useEffect(()=>{
    if(!ctx.current)return
    if(mode==='bird'){ctx.current.camera.position.set(58,68,60);ctx.current.camera.lookAt(0,0,0)}
    else{ctx.current.camera.position.set(8,4.8,-59);ctx.current.camera.lookAt(0,2.2,8)}
  },[mode])

  const downstream=frame?.downstream||{}
  const discharged=Object.values(frame?.moved||{}).reduce((a,b)=>a+b,0)

  return <section className={`sim-card ${accent}`}>
    <div className="sim-title-row">
      <div><h2>{title}</h2><p>{title.includes('Fixed')?'Conventional clock-timed signal':'Predictive Queue-Pressure (PQP)'}</p></div>
      <div className="phase-readout"><SignalHead phase={frame?.phase||'NS'} axis="NS"/><span>{phaseLabel(frame?.phase)}</span></div>
    </div>
    <div className="twin" ref={mount}/>
    <div className="flow-caption"><strong>{discharged}</strong> vehicles crossed this tick · cars, bikes, autos, buses, vans and trucks continue onto the downstream road.</div>
    <div className="queue-strip"><span>Approach N {frame?.north??0}</span><span>S {frame?.south??0}</span><span>E {frame?.east??0}</span><span>W {frame?.west??0}</span></div>
    <div className="downstream-strip"><span>After junction N {downstream.north??0}</span><span>S {downstream.south??0}</span><span>E {downstream.east??0}</span><span>W {downstream.west??0}</span></div>
  </section>
}

function DownstreamComparison({ fixed, adaptive }) {
  const rows=DIRS.map(dir=>({dir, fixed:fixed?.downstream?.[dir]||0, adaptive:adaptive?.downstream?.[dir]||0}))
  return <section className="downstream-panel">
    <div><p className="eyebrow">AFTER THE JUNCTION</p><h2>Adjacent-road flow</h2><p className="sub compact">This is traffic already released through the signal and still occupying the visible road immediately beyond the intersection.</p></div>
    <div className="road-rows">{rows.map(r=>{
      const max=Math.max(1,r.fixed,r.adaptive)
      return <div className="road-row" key={r.dir}>
        <strong>{r.dir.toUpperCase()}</strong>
        <div><span>Fixed</span><div className="bar"><i style={{width:`${r.fixed/max*100}%`}}/></div><b>{r.fixed}</b></div>
        <div><span>PQP</span><div className="bar smartbar"><i style={{width:`${r.adaptive/max*100}%`}}/></div><b>{r.adaptive}</b></div>
      </div>
    })}</div>
  </section>
}

function AlgorithmPanel({ algorithm }) {
  return <section className="algorithm-panel">
    <div><p className="eyebrow">SMARTTRAFFIC CONTROLLER</p><h2>{algorithm?.name||'Predictive Queue-Pressure (PQP)'}</h2></div>
    <div className="formula">Score = current queue + 0.8 × positive recent queue growth</div>
    <div className="algo-grid">
      <div><strong>1 · Measure pressure</strong><p>N+S queues are compared against E+W queues.</p></div>
      <div><strong>2 · Predict near-term demand</strong><p>Recent queue growth boosts the score before the queue becomes severe.</p></div>
      <div><strong>3 · Use hysteresis</strong><p>Minimum green = {algorithm?.min_green_ticks??4} ticks; switch margin = {algorithm?.switch_margin??2}.</p></div>
      <div><strong>4 · Prevent starvation</strong><p>Maximum green = {algorithm?.max_green_ticks??14} ticks, then the competing road gets service.</p></div>
    </div>
    <p className="algo-note">Every conflicting phase change includes one amber clearance tick. This is an explainable controller—not an opaque neural network.</p>
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
      if(!res.ok)throw new Error(`backend returned HTTP ${res.status}`)
      if(!contentType.includes('application/json'))throw new Error(`backend did not return JSON from ${url}`)
      const payload=await res.json(); setData(payload); setTick(0); setRunning(false)
    }catch(e){
      setData(null);setRunning(false)
      setError(`Cannot reach SmartTraffic backend at ${API}. Start FastAPI with: cd backend && uvicorn app.main:app --reload --port 8000. (${e.message})`)
    }
  }
  useEffect(()=>{load()},[scenario])
  useEffect(()=>{
    if(!running||!data)return
    const id=setInterval(()=>setTick(t=>t>=data.steps-1?0:t+1),Math.max(110,720/speed))
    return()=>clearInterval(id)
  },[running,data,speed])

  const fixed=data?.fixed.frames?.[tick]
  const adaptive=data?.adaptive.frames?.[tick]
  const fixedPrev=data?.fixed.frames?.[Math.max(0,tick-1)]
  const adaptivePrev=data?.adaptive.frames?.[Math.max(0,tick-1)]
  const fs=data?.fixed.summary, as=data?.adaptive.summary
  const queueGain=fs&&as?Math.round((1-as.average_queue/fs.average_queue)*100):0
  const waitGain=fs&&as?Math.round((1-as.average_wait_per_tick/fs.average_wait_per_tick)*100):0
  const throughputGain=fs&&as?Math.round((as.throughput/fs.throughput-1)*100):0

  return <main>
    <header className="hero">
      <div><p className="eyebrow">SIH PS90 · SINGLE-INTERSECTION DIGITAL TWIN</p><h1>Same traffic. Same junction. Different signal intelligence.</h1><p className="sub">Every arrival is identical on both sides. Watch recognizable cars, motorcycles, autos, buses, vans and trucks queue, accelerate through green, and continue onto the road after the junction. The left signal follows a clock; the right uses SmartTraffic PQP.</p></div>
      <div className="hero-status">{error?'BACKEND OFFLINE':'LOCAL A/B'}</div>
    </header>

    <div className="controls">
      <button onClick={()=>setRunning(r=>!r)} disabled={!data}>{running?'⏸ Pause':'▶ Run comparison'}</button>
      <button onClick={()=>{setTick(0);setRunning(false)}}>Reset</button>
      <button onClick={()=>setView(v=>v==='pov'?'bird':'pov')}>{view==='pov'?'Bird’s-eye':'Intersection POV'}</button>
      <button onClick={load}>Reconnect backend</button>
      <label>Traffic pattern<select value={scenario} onChange={e=>setScenario(e.target.value)}><option value="north-surge">N/S rush surge</option><option value="east-surge">E/W rush surge</option><option value="balanced">Balanced traffic</option></select></label>
      <label>Speed<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
    </div>

    {error&&<div className="error-box">{error}</div>}

    <div className="comparison-grid">
      <IntersectionTwin frame={fixed} previousFrame={fixedPrev} mode={view} title="Fixed Clock Signal" accent="baseline"/>
      <IntersectionTwin frame={adaptive} previousFrame={adaptivePrev} mode={view} title="SmartTraffic PQP" accent="smart"/>
    </div>

    <div className="timeline"><span>T+{tick}</span><input type="range" min="0" max={data?data.steps-1:99} value={tick} onChange={e=>setTick(Number(e.target.value))}/><span>{data?.steps??100} ticks</span></div>

    <div className="metric-grid">
      <Metric label="Average queue reduction" value={`${queueGain}%`} hint="PQP vs fixed clock"/>
      <Metric label="Average wait reduction" value={`${waitGain}%`} hint="identical arrivals"/>
      <Metric label="Throughput change" value={`${throughputGain>=0?'+':''}${throughputGain}%`} hint="vehicles cleared"/>
      <Metric label="Current total queue" value={`${fixed?.total_queue??0} → ${adaptive?.total_queue??0}`} hint="fixed → SmartTraffic"/>
    </div>

    <DownstreamComparison fixed={fixed} adaptive={adaptive}/>
    <AlgorithmPanel algorithm={data?.algorithm}/>

    <section className="explain">
      <h2>How to read the animation</h2>
      <p>Vehicles waiting before the white stop line are the current approach queue. When their direction receives green, the backend reports the number discharged; those vehicles physically accelerate through the intersection and remain visible downstream. Motorcycles, autos, cars, buses, vans and trucks have distinct silhouettes, colors, lengths, queue gaps, acceleration and top speed.</p>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App/>)
