import './style.css'
import * as THREE from 'three'
import gsap from 'gsap'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

////////////////////////////////////////////////
// 0. AJUSTES (aquí cambias cosas fácilmente, por ejemplo en la entrega)
const alturaModelo = 5          // qué tan alto se ve tu modelo de Cinema 4D
const radioCirculo = 9          // qué tan lejos están las vitrinas del centro
const velocidadPlataforma = 0.003
const alturaPlataforma = 0.4

////////////////////////////////////////////////
// 1. ESCENA, CÁMARA Y RENDERIZADOR
const canvas = document.getElementById('lienzo')
const nombreEnPantalla = document.getElementById('nombre')

const escena = new THREE.Scene()
const coloresCielo = [0xbfe3ff, 0xffc89b, 0x1b2540] // día, atardecer, noche
let indiceCielo = 0
escena.background = new THREE.Color(coloresCielo[indiceCielo])

const camara = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
)
camara.position.set(0, 7, 18)

const renderizador = new THREE.WebGLRenderer({ canvas: canvas, antialias: true })
renderizador.shadowMap.enabled = true
renderizador.shadowMap.type = THREE.PCFShadowMap

// Función propia: ajusta el tamaño al cambiar la ventana
function ajustarTamano() {
  camara.aspect = window.innerWidth / window.innerHeight
  camara.updateProjectionMatrix()
  renderizador.setSize(window.innerWidth, window.innerHeight)
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2)) // máximo 2 para cuidar los fps
}
window.addEventListener('resize', ajustarTamano)

// Controles para girar la cámara con el mouse
const controles = new OrbitControls(camara, renderizador.domElement)
controles.enableDamping = true
controles.target.set(0, 2, 0)
controles.maxPolarAngle = Math.PI / 2 - 0.05 // evita ver desde debajo del piso

////////////////////////////////////////////////
// 2. LUCES
const luzAmbiente = new THREE.AmbientLight(0xffffff, 1)
escena.add(luzAmbiente)

const sol = new THREE.DirectionalLight(0xffffff, 3)
sol.position.set(8, 14, 8)
sol.castShadow = true
sol.shadow.mapSize.set(1024, 1024)
sol.shadow.camera.left = -15
sol.shadow.camera.right = 15
sol.shadow.camera.top = 15
sol.shadow.camera.bottom = -15
sol.shadow.camera.near = 0.1
sol.shadow.camera.far = 50
escena.add(sol)
// Luz extra para iluminar lo que queda bajo el techo de las columnas
const luzTrasera = new THREE.PointLight(0xfff2d6, 20, 0)
luzTrasera.position.set(1, 3, -1)
escena.add(luzTrasera)
const luzTrasera2 = new THREE.PointLight(0xfff2d6, 20, 0)
luzTrasera2.position.set(-1, 3, -1)
escena.add(luzTrasera2)

////////////////////////////////////////////////
// 3. TEXTURAS
const cargadorTexturas = new THREE.TextureLoader()

// Función propia: carga una textura, la repite y le pone el espacio de color correcto
function cargarTextura(ruta, repeticiones) {
  const textura = cargadorTexturas.load(ruta)
  textura.colorSpace = THREE.SRGBColorSpace   // evita colores lavados
  textura.wrapS = THREE.RepeatWrapping        // repetir en horizontal
  textura.wrapT = THREE.RepeatWrapping        // repetir en vertical
  textura.repeat.set(repeticiones, repeticiones)
  return textura
}

const texturaMarmol = cargarTextura('/textures/marmol.jpg', 8)
const texturaPiedra = cargarTextura('/textures/piedra.jpg', 2)
const texturaColumnas = cargarTextura('/textures/piedra.jpg', 1)

// El matcap es distinto: no se repite, solo necesita el espacio de color
const texturaMatcap = cargadorTexturas.load('/textures/matcap.png')
texturaMatcap.colorSpace = THREE.SRGBColorSpace

////////////////////////////////////////////////
// 4. PISO Y PLATAFORMA (mallas 100% Three.js)
const piso = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ map: texturaMarmol })
)
piso.rotation.x = -Math.PI / 2
piso.receiveShadow = true
escena.add(piso)

