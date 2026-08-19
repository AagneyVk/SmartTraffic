import * as THREE from 'three'

const BODY_PALETTE = [
  0xd64545, 0x2f78c4, 0xe8e8e8, 0x2f3439, 0xe0a12f,
  0x4e9a62, 0x754e9a, 0xb86b37, 0x68869a, 0xc7c7c7,
]

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: opts.roughness ?? 0.5,
  metalness: opts.metalness ?? 0.08,
})

const dark = mat(0x111419, { roughness: 0.42 })
const rubber = mat(0x090a0c, { roughness: 0.9 })
const chrome = mat(0xbac4ca, { roughness: 0.22, metalness: 0.72 })
const glass = new THREE.MeshStandardMaterial({
  color: 0x496b80,
  roughness: 0.16,
  metalness: 0.08,
  transparent: true,
  opacity: 0.82,
})
const headlight = new THREE.MeshBasicMaterial({ color: 0xfff1bd })
const taillight = new THREE.MeshBasicMaterial({ color: 0xd92d2d })

function box(group, size, pos, material, rot = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...pos)
  if (rot) mesh.rotation.set(...rot)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function sphere(group, radius, pos, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material)
  mesh.position.set(...pos)
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

function wheel(group, radius, width, x, y, z, rotationZ = Math.PI / 2) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), rubber)
  mesh.rotation.z = rotationZ
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

function lightPair(group, width, z, y, material) {
  const x = width * 0.3
  box(group, [0.34, 0.18, 0.08], [-x, y, z], material)
  box(group, [0.34, 0.18, 0.08], [x, y, z], material)
}

function sedan(group, bodyMat) {
  const width = 1.9, length = 4.35
  box(group, [width, 0.58, 3.55], [0, 0.67, 0], bodyMat)
  box(group, [1.5, 0.58, 1.85], [0, 1.12, 0.12], bodyMat)
  box(group, [1.38, 0.42, 0.06], [0, 1.2, -0.86], glass, [-0.14, 0, 0])
  box(group, [1.38, 0.42, 0.06], [0, 1.2, 1.02], glass, [0.14, 0, 0])
  box(group, [0.05, 0.42, 1.1], [-0.76, 1.18, 0.08], glass)
  box(group, [0.05, 0.42, 1.1], [0.76, 1.18, 0.08], glass)
  ;[-0.72, 0.72].forEach(x => {
    wheel(group, 0.31, 0.22, x, 0.34, -1.25)
    wheel(group, 0.31, 0.22, x, 0.34, 1.22)
  })
  lightPair(group, width, -1.81, 0.72, headlight)
  lightPair(group, width, 1.81, 0.72, taillight)
  group.userData.length = length
  group.userData.queueGap = 1.4
  group.userData.accel = 7.0
  group.userData.maxSpeed = 17.5
}

function motorcycle(group, bodyMat) {
  const length = 2.25
  // two clearly exposed wheels
  wheel(group, 0.34, 0.12, 0, 0.36, -0.78, 0)
  wheel(group, 0.34, 0.12, 0, 0.36, 0.78, 0)
  box(group, [0.16, 0.16, 1.25], [0, 0.56, 0], chrome)
  box(group, [0.48, 0.26, 0.72], [0, 0.7, 0.08], bodyMat)
  box(group, [0.42, 0.16, 0.65], [0, 0.86, 0.32], dark)
  // front fork + handlebar
  box(group, [0.08, 0.85, 0.08], [0, 0.82, -0.63], chrome, [0.18, 0, 0])
  box(group, [0.92, 0.07, 0.07], [0, 1.18, -0.54], chrome)
  // rider torso/head makes the bike instantly readable in POV
  box(group, [0.48, 0.72, 0.3], [0, 1.33, 0.15], mat(0x29384c))
  sphere(group, 0.22, [0, 1.83, -0.02], mat(0x20252b, { roughness: 0.65 }))
  box(group, [0.2, 0.08, 0.08], [0, 0.76, -1.03], headlight)
  box(group, [0.22, 0.1, 0.08], [0, 0.78, 1.03], taillight)
  group.userData.length = length
  group.userData.queueGap = 0.75
  group.userData.accel = 10.5
  group.userData.maxSpeed = 21
}

function autoRickshaw(group, bodyMat) {
  const width = 1.62, length = 2.95
  // familiar black canopy + colored lower body
  box(group, [width, 0.58, 2.38], [0, 0.62, 0.08], bodyMat)
  box(group, [1.48, 0.18, 1.95], [0, 1.55, 0.18], dark)
  box(group, [1.38, 0.86, 0.12], [0, 1.12, -0.72], glass, [-0.12, 0, 0])
  // open side/rear structure
  box(group, [0.08, 0.9, 1.55], [-0.72, 1.08, 0.2], dark)
  box(group, [0.08, 0.9, 1.55], [0.72, 1.08, 0.2], dark)
  wheel(group, 0.3, 0.16, 0, 0.32, -0.92, 0)
  wheel(group, 0.31, 0.18, -0.72, 0.33, 0.82)
  wheel(group, 0.31, 0.18, 0.72, 0.33, 0.82)
  box(group, [0.28, 0.16, 0.08], [0, 0.76, -1.22], headlight)
  box(group, [0.22, 0.16, 0.08], [0, 0.75, 1.22], taillight)
  group.userData.length = length
  group.userData.queueGap = 0.95
  group.userData.accel = 8.5
  group.userData.maxSpeed = 18.5
}

