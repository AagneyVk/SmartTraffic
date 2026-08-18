import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './styles.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS = API.replace(/^http/, 'ws') + '/ws'

const JUNCTIONS = {
  J1: [13.0418, 80.2491],
  J2: [13.0418, 80.2520],
  J3: [13.0395, 80.2491],
  J4: [13.0395, 80.2520],
}

const PRIORITY_TYPES = [
  ['ambulance', 'Ambulance', '🚑'],
  ['fire', 'Fire service', '🚒'],
  ['disaster-response', 'Disaster response', '🛟'],
  ['police', 'Police', '🚓'],
  ['vip', 'VIP / minister convoy', '🚔'],
]

function Metric({ label, value, hint }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>
}

function RealMap({ route, activeType }) {
  const el = useRef(null)
  const mapRef = useRef(null)
  const routeRef = useRef(null)

  useEffect(() => {
    if (!el.current || mapRef.current) return
    const map = L.map(el.current, { zoomControl: true }).setView([13.0407, 80.2506], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    Object.entries(JUNCTIONS).forEach(([id, coords]) => {
      L.circleMarker(coords, { radius: 8, weight: 2, color: '#7fd0ff', fillColor: '#0f1924', fillOpacity: 1 })
        .bindTooltip(id, { permanent: true, direction: 'top' })
        .addTo(map)
    })

    L.polyline([JUNCTIONS.J1, JUNCTIONS.J2, JUNCTIONS.J4], { color: '#68798b', weight: 8, opacity: .55 }).addTo(map)
    L.polyline([JUNCTIONS.J1, JUNCTIONS.J3, JUNCTIONS.J4], { color: '#68798b', weight: 8, opacity: .45 }).addTo(map)
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 50)
    return () => map.remove()
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    if (routeRef.current) routeRef.current.remove()
    if (!route?.length) return
    const points = route.map(id => JUNCTIONS[id]).filter(Boolean)
    routeRef.current = L.polyline(points, { color: activeType ? '#4fd0ff' : '#7fd0ff', weight: 6, opacity: .95 }).addTo(mapRef.current)
    mapRef.current.fitBounds(routeRef.current.getBounds(), { padding: [30, 30] })
  }, [route, activeType])

  return <div className="real-map" ref={el} aria-label="OpenStreetMap road corridor" />
}

