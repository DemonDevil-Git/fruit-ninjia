import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameState, HandPosition, GameObject, GameObjectType } from '../types';
import { audioService } from '../services/audioService';

interface GameCanvasProps {
  handPosition: HandPosition;
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  setLives: React.Dispatch<React.SetStateAction<number>>;
}

// Interface for visual-only objects (particles, slices)
interface VisualEffect {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  rotSpeed: number;
  opacity: number;
  life: number; // 0 to 1
  decay: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  handPosition, 
  gameState, 
  setGameState,
  setScore,
  setLives
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bladeRef = useRef<THREE.Mesh | null>(null);
  const trailPositionsRef = useRef<THREE.Vector3[]>([]);
  
  // Game Logic Refs
  const objectsRef = useRef<GameObject[]>([]);
  const effectsRef = useRef<VisualEffect[]>([]); // Track slices and particles
  const lastSpawnTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const handPosRef = useRef<HandPosition>(handPosition);
  const gameStateRef = useRef<GameState>(gameState);

  // Sync refs with props
  useEffect(() => { handPosRef.current = handPosition; }, [handPosition]);
  
  // Handle Game State Changes
  useEffect(() => { 
    gameStateRef.current = gameState; 
    
    if (gameState === GameState.START) {
      trailPositionsRef.current = [];
      
      // Cleanup all objects and effects
      if (sceneRef.current) {
        objectsRef.current.forEach(obj => {
          if (obj.mesh) sceneRef.current?.remove(obj.mesh);
        });
        effectsRef.current.forEach(eff => {
          sceneRef.current?.remove(eff.mesh);
        });
      }
      objectsRef.current = [];
      effectsRef.current = [];
    }
  }, [gameState]);

  // Asset Generation Helpers
  const createEmojiTexture = (emoji: string): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '90px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  };

