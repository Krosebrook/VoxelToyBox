
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { AppState, AppMode, SimulationVoxel, RebuildTarget, VoxelData, BuildTool } from '../types';
import { CONFIG, COLORS } from '../utils/voxelConstants';

export class VoxelEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private instanceMesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  
  // Raycasting for Build Mode
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private ghostVoxel: THREE.Mesh;
  private targetHighlightVoxel: THREE.Mesh;
  
  private voxels: SimulationVoxel[] = [];
  private rebuildTargets: RebuildTarget[] = [];
  private rebuildStartTime: number = 0;
  
  private state: AppState = AppState.STABLE;
  private mode: AppMode = AppMode.VIEW;
  private buildTool: BuildTool = 'pencil';
  private selectedColor: number = 0x3b82f6;

  private onStateChange: (state: AppState) => void;
  private onCountChange: (count: number) => void;
  private onColorPick: (color: number) => void;
  private animationId: number = 0;

  constructor(
    container: HTMLElement, 
    onStateChange: (state: AppState) => void,
    onCountChange: (count: number) => void,
    onColorPick: (color: number) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onCountChange = onCountChange;
    this.onColorPick = onColorPick;

    // Init Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BG_COLOR);
    this.scene.fog = new THREE.Fog(CONFIG.BG_COLOR, 60, 140);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(30, 30, 60);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.target.set(0, 5, 0);

    // Ghost/Preview Voxel (The new block to be placed)
    const ghostGeo = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE + 0.02, CONFIG.VOXEL_SIZE + 0.02, CONFIG.VOXEL_SIZE + 0.02);
    const ghostMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.5,
        depthWrite: false
    });
    this.ghostVoxel = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostVoxel.visible = false;
    this.scene.add(this.ghostVoxel);

    // Target Highlight Voxel (Wireframe showing which existing block is targeted)
    const highlightGeo = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE + 0.05, CONFIG.VOXEL_SIZE + 0.05, CONFIG.VOXEL_SIZE + 0.05);
    const highlightMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    this.targetHighlightVoxel = new THREE.Mesh(highlightGeo, highlightMat);
    this.targetHighlightVoxel.visible = false;
    this.scene.add(this.targetHighlightVoxel);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(dirLight);

    // Floor
    const planeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), planeMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.FLOOR_Y;
    floor.receiveShadow = true;
    floor.name = "FLOOR";
    this.scene.add(floor);

    // Events
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));

    this.animate = this.animate.bind(this);
    this.animate();
  }

  public setMode(mode: AppMode) {
      this.mode = mode;
      this.ghostVoxel.visible = false;
      this.targetHighlightVoxel.visible = false;
  }

  public setTool(tool: BuildTool) {
      this.buildTool = tool;
  }

  public setBuildColor(hex: number) {
      this.selectedColor = hex;
      (this.ghostVoxel.material as THREE.MeshStandardMaterial).color.setHex(hex);
  }

  private onMouseMove(event: MouseEvent) {
      if (this.mode !== AppMode.BUILD) return;

      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const objects = this.instanceMesh ? [this.instanceMesh] : [];
      const floor = this.scene.getObjectByName("FLOOR")!;
      const intersects = this.raycaster.intersectObjects([...objects, floor]);

      this.ghostVoxel.visible = false;
      this.targetHighlightVoxel.visible = false;

      if (intersects.length > 0) {
          const intersect = intersects[0];
          
          if (this.buildTool === 'pencil') {
              // Highlight the "parent" voxel we are placing on top of
              if (intersect.object === this.instanceMesh && intersect.instanceId !== undefined) {
                  const v = this.voxels[intersect.instanceId];
                  this.targetHighlightVoxel.visible = true;
                  this.targetHighlightVoxel.position.set(v.x, v.y, v.z);
                  (this.targetHighlightVoxel.material as THREE.MeshBasicMaterial).color.set(0xffffff);
              }

              // Show the ghost placement block
              this.ghostVoxel.visible = true;
              const pos = intersect.point.clone().add(intersect.face!.normal.clone().multiplyScalar(0.5));
              this.ghostVoxel.position.set(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z));
          } else if (this.buildTool === 'eraser' || this.buildTool === 'picker') {
              // Only highlight if we are over a voxel (not the floor)
              if (intersect.object === this.instanceMesh && intersect.instanceId !== undefined) {
                  const v = this.voxels[intersect.instanceId];
                  this.targetHighlightVoxel.visible = true;
                  this.targetHighlightVoxel.position.set(v.x, v.y, v.z);
                  // Red for erase, Green for pick
                  const color = this.buildTool === 'eraser' ? 0xff4444 : 0x4ade80;
                  (this.targetHighlightVoxel.material as THREE.MeshBasicMaterial).color.set(color);
              }
          }
      }
  }

  private onMouseDown(event: MouseEvent) {
      if (this.mode !== AppMode.BUILD || this.state !== AppState.STABLE) return;
      if (event.button !== 0) return; // Left click only

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const objects = this.instanceMesh ? [this.instanceMesh] : [];
      const intersects = this.raycaster.intersectObjects([...objects, this.scene.getObjectByName("FLOOR")!]);

      if (intersects.length > 0) {
          const intersect = intersects[0];

          if (this.buildTool === 'pencil') {
              const pos = intersect.point.clone().add(intersect.face!.normal.clone().multiplyScalar(0.5));
              this.addVoxel(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z), this.selectedColor);
          } else if (this.buildTool === 'eraser') {
              if (intersect.object === this.instanceMesh && intersect.instanceId !== undefined) {
                  this.removeVoxel(intersect.instanceId);
              }
          } else if (this.buildTool === 'picker') {
              if (intersect.object === this.instanceMesh && intersect.instanceId !== undefined) {
                  const color = this.voxels[intersect.instanceId].color.getHex();
                  this.onColorPick(color);
              }
          }
      }
  }

  private addVoxel(x: number, y: number, z: number, color: number) {
      // Check if voxel already exists at this exact position
      if (this.voxels.some(v => v.x === x && v.y === y && v.z === z)) return;

      const c = new THREE.Color(color);
      const newVoxel: SimulationVoxel = {
          id: this.voxels.length,
          x, y, z, color: c,
          vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
          rvx: 0, rvy: 0, rvz: 0
      };

      this.voxels.push(newVoxel);
      this.rebuildInstanceMesh();
      this.onCountChange(this.voxels.length);
  }

  private removeVoxel(index: number) {
      this.voxels.splice(index, 1);
      this.rebuildInstanceMesh();
      this.onCountChange(this.voxels.length);
  }

  private rebuildInstanceMesh() {
      // We must recreate the InstancedMesh when the count changes
      this.createVoxels(this.voxels.map(v => ({ x: v.x, y: v.y, z: v.z, color: v.color.getHex() })));
  }

  public loadInitialModel(data: VoxelData[]) {
    this.createVoxels(data);
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
  }

  private createVoxels(data: VoxelData[]) {
    if (this.instanceMesh) {
      this.scene.remove(this.instanceMesh);
      this.instanceMesh.geometry.dispose();
      if (Array.isArray(this.instanceMesh.material)) {
          this.instanceMesh.material.forEach(m => m.dispose());
      } else {
          this.instanceMesh.material.dispose();
      }
    }

    this.voxels = data.map((v, i) => {
        const c = new THREE.Color(v.color);
        return {
            id: i,
            x: v.x, y: v.y, z: v.z, color: c,
            vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0,
            rvx: 0, rvy: 0, rvz: 0
        };
    });

    const geometry = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
    this.instanceMesh = new THREE.InstancedMesh(geometry, material, this.voxels.length);
    this.instanceMesh.castShadow = true;
    this.instanceMesh.receiveShadow = true;
    this.scene.add(this.instanceMesh);

    this.draw();
  }

  private draw() {
    if (!this.instanceMesh) return;
    this.voxels.forEach((v, i) => {
        this.dummy.position.set(v.x, v.y, v.z);
        this.dummy.rotation.set(v.rx, v.ry, v.rz);
        this.dummy.updateMatrix();
        this.instanceMesh!.setMatrixAt(i, this.dummy.matrix);
        this.instanceMesh!.setColorAt(i, v.color);
    });
    this.instanceMesh.instanceMatrix.needsUpdate = true;
    this.instanceMesh.instanceColor!.needsUpdate = true;
  }

  public dismantle() {
    if (this.state !== AppState.STABLE || this.mode === AppMode.BUILD) return;
    this.state = AppState.DISMANTLING;
    this.onStateChange(this.state);

    this.voxels.forEach(v => {
        v.vx = (Math.random() - 0.5) * 0.8;
        v.vy = Math.random() * 0.5;
        v.vz = (Math.random() - 0.5) * 0.8;
        v.rvx = (Math.random() - 0.5) * 0.2;
        v.rvy = (Math.random() - 0.5) * 0.2;
        v.rvz = (Math.random() - 0.5) * 0.2;
    });
  }

  private getColorDist(c1: THREE.Color, hex2: number): number {
    const c2 = new THREE.Color(hex2);
    const r = (c1.r - c2.r) * 0.3;
    const g = (c1.g - c2.g) * 0.59;
    const b = (c1.b - c2.b) * 0.11;
    return Math.sqrt(r * r + g * g + b * b);
  }

  public rebuild(targetModel: VoxelData[]) {
    if (this.state === AppState.REBUILDING || this.mode === AppMode.BUILD) return;

    const available = this.voxels.map((v, i) => ({ index: i, color: v.color, taken: false }));
    const mappings: RebuildTarget[] = new Array(this.voxels.length).fill(null);

    targetModel.forEach(target => {
        let bestDist = 9999;
        let bestIdx = -1;

        for (let i = 0; i < available.length; i++) {
            if (available[i].taken) continue;
            const d = this.getColorDist(available[i].color, target.color);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
                if (d < 0.01) break;
            }
        }

        if (bestIdx !== -1) {
            available[bestIdx].taken = true;
            const h = Math.max(0, (target.y - CONFIG.FLOOR_Y) / 15);
            mappings[available[bestIdx].index] = {
                x: target.x, y: target.y, z: target.z,
                delay: h * 800
            };
        }
    });

    for (let i = 0; i < this.voxels.length; i++) {
        if (!mappings[i]) {
            mappings[i] = {
                x: this.voxels[i].x, y: this.voxels[i].y, z: this.voxels[i].z,
                isRubble: true, delay: 0
            };
        }
    }

    this.rebuildTargets = mappings;
    this.rebuildStartTime = Date.now();
    this.state = AppState.REBUILDING;
    this.onStateChange(this.state);
  }

  private updatePhysics() {
    if (this.state === AppState.DISMANTLING) {
        this.voxels.forEach(v => {
            v.vy -= 0.025;
            v.x += v.vx; v.y += v.vy; v.z += v.vz;
            v.rx += v.rvx; v.ry += v.rvy; v.rz += v.rvz;

            if (v.y < CONFIG.FLOOR_Y + 0.5) {
                v.y = CONFIG.FLOOR_Y + 0.5;
                v.vy *= -0.5; v.vx *= 0.9; v.vz *= 0.9;
                v.rvx *= 0.8; v.rvy *= 0.8; v.rvz *= 0.8;
            }
        });
    } else if (this.state === AppState.REBUILDING) {
        const now = Date.now();
        const elapsed = now - this.rebuildStartTime;
        let allDone = true;

        this.voxels.forEach((v, i) => {
            const t = this.rebuildTargets[i];
            if (t.isRubble) return;
            if (elapsed < t.delay) {
                allDone = false;
                return;
            }
            const speed = 0.12;
            v.x += (t.x - v.x) * speed;
            v.y += (t.y - v.y) * speed;
            v.z += (t.z - v.z) * speed;
            v.rx += (0 - v.rx) * speed;
            v.ry += (0 - v.ry) * speed;
            v.rz += (0 - v.rz) * speed;

            if ((t.x - v.x) ** 2 + (t.y - v.y) ** 2 + (t.z - v.z) ** 2 > 0.01) {
                allDone = false;
            } else {
                v.x = t.x; v.y = t.y; v.z = t.z;
                v.rx = 0; v.ry = 0; v.rz = 0;
            }
        });

        if (allDone) {
            this.state = AppState.STABLE;
            this.onStateChange(this.state);
        }
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.updatePhysics();
    
    if (this.state !== AppState.STABLE || this.controls.autoRotate || this.mode === AppMode.BUILD) {
        this.draw();
    }
    this.renderer.render(this.scene, this.camera);
  }

  public handleResize() {
      if (this.camera && this.renderer) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
  }
  
  public setAutoRotate(enabled: boolean) {
    if (this.controls) {
        this.controls.autoRotate = enabled;
    }
  }

  public getJsonData(): string {
      const data = this.voxels.map((v, i) => ({
          x: +v.x.toFixed(2),
          y: +v.y.toFixed(2),
          z: +v.z.toFixed(2),
          color: '#' + v.color.getHexString()
      }));
      return JSON.stringify(data, null, 2);
  }
  
  public getUniqueColors(): string[] {
    const colors = new Set<string>();
    this.voxels.forEach(v => {
        colors.add('#' + v.color.getHexString());
    });
    return Array.from(colors);
  }

  public cleanup() {
    cancelAnimationFrame(this.animationId);
    this.container.removeChild(this.renderer.domElement);
    this.renderer.dispose();
  }
}
