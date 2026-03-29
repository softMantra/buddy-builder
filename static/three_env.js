import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ═══════════════════════════════════════════════════════════════
   VibeDesign — 3D Workspace Environment
   ═══════════════════════════════════════════════════════════════ */

let scene, camera, renderer, controls;
let overlay;
let loadedModels = [];

function init() {
    overlay = document.getElementById('three-overlay');

    // Scene setup
    scene = new THREE.Scene();
    
    // Make scene background transparent so 2D Canvas shows through
    scene.background = null; 

    // Camera setup
    const w = overlay.clientWidth || 800;
    const h = overlay.clientHeight || 600;
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 2, 10);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    overlay.appendChild(renderer.domElement);

    // Lighting (Calm, soothing studio lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // soft white light
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dd, 2.5); // Warm sun
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xccddff, 1.5); // Cool fill
    fillLight.position.set(-5, 0, 5);
    scene.add(fillLight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Handle resizing
    window.addEventListener('resize', onWindowResize, false);

    // Animation loop
    renderer.setAnimationLoop(animate);
}

function onWindowResize() {
    const w = overlay.clientWidth || 800;
    const h = overlay.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

function animate() {
    // Gentle floating rotation for the models to look dynamic
    loadedModels.forEach(m => {
        m.rotation.y += 0.005;
    });

    controls.update();
    renderer.render(scene, camera);
}

// ── EXTERNAL API FOR editor.js ──────────────────────────────────
window.add3DModelToScene = function(glbUrl) {
    overlay.classList.remove('hidden');
    overlay.classList.add('active'); // Enables pointer events

    const loader = new GLTFLoader();
    
    // Add a loading toast via DOM
    const t = document.createElement("div");
    t.className = "toast toast-success";
    t.textContent = "Loading 3D Model...";
    document.body.appendChild(t);

    loader.load(glbUrl, (gltf) => {
        t.remove();

        const model = gltf.scene;

        // Auto-scale to fit nicely in view
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 4 / maxDim; // Fit within 4 units size
        
        model.scale.setScalar(scale);
        
        // Center the model
        model.position.sub(center.multiplyScalar(scale));

        // Random Y scatter so they don't spawn completely overlapping if clicked multiple times
        model.position.x += (Math.random() - 0.5) * 4;

        scene.add(model);
        loadedModels.push(model);

        // Notify 3D mode is active
        const done = document.createElement("div");
        done.className = "toast toast-success";
        done.textContent = "3D Asset Placed! Drag mouse to rotate.";
        document.body.appendChild(done);
        setTimeout(() => done.remove(), 4000);

    }, undefined, (error) => {
        console.error("Error loading GLB:", error);
        t.innerText = "Error loading Model";
        t.className = "toast toast-error";
        setTimeout(() => t.remove(), 4000);
    });
};

// Toggle between 2D selection and 3D orbiting
document.addEventListener('keydown', (e) => {
    // Esc hides the 3D overlay pointer-events so user can click 2D canvas again
    if (e.key === 'Escape') {
        overlay.classList.remove('active');
        const done = document.createElement("div");
        done.className = "toast toast-success";
        done.textContent = "Exited 3D Edit Mode. Press 3D tool again to re-enter.";
        document.body.appendChild(done);
        setTimeout(() => done.remove(), 4000);
    }
});

// Boot
init();
