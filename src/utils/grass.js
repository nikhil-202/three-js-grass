import * as THREE from 'three';

export function createGrassMesh(options = {}) {
    const {
        bladeHeight = 15,
        bladeHeightVariation = 0.4,
        bladeWidth = 0.5,
        grassBlades = 100000,
        grassPatchSize = 200,
        windSpeed = 3.0,
        windDirectionX = 1,
        windDirectionY = 0,
        windDirectionZ = 1,
        windIntensity = 1.4,
        windTurbulence = 0.7,
        grassColorTop = 0x7f7f19,
        grassColorBottom = 0x0c3302,
        verticesPerBlade = 3,
        // New parameters for more realistic wind
        windGustFrequency = 0.15,    // How frequently gusts occur
        windGustIntensity = 0.35,    // How strong gusts are
        microMovement = 0.2,         // Small, independent blade movements
        wavePropagation = 0.05,      // Wave-like movement across the field
    } = options;

    const windDirection = new THREE.Vector3(windDirectionX, windDirectionY, windDirectionZ);

    const generateBladeVertices = (baseBladeHeight, bladeWidth, verticesCount) => {
        // Randomize the blade height for this particular blade
        const actualBladeHeight = baseBladeHeight * (1 - bladeHeightVariation/2 + Math.random() * bladeHeightVariation);
        
        const vertices = new Float32Array(verticesCount * 3);

        // Base of blade
        vertices[0] = -bladeWidth / 2;
        vertices[1] = 0;
        vertices[2] = 0;

        // Tip of blade
        vertices[(verticesCount - 1) * 3] = bladeWidth / 2;
        vertices[(verticesCount - 1) * 3 + 1] = actualBladeHeight;
        vertices[(verticesCount - 1) * 3 + 2] = 0;

        // Middle vertices with curved shape
        for (let i = 1; i < verticesCount - 1; i++) {
            const t = i / (verticesCount - 1);
            // Enhanced curve factor for more natural blade shape
            const curveFactor = Math.sin(Math.PI * t) * actualBladeHeight * 0.25;

            vertices[i * 3] = (Math.random() - 0.5) * bladeWidth * (1 - Math.abs(t - 0.5) * 2);
            vertices[i * 3 + 1] = t * actualBladeHeight + curveFactor;
            vertices[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
        }

        return vertices;
    };

    const generateBladeIndices = (verticesCount) => {
        const indices = new Uint32Array((verticesCount - 2) * 3);
        
        for (let i = 0; i < verticesCount - 2; i++) {
            indices[i * 3] = 0;  // First vertex (base of blade)
            indices[i * 3 + 1] = i + 1;
            indices[i * 3 + 2] = i + 2;
        }
        
        return indices;
    };

    // We need to create an array to store individual blade heights
    const bladeHeights = new Float32Array(grassBlades);
    // Add blade stiffness variation - some blades are more rigid than others
    const bladeStiffness = new Float32Array(grassBlades);
    
    for (let i = 0; i < grassBlades; i++) {
        bladeHeights[i] = bladeHeight * (1 - bladeHeightVariation/2 + Math.random() * bladeHeightVariation);
        // Stiffness values from 0.7 (more flexible) to 1.3 (more rigid)
        bladeStiffness[i] = 0.7 + Math.random() * 0.6;
    }

    const vertices = generateBladeVertices(bladeHeight, bladeWidth, verticesPerBlade);
    const indices = generateBladeIndices(verticesPerBlade);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    // Add attributes for blade-specific properties
    const instanceBladeHeights = new Float32Array(grassBlades);
    const instanceBladeStiffness = new Float32Array(grassBlades);
    // Add random phase offset per blade for more varied movement
    const instancePhaseOffsets = new Float32Array(grassBlades);
    
    for (let i = 0; i < grassBlades; i++) {
        instanceBladeHeights[i] = bladeHeights[i];
        instanceBladeStiffness[i] = bladeStiffness[i];
        instancePhaseOffsets[i] = Math.random() * Math.PI * 2; // Random phase [0, 2π]
    }
    
    geometry.setAttribute('aBladeHeight', new THREE.InstancedBufferAttribute(instanceBladeHeights, 1));
    geometry.setAttribute('aStiffness', new THREE.InstancedBufferAttribute(instanceBladeStiffness, 1));
    geometry.setAttribute('aPhaseOffset', new THREE.InstancedBufferAttribute(instancePhaseOffsets, 1));

    const grassMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uWindSpeed: { value: windSpeed },
            uWindDirection: { value: windDirection },
            uColorBottom: { value: new THREE.Color(grassColorBottom) },
            uColorTop: { value: new THREE.Color(grassColorTop) },
            uWindNoiseFactor: { value: 1.0 },
            uWindTurbulence: { value: windTurbulence },
            uWindIntensity: { value: windIntensity },
            uBladeHeight: { value: bladeHeight },
            uBladeWidth: { value: bladeWidth },
            // New wind parameters
            uGustFrequency: { value: windGustFrequency },
            uGustIntensity: { value: windGustIntensity },
            uMicroMovement: { value: microMovement },
            uWavePropagation: { value: wavePropagation }
        },
        transparent: true,
        depthTest: false,
        vertexShader: `
        uniform float uTime;
        uniform float uWindSpeed;
        uniform vec3 uWindDirection;
        uniform vec3 uColorBottom;
        uniform vec3 uColorTop;
        uniform float uWindNoiseFactor;
        uniform float uWindTurbulence;
        uniform float uWindIntensity;
        uniform float uBladeHeight;
        uniform float uBladeWidth;
        uniform float uGustFrequency;
        uniform float uGustIntensity;
        uniform float uMicroMovement;
        uniform float uWavePropagation;
        
        attribute float aBladeHeight;
        attribute float aStiffness; 
        attribute float aPhaseOffset;
        
        varying vec3 vColor;
        
        // Improved Perlin 3D noise function
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;

            i = mod(i, 289.0);
            vec4 p = mod(((i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + vec4(0.0, i1.x, i2.x, 1.0 )), 289.0);
            
            float n_ = 1.0/7.0;
            vec3  ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );

            vec4 x = x_ *ns.x + vec4(0.0, 1.0, 2.0, 3.0);
            vec4 y = y_ *ns.x + vec4(0.0, 1.0, 2.0, 3.0);
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);

            vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
        }
        
        void main() {
            // Color gradient based on blade position
            float t = position.y / aBladeHeight;
            vColor = mix(uColorBottom, uColorTop, t);
            
            vec3 instancePos = instanceMatrix[3].xyz;
            
            float windTime = uTime * uWindSpeed;
            
            // Different noise scales for varied movement
            float noise1 = snoise(vec3(instancePos.xz * 0.15, windTime * 0.3));
            float noise2 = snoise(vec3(instancePos.xz * 0.1, windTime * 0.2));
            float noise3 = snoise(vec3(instancePos.xz * 0.05, windTime * 0.1)); // Larger scale, slower movement
            
            // Scale the vertex Y position by the ratio of this blade's height to the base height
            float heightRatio = aBladeHeight / uBladeHeight;
            vec3 scaledPosition = position;
            scaledPosition.y *= heightRatio;
            
            // Use non-linear scaling for more realistic bending (more at the top)
            float heightFactor = pow(scaledPosition.y / aBladeHeight, 2.0);
            
            // Wind direction normalization
            vec3 windVector = normalize(uWindDirection);
            
            // Create spatial wave propagation (wind moves across the field in waves)
            float spatialWave = sin(instancePos.x * uWavePropagation + 
                                    instancePos.z * uWavePropagation + 
                                    windTime * 0.5) * 0.5 + 0.5;
            
            // Create wind gusts (occasional stronger winds)
            float gustTime = windTime * uGustFrequency;
            float gust = pow(sin(gustTime) * 0.5 + 0.5, 3.0) * uGustIntensity;
            
            // Individual blade phase variation
            float individualPhase = sin(windTime * 0.7 + aPhaseOffset) * uMicroMovement;
            
            // Multi-layered wind movement with different frequencies
            float windIntensity = (
                // Primary wind movement
                sin(windTime + noise1 * 2.0 + instancePos.x * 0.01) * 0.5 + 
                // Secondary slower movement
                cos(windTime * 0.5 + noise2 * 2.0 + instancePos.z * 0.01) * 0.3 +
                // Tertiary very slow movement (large scale waves)
                sin(windTime * 0.2 + noise3 * 1.0) * 0.2 +
                // Add gusts
                gust +
                // Add spatial wave propagation
                spatialWave * 0.3 +
                // Individual blade movement
                individualPhase
            ) * uWindTurbulence * uWindIntensity;
            
            // Apply blade stiffness - stiffer blades move less
            windIntensity *= (1.0 / aStiffness);
            
            // Calculate the final sway amount
            float sway = windIntensity * 
                         heightFactor * 
                         (1.0 + uWindNoiseFactor * (noise1 + noise2));
            
            // Apply the wind displacement
            vec4 worldPos = instanceMatrix * vec4(scaledPosition, 1.0);
            
            // Apply x/z wind displacement based on direction
            worldPos.x += windVector.x * sway * 2.0;
            worldPos.z += windVector.z * sway * 2.0;
            
            // Add slight vertical displacement for more natural movement
            worldPos.y += abs(sway) * 0.1 * scaledPosition.y;
            
            gl_Position = projectionMatrix * modelViewMatrix * worldPos;
        }
      `,
        fragmentShader: `
          varying vec3 vColor;
          
          void main() {
            gl_FragColor = vec4(vColor, 1.0);
          }
        `,
        side: THREE.DoubleSide,
    });

    const instancedMesh = new THREE.InstancedMesh(geometry, grassMaterial, grassBlades);
    instancedMesh.frustumCulled = true;
    const dummy = new THREE.Object3D();

    const instanceMatrix = new Float32Array(grassBlades * 16);

    for (let i = 0; i < grassBlades; i++) {
        const x = (Math.random() - 0.5) * grassPatchSize;
        const z = (Math.random() - 0.5) * grassPatchSize;

        dummy.position.set(x, 0, z);
        dummy.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.5
        );
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        instanceMatrix.set(dummy.matrix.elements, i * 16);
    }

    instancedMesh.instanceMatrix.array = instanceMatrix;
    instancedMesh.instanceMatrix.needsUpdate = true;

    instancedMesh.updateWind = (time, options = {}) => {
        const {
            windSpeed = 3.0,
            windDirection = new THREE.Vector3(1, 0, 1),
            windIntensity = 0.5,
            windTurbulence = 0.7,
            // Add new parameters to the update function
            gustFrequency = windGustFrequency,
            gustIntensity = windGustIntensity,
            microMovement = microMovement,
            wavePropagation = wavePropagation
        } = options;

        grassMaterial.uniforms.uTime.value = time;
        grassMaterial.uniforms.uWindSpeed.value = windSpeed;
        grassMaterial.uniforms.uWindDirection.value = windDirection;
        grassMaterial.uniforms.uWindIntensity.value = windIntensity;
        grassMaterial.uniforms.uWindTurbulence.value = windTurbulence;
        
        // Update new wind parameters
        grassMaterial.uniforms.uGustFrequency.value = gustFrequency;
        grassMaterial.uniforms.uGustIntensity.value = gustIntensity;
        grassMaterial.uniforms.uMicroMovement.value = microMovement;
        grassMaterial.uniforms.uWavePropagation.value = wavePropagation;

        // Add slight randomness to wind noise factor for natural variation
        grassMaterial.uniforms.uWindNoiseFactor.value = 0.5 + Math.random() * 0.5;
    };

    return instancedMesh;
}