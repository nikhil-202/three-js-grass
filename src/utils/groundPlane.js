import * as THREE from 'three';

export function createGroundPlane(width = 100, height = 100) {
	const planeGeometry = new THREE.PlaneGeometry(width, height);

	const planeMaterial = new THREE.MeshLambertMaterial({
		color: 0x555555,
		side: THREE.DoubleSide,
	});
	const plane = new THREE.Mesh(planeGeometry, planeMaterial);
	plane.rotation.x = -Math.PI / 2;

	const gridHelper = new THREE.GridHelper(width, height, 0xffffff, 0x444444);
	// Offset the grid slightly above the plane to prevent z-fighting
	gridHelper.position.y = 0.01;

	// Group the plane and the grid helper together
	const ground = new THREE.Group();

	ground.add(plane);
	ground.add(gridHelper);

	return ground;
}