function DigitalTwin({ snapshot, priorityPlan, priorityType, viewMode }) {
  const mount = useRef(null)
  const ctx = useRef(null)

  useEffect(() => {
    const host = mount.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f14)
    scene.fog = new THREE.Fog(0x0a0f14, 55, 160)
    const camera = new THREE.PerspectiveCamera(55, 16 / 10, .1, 300)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x24303b, 2.1))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(30, 50, 20)
    scene.add(sun)

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x353b40, roughness: .95 })
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(24, 150), roadMat)
    ns.rotation.x = -Math.PI / 2
    ns.position.y = .01
    scene.add(ns)
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(150, 24), roadMat)
    ew.rotation.x = -Math.PI / 2
    ew.position.y = .012
    scene.add(ew)

    const markMat = new THREE.MeshBasicMaterial({ color: 0xc9ced1 })
    const stripe = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), markMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(x, .025, z)
      scene.add(m)
    }
    for (let z = -68; z <= 68; z += 10) stripe(0, z, .18, 5)
    for (let x = -68; x <= 68; x += 10) stripe(x, 0, 5, .18)
    stripe(0, -13, 19, .45); stripe(0, 13, 19, .45); stripe(-13, 0, .45, 19); stripe(13, 0, .45, 19)

    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x485057, roughness: 1 })
    ;[[-37,-37],[37,-37],[-37,37],[37,37]].forEach(([x,z], i) => {
      const h = 9 + (i % 3) * 6
      const b = new THREE.Mesh(new THREE.BoxGeometry(27, h, 27), buildingMat)
      b.position.set(x, h / 2, z)
      scene.add(b)
    })

    const cars = []
    const addCar = (dir, lane, offset, color = 0x88939d, emergency = false) => {
      const group = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, .85, 4.2), new THREE.MeshStandardMaterial({ color, roughness: .6 }))
      body.position.y = .58
      group.add(body)
      if (emergency) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, .18, .45), new THREE.MeshBasicMaterial({ color: 0x4f8cff }))
        bar.position.set(0, 1.08, 0)
        group.add(bar)
      }
      group.userData = { dir, lane, offset, speed: emergency ? 10.5 : 5.3 + Math.random() * 1.8, emergency }
      scene.add(group)
      cars.push(group)
      return group
    }

    for (let i = 0; i < 12; i++) addCar('N', -4, -24 - i * 6.2)
    for (let i = 0; i < 8; i++) addCar('S', 4, 24 + i * 7.2)
    for (let i = 0; i < 6; i++) addCar('E', 4, 24 + i * 8)
    for (let i = 0; i < 6; i++) addCar('W', -4, -24 - i * 8)

    const signalHeads = []
    const addSignal = (x, z, axis) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, 5), new THREE.MeshStandardMaterial({ color: 0x717980 }))
      pole.position.set(x, 2.5, z)
      scene.add(pole)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(.23, 16, 16), new THREE.MeshBasicMaterial({ color: 0x3bd27f }))
      bulb.position.set(x, 5, z)
      scene.add(bulb)
      signalHeads.push({ bulb, axis })
    }
    addSignal(-9,-9,'NS'); addSignal(9,9,'NS'); addSignal(-9,9,'EW'); addSignal(9,-9,'EW')

    const context = { scene, camera, renderer, cars, signalHeads, priorityCar: null, running: true, time: 0, host, lastPriorityKey: null }
    ctx.current = context

    const resize = () => {
      const width = host.clientWidth || 700
      const height = Math.max(360, width * .60)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), .05)
      context.time += dt

      const current = ctx.current
      const phase = current.phase || 'NS'
      current.signalHeads.forEach(s => s.bulb.material.color.setHex(s.axis === phase ? 0x3bd27f : 0xe45c5c))

      const update = car => {
        const u = car.userData
        const red = (u.dir === 'N' || u.dir === 'S') ? phase !== 'NS' : phase !== 'EW'
        let stop = false
        if (u.dir === 'N') { car.position.set(u.lane,.55,u.offset); car.rotation.y = 0; stop = red && u.offset > -21 && u.offset < -11; if (!stop) u.offset += u.speed * dt; if (u.offset > 76) u.offset = -78 }
        if (u.dir === 'S') { car.position.set(u.lane,.55,u.offset); car.rotation.y = Math.PI; stop = red && u.offset < 21 && u.offset > 11; if (!stop) u.offset -= u.speed * dt; if (u.offset < -76) u.offset = 78 }
        if (u.dir === 'E') { car.position.set(u.offset,.55,u.lane); car.rotation.y = Math.PI/2; stop = red && u.offset < 21 && u.offset > 11; if (!stop) u.offset -= u.speed * dt; if (u.offset < -76) u.offset = 78 }
        if (u.dir === 'W') { car.position.set(u.offset,.55,u.lane); car.rotation.y = -Math.PI/2; stop = red && u.offset > -21 && u.offset < -11; if (!stop) u.offset += u.speed * dt; if (u.offset > 76) u.offset = -78 }
      }
      current.cars.forEach(update)

      if (current.priorityCar && current.viewMode === 'follow') {
        const p = current.priorityCar.position
        current.camera.position.lerp(new THREE.Vector3(p.x + 4, 3.2, p.z - 10), .13)
        current.camera.lookAt(p.x, 1.1, p.z + 14)
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      host.innerHTML = ''
      ctx.current = null
    }
  }, [])

  useEffect(() => {
    if (!ctx.current) return
    const phase = snapshot?.junctions?.[0]?.phase || 'NS'
    ctx.current.phase = phase
  }, [snapshot])

  useEffect(() => {
    if (!ctx.current) return
    ctx.current.viewMode = viewMode
    if (viewMode === 'bird') { ctx.current.camera.position.set(50, 58, 52); ctx.current.camera.lookAt(0,0,0) }
    if (viewMode === 'pov') { ctx.current.camera.position.set(5.5, 3.8, -48); ctx.current.camera.lookAt(0,2,5) }
  }, [viewMode])

  useEffect(() => {
    if (!ctx.current || !priorityPlan?.route?.length) return
    const key = `${priorityType}-${priorityPlan.total_eta_seconds}-${priorityPlan.route.join('-')}`
    if (ctx.current.lastPriorityKey === key) return
    ctx.current.lastPriorityKey = key
    if (ctx.current.priorityCar) {
      ctx.current.scene.remove(ctx.current.priorityCar)
      ctx.current.cars.splice(ctx.current.cars.indexOf(ctx.current.priorityCar), 1)
    }
    const color = priorityType === 'fire' ? 0xd94c4c : priorityType === 'police' ? 0x4d74d9 : priorityType === 'vip' ? 0x171717 : priorityType === 'disaster-response' ? 0xf0a43c : 0xffffff
    const car = (() => {
      const group = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.3,.95,4.8), new THREE.MeshStandardMaterial({ color }))
      body.position.y=.62; group.add(body)
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.35,.2,.5), new THREE.MeshBasicMaterial({ color: 0x4f8cff }))
      bar.position.set(0,1.15,0); group.add(bar)
      group.userData={dir:'N',lane:0,offset:-70,speed:11.5,emergency:true}
      ctx.current.scene.add(group); ctx.current.cars.push(group); return group
    })()
    ctx.current.priorityCar = car
  }, [priorityPlan, priorityType])

  return <div className="twin" ref={mount} />
}