function cityBus(group, bodyMat) {
  const width = 2.35, length = 7.7
  box(group, [width, 2.05, 7.25], [0, 1.35, 0], bodyMat)
  box(group, [2.18, 0.72, 0.08], [0, 1.72, -3.64], glass)
  for (let z = -2.55; z <= 2.55; z += 1.12) {
    box(group, [0.055, 0.72, 0.84], [-1.185, 1.78, z], glass)
    box(group, [0.055, 0.72, 0.84], [1.185, 1.78, z], glass)
  }
  box(group, [0.08, 1.35, 0.78], [1.19, 1.15, -2.25], dark)
  ;[-1.03, 1.03].forEach(x => {
    wheel(group, 0.43, 0.25, x, 0.43, -2.45)
    wheel(group, 0.43, 0.25, x, 0.43, 2.42)
  })
  lightPair(group, width, -3.66, 0.72, headlight)
  lightPair(group, width, 3.66, 0.72, taillight)
  group.userData.length = length
  group.userData.queueGap = 2.0
  group.userData.accel = 4.2
  group.userData.maxSpeed = 13.5
}

function cargoTruck(group, bodyMat) {
  const width = 2.35, length = 7.25
  // cab
  box(group, [width, 1.65, 2.25], [0, 1.08, -2.25], bodyMat)
  box(group, [1.92, 0.62, 0.08], [0, 1.52, -3.39], glass)
  box(group, [0.08, 0.62, 1.0], [-1.18, 1.48, -2.4], glass)
  box(group, [0.08, 0.62, 1.0], [1.18, 1.48, -2.4], glass)
  // cargo body clearly separated from cab
  box(group, [2.3, 1.82, 4.25], [0, 1.25, 1.02], mat(0x6d7378, { roughness: 0.78 }))
  box(group, [2.34, 0.12, 4.3], [0, 2.2, 1.02], dark)
  ;[-1.04, 1.04].forEach(x => {
    wheel(group, 0.44, 0.26, x, 0.44, -2.45)
    wheel(group, 0.44, 0.26, x, 0.44, 1.62)
    wheel(group, 0.44, 0.26, x, 0.44, 2.48)
  })
  lightPair(group, width, -3.42, 0.72, headlight)
  lightPair(group, width, 3.12, 0.72, taillight)
  group.userData.length = length
  group.userData.queueGap = 2.1
  group.userData.accel = 3.6
  group.userData.maxSpeed = 12.5
}

function deliveryVan(group, bodyMat) {
  const width = 2.05, length = 5.05
  box(group, [width, 1.55, 4.65], [0, 1.02, 0.12], bodyMat)
  box(group, [1.72, 0.58, 0.08], [0, 1.48, -2.24], glass)
  box(group, [0.08, 0.54, 0.95], [-1.04, 1.45, -1.55], glass)
  box(group, [0.08, 0.54, 0.95], [1.04, 1.45, -1.55], glass)
  ;[-0.9, 0.9].forEach(x => {
    wheel(group, 0.35, 0.22, x, 0.36, -1.55)
    wheel(group, 0.35, 0.22, x, 0.36, 1.55)
  })
  lightPair(group, width, -2.24, 0.7, headlight)
  lightPair(group, width, 2.45, 0.7, taillight)
  group.userData.length = length
  group.userData.queueGap = 1.55
  group.userData.accel = 6.0
  group.userData.maxSpeed = 16
}

export function vehicleKindForSeed(seed) {
  // car-heavy but visibly mixed urban traffic
  const mix = ['car', 'bike', 'car', 'auto', 'car', 'bus', 'bike', 'van', 'car', 'truck', 'auto', 'car']
  return mix[Math.abs(seed) % mix.length]
}

export function buildVehicleModel(kind, colorIndex = 0) {
  const group = new THREE.Group()
  const bodyColor = BODY_PALETTE[Math.abs(colorIndex) % BODY_PALETTE.length]
  const bodyMat = mat(bodyColor, { roughness: 0.46, metalness: 0.12 })

  if (kind === 'bike') motorcycle(group, bodyMat)
  else if (kind === 'auto') autoRickshaw(group, bodyMat)
  else if (kind === 'bus') cityBus(group, bodyMat)
  else if (kind === 'truck') cargoTruck(group, bodyMat)
  else if (kind === 'van') deliveryVan(group, bodyMat)
  else sedan(group, bodyMat)

  group.userData.kind = kind
  group.userData.bodyColor = bodyColor
  return group
}