  const createEarthMesh = (): THREE.Group => {
    const group = new THREE.Group();
    // Wireframe Sphere
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);
    // Inner Core
    const coreGeo = new THREE.IcosahedronGeometry(0.8, 0);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.3 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);
    return group;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Init Three.js ---
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const aspect = width / height;
    const frustumHeight = 10;
    const frustumWidth = frustumHeight * aspect;
    const camera = new THREE.OrthographicCamera(
      frustumWidth / -2, frustumWidth / 2,
      frustumHeight / 2, frustumHeight / -2,
      0.1, 100
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // --- Blade Setup ---
    const trailLen = 20;
    const bladeGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(trailLen * 2 * 3); 
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const indices: number[] = [];
    for (let i = 0; i < trailLen - 1; i++) {
        const i2 = i * 2;
        indices.push(i2, i2 + 1, i2 + 2);
        indices.push(i2 + 1, i2 + 3, i2 + 2);
    }
    bladeGeo.setIndex(indices);

    const bladeMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      depthTest: false 
    });
    const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
    bladeMesh.renderOrder = 999;
    scene.add(bladeMesh);
    bladeRef.current = bladeMesh;
    trailPositionsRef.current = [];

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const asp = w / h;
      const fh = 10;
      const fw = fh * asp;
      
      cameraRef.current.left = fw / -2;
      cameraRef.current.right = fw / 2;
      cameraRef.current.top = fh / 2;
      cameraRef.current.bottom = fh / -2;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // --- Helpers ---
    const spawnObject = (forceType?: GameObjectType) => {
      if (!cameraRef.current) return;

      let type = forceType;
      if (!type) {
        if (Math.random() > 0.8) {
          type = GameObjectType.BOMB;
        } else {
          const options = [
            GameObjectType.WATERMELON, GameObjectType.POOP, GameObjectType.BANANA,
            GameObjectType.GRAPE, GameObjectType.MELON, GameObjectType.TANGERINE, GameObjectType.CACTUS
          ];
          type = options[Math.floor(Math.random() * options.length)];
        }
      }
      
      let mesh: THREE.Object3D;
      let emojiChar = '';

      if (type === GameObjectType.EARTH) {
        mesh = createEarthMesh();
      } else {
        switch(type) {
          case GameObjectType.WATERMELON: emojiChar = '🍉'; break;
          case GameObjectType.POOP: emojiChar = '💩'; break;
          case GameObjectType.BOMB: emojiChar = '💣'; break;
          case GameObjectType.BANANA: emojiChar = '🍌'; break;
          case GameObjectType.GRAPE: emojiChar = '🍇'; break;
          case GameObjectType.MELON: emojiChar = '🍈'; break;
          case GameObjectType.TANGERINE: emojiChar = '🍊'; break;
          case GameObjectType.CACTUS: emojiChar = '🌵'; break;
          default: emojiChar = '❓';
        }
        
        const map = createEmojiTexture(emojiChar);
        const mat = new THREE.SpriteMaterial({ map: map });
        mesh = new THREE.Sprite(mat);
      }

      const camL = cameraRef.current.left;
      const camR = cameraRef.current.right;
      const camB = cameraRef.current.bottom;

      const startX = (Math.random() * (camR - camL) * 0.8) + camL * 0.8;
      const startY = camB - 1; 
      
      mesh.position.set(startX, startY, 0);
      mesh.scale.set(1.5, 1.5, 1.5);

      const vx = (Math.random() - 0.5) * 0.06;
      const vy = (Math.random() * 0.1) + 0.12; 
      const rot = (Math.random() - 0.5) * 0.1;

      scene.add(mesh);

      const obj: GameObject = {
        id: Math.random().toString(36),
        type: type!,
        x: startX,
        y: startY,
        z: 0,
        vx,
        vy,
        vz: 0,
        rotationSpeed: rot,
        isSliced: false,
        scale: 1.5,
        emoji: emojiChar,
        mesh: mesh
      };
      
      objectsRef.current.push(obj);
    };

    // Spawn broken fruit pieces
    const spawnSlices = (obj: GameObject) => {
      if (!sceneRef.current || !obj.mesh) return;

      const isSprite = obj.mesh instanceof THREE.Sprite;
      const texture = isSprite ? (obj.mesh.material as THREE.SpriteMaterial).map : null;

      if (!texture) return; // Can't slice non-sprites easily (Earth)

      // We need two planes for the halves
      // Original scale is 1.5. Each half should be width 0.75, height 1.5
      const halfWidth = 0.75;
      const height = 1.5;

      const createHalf = (isLeft: boolean) => {
        const geo = new THREE.PlaneGeometry(halfWidth, height);
        
        // Adjust UVs to show half the texture
        const uvs = geo.attributes.uv;
        if (isLeft) {
          // Map 0-0.5 X
          uvs.setXY(0, 0, 1);     // top-left
          uvs.setXY(1, 0.5, 1);   // top-right
          uvs.setXY(2, 0, 0);     // bottom-left
          uvs.setXY(3, 0.5, 0);   // bottom-right
        } else {
          // Map 0.5-1.0 X
          uvs.setXY(0, 0.5, 1);
          uvs.setXY(1, 1, 1);
          uvs.setXY(2, 0.5, 0);
          uvs.setXY(3, 1, 0);
        }
        uvs.needsUpdate = true;

        const mat = new THREE.MeshBasicMaterial({ 
          map: texture, 
          transparent: true, 
          side: THREE.DoubleSide 
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Position slightly offset
        const offset = isLeft ? -0.4 : 0.4;
        mesh.position.set(obj.x + offset, obj.y, obj.z);
        // Copy original rotation then add some
        mesh.rotation.z = (obj.mesh?.rotation.z || 0) + (isLeft ? -0.2 : 0.2);
        
        sceneRef.current?.add(mesh);

        const vx = obj.vx + (isLeft ? -0.05 : 0.05);
        const vy = obj.vy + 0.05;

        effectsRef.current.push({
          mesh,
          vx,
          vy,
          rotSpeed: isLeft ? -0.1 : 0.1,
          opacity: 1,
          life: 1,
          decay: 0.02
        });
      };

      createHalf(true);
      createHalf(false);
    };

    // Spawn fading particles (Juice)
    const spawnParticles = (x: number, y: number, color: number) => {
        const particleCount = 8;
        const geo = new THREE.PlaneGeometry(0.15, 0.15);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
        
        for(let i=0; i<particleCount; i++) {
            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.position.set(x, y, 0);
            scene.add(mesh);
            
            // Random explosion velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.1;

            effectsRef.current.push({
                mesh,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                opacity: 1,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.02 // Random decay
            });
        }
    };

    // --- Main Loop ---
    const animate = (time: number) => {
      requestRef.current = requestAnimationFrame(animate);
      
      if (!sceneRef.current || !cameraRef.current || !bladeRef.current) return;

      const currentState = gameStateRef.current;
      const hand = handPosRef.current;

      // 1. Update Hand/Blade
      if (hand.isDetected) {
        const w = cameraRef.current.right - cameraRef.current.left;
        const h = cameraRef.current.top - cameraRef.current.bottom;
        const worldX = (hand.x - 0.5) * w;
        const worldY = -(hand.y - 0.5) * h;
        const currentPos = new THREE.Vector3(worldX, worldY, 0);
        
        if (trailPositionsRef.current.length === 0) {
            for(let i=0; i<trailLen; i++) trailPositionsRef.current.push(currentPos);
        } else {
            trailPositionsRef.current.unshift(currentPos);
            if (trailPositionsRef.current.length > trailLen) trailPositionsRef.current.pop();
        }

        if (trailPositionsRef.current.length >= 2) {
             const dist = trailPositionsRef.current[0].distanceTo(trailPositionsRef.current[1]);
             if (dist > 0.4 && Math.random() > 0.9) audioService.playSlice();
        }
        bladeRef.current.visible = true;
      } else {
        trailPositionsRef.current = [];
        bladeRef.current.visible = false;
      }

      // Update Blade Geometry
      const points = trailPositionsRef.current;
      if (points.length > 1 && bladeRef.current.visible) {
        const posAttr = bladeRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const positionsArr = posAttr.array as Float32Array;
        const widthMax = 0.1; // Thin blade

        for(let i=0; i<points.length; i++) {
            const curr = points[i];
            let prev = points[Math.max(0, i-1)];
            let next = points[Math.min(points.length-1, i+1)];
            let dx = next.x - prev.x;
            let dy = next.y - prev.y;
            
            if (i === 0) { dx = points[1].x - points[0].x; dy = points[1].y - points[0].y; }
            else if (i === points.length - 1) { dx = points[i].x - points[i-1].x; dy = points[i].y - points[i-1].y; }

            let len = Math.sqrt(dx*dx + dy*dy);
            if (len === 0) len = 1;
            const nx = -dy / len;
            const ny = dx / len;
            const width = widthMax * (1 - (i / points.length));
            
            const idx = i * 2;
            positionsArr[idx * 3] = curr.x + nx * width;
            positionsArr[idx * 3 + 1] = curr.y + ny * width;
            positionsArr[idx * 3 + 2] = 0.1;
            positionsArr[(idx+1) * 3] = curr.x - nx * width;
            positionsArr[(idx+1) * 3 + 1] = curr.y - ny * width;
            positionsArr[(idx+1) * 3 + 2] = 0.1;
        }
        // Reset tail
        for(let i=points.length; i<trailLen; i++) {
             const idx = i * 2;
             positionsArr[idx * 3] = points[points.length-1].x;
             positionsArr[idx * 3 + 1] = points[points.length-1].y;
             positionsArr[(idx+1) * 3] = points[points.length-1].x;
             positionsArr[(idx+1) * 3 + 1] = points[points.length-1].y;
        }
        posAttr.needsUpdate = true;
      }

      // 2. Game Logic - Spawning
      if (currentState === GameState.START) {
        if (objectsRef.current.length === 0) spawnObject(GameObjectType.EARTH);
      } else if (currentState === GameState.PLAYING) {
        if (time - lastSpawnTimeRef.current > 1200) {
            if (Math.random() > 0.3) spawnObject(); 
            lastSpawnTimeRef.current = time;
        }
      }

      // 3. Update Active Objects
      const gravity = -0.002;
      const bladeTip = trailPositionsRef.current[0] || new THREE.Vector3(999,999,999);

      for (let i = objectsRef.current.length - 1; i >= 0; i--) {
        const obj = objectsRef.current[i];
        const mesh = obj.mesh as THREE.Object3D;

        if (obj.type === GameObjectType.EARTH && currentState === GameState.START) {
            mesh.rotation.y += 0.01;
            mesh.rotation.z += 0.005;
            mesh.position.set(0, 0, 0);
        } else {
            obj.x += obj.vx;
            obj.y += obj.vy;
            obj.vy += gravity;
            mesh.rotation.z += obj.rotationSpeed;
            mesh.position.set(obj.x, obj.y, obj.z);
        }

        const hitDist = 1.2;
        const dist = bladeTip.distanceTo(mesh.position);
        
        if (!obj.isSliced && hand.isDetected && dist < hitDist) {
            obj.isSliced = true;

            if (obj.type === GameObjectType.BOMB) {
                audioService.playExplosion();
                setLives(l => {
                    setGameState(GameState.GAME_OVER);
                    return 0;
                });
                sceneRef.current.remove(mesh);
                objectsRef.current.splice(i, 1);
                continue;
            } else if (obj.type === GameObjectType.EARTH) {
                audioService.playStart();
                setGameState(GameState.PLAYING);
                sceneRef.current.remove(mesh);
                objectsRef.current.splice(i, 1);
                continue;
            } else if (obj.type === GameObjectType.POOP) {
                audioService.playHit(false);
                setScore(s => Math.max(0, s - 10));
                
                spawnSlices(obj); // Split effect
                spawnParticles(obj.x, obj.y, 0x8B4513);
                
                sceneRef.current.remove(mesh);
                objectsRef.current.splice(i, 1);
                continue;
            } else {
                audioService.playHit(true);
                setScore(s => s + 10);
                
                spawnSlices(obj); // Split effect
                spawnParticles(obj.x, obj.y, 0xFF0000);
                
                sceneRef.current.remove(mesh);
                objectsRef.current.splice(i, 1);
                continue;
            }
        }

        if (obj.y < cameraRef.current.bottom - 2) {
            if (currentState === GameState.PLAYING && !obj.isSliced) {
               const isTarget = [
                  GameObjectType.WATERMELON, GameObjectType.BANANA, GameObjectType.GRAPE,
                  GameObjectType.MELON, GameObjectType.TANGERINE, GameObjectType.CACTUS
               ].includes(obj.type);

               if (isTarget) {
                   setLives(l => {
                       const newLives = l - 1;
                       if (newLives <= 0) setGameState(GameState.GAME_OVER);
                       return newLives;
                   });
               }
            }
            sceneRef.current.remove(mesh);
            objectsRef.current.splice(i, 1);
        }
      }

      // 4. Update Visual Effects (Slices & Particles)
      for (let i = effectsRef.current.length - 1; i >= 0; i--) {
          const eff = effectsRef.current[i];
          eff.vy += gravity * 1.5; // Falls faster
          eff.mesh.position.set(eff.mesh.position.x + eff.vx, eff.mesh.position.y + eff.vy, 0);
          eff.mesh.rotation.z += eff.rotSpeed;
          
          eff.life -= eff.decay;
          (eff.mesh.material as THREE.Material).opacity = eff.life;

          if (eff.life <= 0 || eff.mesh.position.y < cameraRef.current.bottom - 5) {
              sceneRef.current.remove(eff.mesh);
              (eff.mesh.geometry as THREE.BufferGeometry).dispose();
              (eff.mesh.material as THREE.Material).dispose();
              effectsRef.current.splice(i, 1);
          }
      }

      // Cleanup Game Over
      if (currentState === GameState.GAME_OVER) {
          if (objectsRef.current.length > 0) {
            objectsRef.current.forEach(o => sceneRef.current?.remove(o.mesh as THREE.Object3D));
            objectsRef.current = [];
          }
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      bladeGeo.dispose();
      bladeMat.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none" />;
};

export default GameCanvas;