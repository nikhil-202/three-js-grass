import * as THREE from 'three';

export default class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2c3e50); // Dark blue tone reminiscent of evening
    }
}