function App() {
  const [state, setState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [viewMode, setViewMode] = useState('bird')
  const [priorityType, setPriorityType] = useState('ambulance')
  const [priorityPlan, setPriorityPlan] = useState(null)
  const [forecast, setForecast] = useState(null)

  useEffect(() => { fetch(`${API}/api/state`).then(r => r.json()).then(setState) }, [])
  useEffect(() => {
    const ws = new WebSocket(WS)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = e => setState(JSON.parse(e.data))
    return () => ws.close()
  }, [])

  const totalQueue = state?.total_queue ?? 0
  const avgQueue = useMemo(() => state?.junctions?.length ? Math.round(totalQueue / state.junctions.length) : 0, [state, totalQueue])
  const post = async (path, body = {}) => (await fetch(`${API}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json()

  const launchPriority = async () => {
    const plan = await post('/api/emergency/corridor', {
      route:['J1','J2','J4'],
      vehicle_type:priorityType,
      segment_travel_seconds:[34,32],
    })
    setPriorityPlan(plan)
    setViewMode('follow')
    await post('/api/event', { event:'emergency' })
  }

  const runForecast = async () => setForecast(await (await fetch(`${API}/api/forecast?horizon=15`)).json())

  return <main>
    <header>
      <div>
        <p className="eyebrow">SIH PS90 · adaptive smart traffic signal control</p>
        <h1>SmartTraffic Digital Twin</h1>
        <p className="sub">Real geographic context on OpenStreetMap, a road-level 3D traffic twin, predictive signal control, and rolling priority corridors for emergency and protected movement.</p>
      </div>
      <div className={`status ${connected ? 'online' : ''}`}>{connected ? 'LIVE BACKEND' : 'OFFLINE'}</div>
    </header>

    <section className="metrics">
      <Metric label="Network queue" value={totalQueue} />
      <Metric label="Avg / junction" value={avgQueue} />
      <Metric label="Throughput" value={state?.throughput ?? 0} />
      <Metric label="Simulation tick" value={state?.tick ?? 0} />
    </section>

    <section className="panel controls command-bar">
      <button onClick={() => post('/api/run')}>▶ Run</button>
      <button onClick={() => post('/api/pause')}>Pause</button>
      <button className="warn" onClick={() => post('/api/event',{event:'accident'})}>🚧 Accident</button>
      <button className="warn" onClick={() => post('/api/event',{event:'rush-hour'})}>Rush ×2</button>
      <button onClick={runForecast}>Predict +15 ticks</button>
      <button onClick={() => post('/api/event',{event:'clear'})}>Clear event</button>
    </section>

    <section className="dual-view">
      <div className="panel map-card">
        <div className="section-head"><div><h2>Real-world corridor</h2><p>OpenStreetMap context for the selected Chennai demo zone</p></div><span className="status online">OSM</span></div>
        <RealMap route={priorityPlan?.route || ['J1','J2','J4']} activeType={priorityPlan?.vehicle_type} />
        {forecast && <div className="forecast-strip">Predicted network queue in +15 ticks: <strong>{forecast.total_queue}</strong></div>}
      </div>

      <div className="panel twin-card">
        <div className="section-head">
          <div><h2>Road-level POV twin</h2><p>Signals and priority vehicle are synchronized with control state</p></div>
          <div className="view-switch">
            <button onClick={() => setViewMode('bird')}>Bird</button>
            <button onClick={() => setViewMode('pov')}>POV</button>
            <button onClick={() => setViewMode('follow')}>Follow</button>
          </div>
        </div>
        <DigitalTwin snapshot={state} priorityPlan={priorityPlan} priorityType={priorityType} viewMode={viewMode} />
      </div>
    </section>

    <section className="panel priority-console">
      <div>
        <p className="eyebrow">Priority mobility</p>
        <h2>Rolling green corridor</h2>
        <p>The system pre-clears only the junctions the vehicle is approaching, then restores network-optimal timing after passage instead of freezing an entire corridor green.</p>
      </div>
      <div className="priority-grid">
        {PRIORITY_TYPES.map(([id,label,icon]) => <button key={id} className={priorityType===id?'selected-priority':''} onClick={() => setPriorityType(id)}><span>{icon}</span>{label}</button>)}
      </div>
      <button className="launch" onClick={launchPriority}>Launch {PRIORITY_TYPES.find(x=>x[0]===priorityType)?.[1]} corridor</button>
      {priorityPlan && <div className="schedule">
        <div><strong>{priorityPlan.vehicle_type}</strong><span>priority {priorityPlan.priority}</span></div>
        {priorityPlan.schedule.map(step => <div key={step.junction_id}><strong>{step.junction_id}</strong><span>ETA {step.eta_seconds}s · pre-green {step.green_lead_seconds}s · hold {step.hold_seconds}s</span></div>)}
      </div>}
    </section>

    <p className="footnote">The real-map pane uses OpenStreetMap tiles. The 3D pane is the browser digital-twin visualization; final SIH benchmark claims should still be generated from SUMO/TraCI runs, not from the visualization itself.</p>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