const plataforma = new THREE.Mesh(
  new THREE.CylinderGeometry(5, 5, alturaPlataforma, 48),
  new THREE.MeshStandardMaterial({ map: texturaPiedra })
)
plataforma.position.y = alturaPlataforma / 2
plataforma.castShadow = true
plataforma.receiveShadow = true
escena.add(plataforma)

////////////////////////////////////////////////
// 5. VITRINAS: 5 pedestales, cada uno con un material distinto
// Cada elemento del array es un objeto con nombre, geometría y material
const vitrinas = [
  {
    nombre: 'MeshBasicMaterial (no usa luz)',
    geometria: new THREE.SphereGeometry(0.8, 32, 32),
    material: new THREE.MeshBasicMaterial({ color: 0xffcc00 })
  },
  {
    nombre: 'MeshMatcapMaterial (luz falsa de una imagen)',
    geometria: new THREE.TorusGeometry(0.7, 0.3, 16, 48),
    material: new THREE.MeshMatcapMaterial({ matcap: texturaMatcap })
  },
  {
    nombre: 'MeshPhongMaterial (brillante)',
    geometria: new THREE.ConeGeometry(0.8, 1.6, 32),
    material: new THREE.MeshPhongMaterial({ color: 0xcc3333, shininess: 100 })
  },
  {
    nombre: 'MeshToonMaterial (estilo caricatura)',
    geometria: new THREE.IcosahedronGeometry(0.9),
    material: new THREE.MeshToonMaterial({ color: 0x3399ff })
  },
  {
    nombre: 'MeshStandardMaterial (realista)',
    geometria: new THREE.OctahedronGeometry(0.9),
    material: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.2 })
  }
]

const materialPedestal = new THREE.MeshStandardMaterial({ map: texturaPiedra })
const alturaPedestal = 1.5
const objetosFlotantes = [] // los que se mueven con sin/cos
const clickeables = []      // los que detecta el mouse

// Ciclo: se repite una vez por cada vitrina del array
for (let i = 0; i < vitrinas.length; i++) {
  const datos = vitrinas[i]
  const angulo = (i / vitrinas.length) * Math.PI * 2
  const x = Math.cos(angulo) * radioCirculo
  const z = Math.sin(angulo) * radioCirculo

  // Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(2, alturaPedestal, 2),
    materialPedestal
  )
  pedestal.position.set(x, alturaPedestal / 2, z)
  pedestal.rotation.y = -angulo
  pedestal.castShadow = true
  pedestal.receiveShadow = true
  escena.add(pedestal)

  // Objeto que flota encima del pedestal
  const objeto = new THREE.Mesh(datos.geometria, datos.material)
  const alturaBase = alturaPedestal + 1.2
  objeto.position.set(x, alturaBase, z)
  objeto.castShadow = true
  objeto.userData.nombre = datos.nombre
  objeto.userData.raiz = objeto       // "raiz" es lo que se anima al hacer click
  objeto.userData.alturaBase = alturaBase
  objeto.userData.fase = i            // para que no floten todos al mismo tiempo
  escena.add(objeto)

  objetosFlotantes.push(objeto)
  clickeables.push(objeto)
}

////////////////////////////////////////////////
// 6. MODELO DE CINEMA 4D
const cargadorModelos = new GLTFLoader()
let modelo = null

cargadorModelos.load(
  '/models/escaparate.gltf',
  function (gltf) {
    modelo = gltf.scene

    // Escalar para que mida "alturaModelo" sin importar las unidades de Cinema 4D
    const caja = new THREE.Box3().setFromObject(modelo)
    const tamano = caja.getSize(new THREE.Vector3())
    modelo.scale.setScalar(alturaModelo / tamano.y)

    // Centrarlo y apoyarlo sobre la plataforma
    caja.setFromObject(modelo)
    const centro = caja.getCenter(new THREE.Vector3())
    modelo.position.x -= centro.x
    modelo.position.z -= centro.z
    modelo.position.y += alturaPlataforma - caja.min.y

    modelo.userData.nombre = 'Arcos griegos (modelo de Cinema 4D)'

    // Sombras y detección de mouse en cada parte del modelo
    modelo.traverse(function (parte) {
      if (parte.isMesh) {
		parte.material = new THREE.MeshStandardMaterial({ map: texturaColumnas })
        parte.castShadow = true
        parte.receiveShadow = true
        parte.userData.raiz = modelo
        clickeables.push(parte)
      }
    })

    escena.add(modelo)
  },
  undefined,
  function (error) {
    console.log('No se pudo cargar el modelo. Revisa public/models/escaparate.gltf', error)
  }
)

