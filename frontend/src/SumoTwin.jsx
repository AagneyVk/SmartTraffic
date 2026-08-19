import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { buildVehicleModel } from './vehicleModels.js'

const normalizeKind = kind => ['car','bike','auto','bus','truck','van'].includes(kind) ? kind : 'car'

export default function SumoTwin({ frame, mode='bird', title, accent }) {
  const mount = useRef(null)
  const ctx = useRef(null)

  useEffect(() => {
    const host = mount.current
    if (!host) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1015)
    scene.fog = new THREE.Fog(0x0b1015, 180, 700)
    const camera = new THREE.PerspectiveCamera(52, 1.6, .1, 1200)
    const renderer = new THREE.WebGLRenderer({ antialias:true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
    renderer.shadowMap.enabled = true
    host.innerHTML=''; host.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff,0x26333c,2.2))
    const sun=new THREE.DirectionalLight(0xffffff,1.5);sun.position.set(80,140,70);scene.add(sun)
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(760,520),new THREE.MeshStandardMaterial({color:0x252b2f,roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground)
    const roadMat=new THREE.MeshStandardMaterial({color:0x353b40,roughness:.95})
    const h=new THREE.Mesh(new THREE.PlaneGeometry(650,28),roadMat);h.rotation.x=-Math.PI/2;scene.add(h)
    ;[0,180].forEach(x=>{const v=new THREE.Mesh(new THREE.PlaneGeometry(28,390),roadMat);v.rotation.x=-Math.PI/2;v.position.x=x;scene.add(v)})

    const markMat=new THREE.MeshBasicMaterial({color:0xd5d9dc})
    for(let x=-210;x<=400;x+=14){const m=new THREE.Mesh(new THREE.PlaneGeometry(6,.15),markMat);m.rotation.x=-Math.PI/2;m.position.set(x,.03,0);scene.add(m)}
    ;[0,180].forEach(jx=>{for(let z=-180;z<=180;z+=14){const m=new THREE.Mesh(new THREE.PlaneGeometry(.15,6),markMat);m.rotation.x=-Math.PI/2;m.position.set(jx,.03,z);scene.add(m)}})

    const addSignal=(x,z)=>{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,5.5),new THREE.MeshStandardMaterial({color:0x737b80}));pole.position.set(x,2.75,z);scene.add(pole);const box=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.3,.75),new THREE.MeshStandardMaterial({color:0x111518}));box.position.set(x,5.3,z);scene.add(box)}
    addSignal(-10,-10);addSignal(10,10);addSignal(170,-10);addSignal(190,10)

    const vehicles=new Map()
    const resize=()=>{const w=host.clientWidth||600;const hh=Math.max(350,w*.64);renderer.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix()}
    resize();const ro=new ResizeObserver(resize);ro.observe(host)
    ctx.current={scene,camera,renderer,vehicles}
    let raf=0
    const animate=()=>{raf=requestAnimationFrame(animate);vehicles.forEach(v=>{v.position.lerp(v.userData.target,.22);v.rotation.y += (v.userData.targetRot-v.rotation.y)*.22});renderer.render(scene,camera)}
    animate()
    return()=>{cancelAnimationFrame(raf);ro.disconnect();renderer.dispose();host.innerHTML='';ctx.current=null}
  },[])

  useEffect(()=>{
    const c=ctx.current;if(!c||!frame)return
    const seen=new Set()
    for(const row of frame.vehicles||[]){
      seen.add(row.id)
      let mesh=c.vehicles.get(row.id)
      if(!mesh){mesh=buildVehicleModel(normalizeKind(row.kind),Math.abs(hash(row.id))%10);mesh.userData.target=new THREE.Vector3(row.x,.02,-row.y);mesh.userData.targetRot=-THREE.MathUtils.degToRad(row.angle||0);mesh.position.copy(mesh.userData.target);mesh.rotation.y=mesh.userData.targetRot;c.scene.add(mesh);c.vehicles.set(row.id,mesh)}
      mesh.userData.target.set(row.x,.02,-row.y)
      mesh.userData.targetRot=-THREE.MathUtils.degToRad(row.angle||0)
    }
    for(const [id,mesh] of c.vehicles){if(!seen.has(id)){c.scene.remove(mesh);c.vehicles.delete(id)}}
  },[frame])

  useEffect(()=>{
    const c=ctx.current;if(!c)return
    if(mode==='pov'){c.camera.position.set(-72,6,7);c.camera.lookAt(8,2,0)}
    else {c.camera.position.set(90,190,210);c.camera.lookAt(90,0,0)}
  },[mode])

  return <section className={`sim-card ${accent}`}>
    <div className="sim-title-row"><div><h2>{title}</h2><p>SUMO IDM + LC2013 · real TraCI coordinates</p></div><div className="phase-readout"><span>{frame?.phase||'—'} · {frame?.vehicles?.length||0} vehicles</span></div></div>
    <div className="twin" ref={mount}/>
    <div className="flow-caption">Every visible position, speed and lane comes from SUMO. Junction B is 180 m downstream and is included in bird’s-eye view.</div>
    <div className="queue-strip"><span>N {frame?.north??0}</span><span>S {frame?.south??0}</span><span>E {frame?.east??0}</span><span>W {frame?.west??0}</span></div>
  </section>
}

function hash(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return h}
