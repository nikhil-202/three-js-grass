import * as THREE from 'three';

export default class RendererManager {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            // preserveDrawingBuffer: true,
            // logarithmicDepthBuffer: true,
        });
        this.DPR = window.devicePixelRatio ? window.devicePixelRatio : 1;
        this.renderer.setPixelRatio(this.DPR);
    }
}