////////////////////////////////////////////////
// 7. LOOP DE ANIMACIÓN
function animar() {
  const tiempo = performance.now() / 1000 // segundos desde que abrió la página

  // Movimiento LINEAL: suma una cantidad fija en cada frame
  plataforma.rotation.y += velocidadPlataforma

  // Movimiento OSCILATORIO: sin y cos suben y bajan suavemente
  for (let i = 0; i < objetosFlotantes.length; i++) {
    const objeto = objetosFlotantes[i]
    const fase = objeto.userData.fase
    objeto.position.y = objeto.userData.alturaBase + Math.sin(tiempo * 2 + fase) * 0.3
    objeto.rotation.z = Math.cos(tiempo + fase) * 0.2
    objeto.rotation.y += 0.01 // lineal también
  }

  controles.update()
  renderizador.render(escena, camara)
  requestAnimationFrame(animar)
}

ajustarTamano()
animar()

////////////////////////////////////////////////
// 8. DETECTAR OBJETOS BAJO EL MOUSE (Raycaster)
const raycaster = new THREE.Raycaster()
const puntero = new THREE.Vector2()

// Función propia: devuelve el objeto "raiz" bajo el mouse, o null si no hay nada
function objetoBajoElMouse(evento) {
  // Convierte la posición del mouse a coordenadas de -1 a 1
  puntero.x = (evento.clientX / window.innerWidth) * 2 - 1
  puntero.y = -(evento.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(puntero, camara)
  const resultados = raycaster.intersectObjects(clickeables, false)

  if (resultados.length > 0) {
    return resultados[0].object.userData.raiz
  }
  return null
}

// Al mover el mouse: muestra el nombre y cambia el cursor
window.addEventListener('pointermove', function (evento) {
  const objeto = objetoBajoElMouse(evento)
  if (objeto !== null) {
    nombreEnPantalla.textContent = objeto.userData.nombre
    nombreEnPantalla.style.opacity = 1
    canvas.style.cursor = 'pointer'
  } else {
    nombreEnPantalla.style.opacity = 0
    canvas.style.cursor = 'default'
  }
})

////////////////////////////////////////////////
// 9. ANIMACIONES CON TWEENS (gsap)
let modeloGirando = false

function girarModelo() {
  if (modelo === null || modeloGirando === true) return
  modeloGirando = true
  gsap.to(modelo.rotation, {
    duration: 2,
    y: modelo.rotation.y + Math.PI * 2,
    ease: 'power2.inOut',
    onComplete: function () {
      modeloGirando = false
    }
  })
}

function pulsarObjeto(objeto) {
  gsap.killTweensOf(objeto.scale)
  objeto.scale.set(1, 1, 1)
  gsap.to(objeto.scale, {
    duration: 0.3,
    x: 1.6,
    y: 1.6,
    z: 1.6,
    ease: 'power2.out',
    yoyo: true, // regresa a su tamaño original
    repeat: 1
  })
}

////////////////////////////////////////////////
// 10. EVENTOS DE CLICK Y TECLADO
window.addEventListener('click', function (evento) {
  const objeto = objetoBajoElMouse(evento)
  if (objeto === null) return

  if (objeto === modelo) {
    girarModelo()
  } else {
    pulsarObjeto(objeto)
  }
})

window.addEventListener('keydown', function (evento) {
  // Espacio: gira el modelo
  if (evento.code === 'Space') {
    girarModelo()
  }

  // L: prende o apaga el sol
  if (evento.code === 'KeyL') {
    sol.visible = !sol.visible
  }

  // C: cambia el color del cielo (día, atardecer, noche)
  if (evento.code === 'KeyC') {
    indiceCielo = indiceCielo + 1
    if (indiceCielo >= coloresCielo.length) {
      indiceCielo = 0
    }
    escena.background = new THREE.Color(coloresCielo[indiceCielo])
  }
})