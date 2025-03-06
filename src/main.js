import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createGroundPlane } from './utils/groundPlane';
import SceneManager from './managers/sceneManger';
import RendererManager from './managers/rendererManager';
import CameraManager from './managers/cameraManager';
import Stats from 'stats.js'
import { createGrassMesh } from './utils/grass';
import * as dat from 'dat.gui';

// Global clock to track elapsed time for animations
let clock = new THREE.Clock();

class App {
	constructor() {
		// Expose the app instance globally (useful for debugging)
		window.windowStage = this;

		// Initialize the main components of our 3D scene
		this.loadStage();

		// Set up event listeners for interactions
		this.addEventListeners();

		// Add performance monitoring stats
		this.setupPerformanceStats();
	}

	// Set up performance monitoring
	setupPerformanceStats() {
		// Initialize Stats.js for tracking performance
		this.stats = new Stats();

		// 0: FPS, 1: MS, 2: MB, 3+: custom panels
		this.stats.showPanel(0);

		// Add stats panel to the document body
		document.body.appendChild(this.stats.dom);
	}

	loadStage() {
		// Create scene management
		this.sceneManager = new SceneManager(this);

		// Set up renderer
		this.renderManager = new RendererManager();
		document.body.appendChild(this.renderManager.renderer.domElement);
		this.renderManager.renderer.setSize(window.innerWidth, window.innerHeight);

		// Configure camera
		this.cameraManager = new CameraManager();

		// Position camera to have a good view of the scene
		// Lifted up and back to see the entire ground plane and grass
		this.cameraManager.camera.position.set(0, 50, 100);
		this.cameraManager.camera.lookAt(0, 0, 0);

		// Add interactive orbit controls
		this.setupOrbitControls();

		// Create and add ground plane
		const groundPlane = createGroundPlane(100, 100);
		this.sceneManager.scene.add(groundPlane);

		// Set up GUI for interactive parameter tweaking
		this.addDatGUI();

		// Create and add grass mesh
		this.grass = createGrassMesh()
		this.sceneManager.scene.add(this.grass);
	}

	// Set up smooth camera controls
	setupOrbitControls() {
		this.controls = new OrbitControls(
			this.cameraManager.camera,
			this.renderManager.renderer.domElement
		);

		// Enable inertial damping for smoother camera movement
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
	}

	addDatGUI() {
		// Default parameters for grass and wind simulation
		this.grassParams = {
			bladeHeight: 15,
			bladeHeightVariation: 0.4,
			bladeWidth: 0.5,
			grassBlades: 100000,
			windSpeed: 3.0,
			windIntensity: 1.4,
			windTurbulence: 0.7,
			windDirectionX: 1,
			windDirectionY: 0,
			windDirectionZ: 1,
			grassColorBottom: 0x0c3302,
			grassColorTop: 0x7f7f19,
			windGustFrequency: 0.15,    // How frequently gusts occur
			windGustIntensity: 0.35,    // How strong gusts are
			microMovement: 0.2,         // Small, independent blade movements
			wavePropagation: 0.05,  
		};

		// Initialize DAT.GUI for interactive parameter adjustment
		this.gui = new dat.GUI();

		// Folder for grass blade parameters
		const bladeFolder = this.gui.addFolder('Blade Parameters');
		bladeFolder.add(this.grassParams, 'bladeHeight', 5, 25)
			.onFinishChange(this.recreateGrass.bind(this))
			.name('Blade Height');
		bladeFolder.add(this.grassParams, 'bladeHeightVariation', 0, 1)
			.onFinishChange(this.recreateGrass.bind(this))
			.name('Height Variation');
		bladeFolder.add(this.grassParams, 'bladeWidth', 0.05, 0.5)
			.onFinishChange(this.recreateGrass.bind(this))
			.name('Blade Width');
		bladeFolder.add(this.grassParams, 'grassBlades', 50000, 500000, 1000)
			.onFinishChange(this.recreateGrass.bind(this))
			.name('Number of Blades');
		bladeFolder.open();

		// Folder for wind simulation parameters
		const windFolder = this.gui.addFolder('Wind Parameters');
		windFolder.add(this.grassParams, 'windSpeed', 0, 5, 0.5)
			.onChange(this.updateWind.bind(this))
			.name('Wind Speed');
		windFolder.add(this.grassParams, 'windIntensity', 0, 2, 0.1)
			.onChange(this.updateWind.bind(this))
			.name('Wind Intensity');
		windFolder.add(this.grassParams, 'windTurbulence', 0, 2, 0.1)
			.onChange(this.updateWind.bind(this))
			.name('Wind Turbulence');

		// Folder for grass color customization
		const colorFolder = this.gui.addFolder('Color Parameters');
		colorFolder.addColor(this.grassParams, 'grassColorBottom')
			.onChange(this.recreateGrass.bind(this))
			.name('Bottom Color');
		colorFolder.addColor(this.grassParams, 'grassColorTop')
			.onChange(this.recreateGrass.bind(this))
			.name('Top Color');
		colorFolder.open();
	}

	// Recreate grass mesh when parameters change
	recreateGrass() {
		// Remove existing grass from the scene
		this.sceneManager.scene.remove(this.grass);

		// Create new grass mesh with updated parameters
		const newGrassMesh = createGrassMesh(this.grassParams);
		this.sceneManager.scene.add(newGrassMesh);
		this.grass = newGrassMesh;
	}

	// Update wind effect based on current parameters
	updateWind() {
		if (this.grass) {
			// Create wind direction vector from parameters
			const windDirection = new THREE.Vector3(
				this.grassParams.windDirectionX,
				this.grassParams.windDirectionY,
				this.grassParams.windDirectionZ
			);

			// Apply wind parameters to grass mesh
			this.grass.updateWind(this.time, {
				windSpeed: this.grassParams.windSpeed,
				windDirection: windDirection,
				windIntensity: this.grassParams.windIntensity,
				windTurbulence: this.grassParams.windTurbulence,
				gustFrequency: this.grassParams.windGustFrequency,
				gustIntensity: this.grassParams.windGustIntensity,
				microMovement: this.grassParams.microMovement,
				wavePropagation: this.grassParams.wavePropagation
			});
		}
	}

	// Main animation loop
	animate() {
		// Request next animation frame
		requestAnimationFrame(this.animate.bind(this));

		// Track elapsed time
		this.time = clock.getElapsedTime();

		// Update wind effect on grass
		this.grass.updateWind(this.time, this.grassParams);

		// Begin performance tracking
		this.stats.begin();

		// Update camera controls
		this.controls.update();

		// Render the scene
		this.renderManager.renderer.render(this.sceneManager.scene, this.cameraManager.camera);

		// End performance tracking
		this.stats.end();
	}

	// Add event listeners for responsive design
	addEventListeners() {
		// Adjust scene on window resize
		window.addEventListener("resize", this.onWindowResize.bind(this), false);
	}

	// Handle window resizing
	onWindowResize() {
		// Update camera aspect ratio
		this.cameraManager.camera.aspect = window.innerWidth / window.innerHeight;
		this.cameraManager.camera.updateProjectionMatrix();

		// Adjust renderer size
		this.renderManager.renderer.setSize(window.innerWidth, window.innerHeight);
	}
}

// Initialize and start the application
const app = new App();
app.animate();