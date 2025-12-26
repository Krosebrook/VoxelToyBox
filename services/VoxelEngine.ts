
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { AppState, AppMode, SimulationVoxel, RebuildTarget, VoxelData, BuildTool, VoxelMaterial } from '../types';
import { CONFIG } from '../utils/voxelConstants';

export class VoxelEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  
  // Multiple meshes for different materials
  private meshes: Map<VoxelMaterial, THREE.InstancedMesh> = new Map();
  private dummy = new THREE.Object3D();
  
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private ghostVoxel: THREE.Mesh;
  
  // Target Highlight (Pulsing wireframe + inner glow)
  private targetHighlightGroup: THREE.Group;
  private targetHighlightWire: THREE.Mesh;
  private targetHighlightGlow: THREE.Mesh;
  
  private voxels: SimulationVoxel[] = [];
  
  // History Stack
  private undoStack: VoxelData[][] = [];
  private redoStack: VoxelData[][] = [];
  private maxHistory = 50;

  private rebuildTargets: RebuildTarget[] = [];
  private rebuildStartTime: number = 0;
  
  private state: AppState = AppState.STABLE;
  private mode: AppMode = AppMode.VIEW;
  private buildTool: BuildTool = 'pencil';
  private selectedColor: number = 0x3b82f6;
  private selectedMaterial: VoxelMaterial = VoxelMaterial.MATTE;

  private onStateChange: (state: AppState) => void;
  private onCountChange: (count: number) => void;
  private onColorPick: (color: number, material: VoxelMaterial) => void;
  private onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  private animationId: number = 0;

  constructor(
    container: HTMLElement, 
    onStateChange: (state: AppState) => void,
    onCountChange: (count: number) => void,
    onColorPick: (color: number, material: VoxelMaterial) => void,
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onCountChange = onCountChange;
    this.onColorPick = onColorPick;
    this.onHistoryChange = onHistoryChange;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BG_COLOR);
    this.scene.fog = new THREE.Fog(CONFIG.BG_COLOR, 80, 160);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(40, 40, 80);

    this.renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        preserveDrawingBuffer: true,
        alpha: true 
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.target.set(0, 5, 0);

    // Interaction Overlays
    const ghostGeo = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE + 0.02, CONFIG.VOXEL_SIZE + 0.02, CONFIG.VOXEL_SIZE + 0.02);
    const ghostMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.4,
        depthWrite: false
    });
    this.ghostVoxel = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostVoxel.visible = false;
    this.scene.add(this.ghostVoxel);

    // Enhanced Target Highlight
    this.targetHighlightGroup = new THREE.Group();
    
    const highlightGeo = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE + 0.08, CONFIG.VOXEL_SIZE + 0.08, CONFIG.VOXEL_SIZE + 0.08);
    const highlightWireMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    this.targetHighlightWire = new THREE.Mesh(highlightGeo, highlightWireMat);
    
    const highlightGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    });
    this.targetHighlightGlow = new THREE.Mesh(highlightGeo, highlightGlowMat);
    
    this.targetHighlightGroup.add(this.targetHighlightWire);
    this.targetHighlightGroup.add(this.targetHighlightGlow);
    this.targetHighlightGroup.visible = false;
    this.scene.add(this.targetHighlightGroup);

    // Environment
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(dirLight);

    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(200, 32), 
        new THREE.MeshStandardMaterial({ color: 0xdae1e7, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.FLOOR_Y;
    floor.receiveShadow = true;
    floor.name = "FLOOR";
    this.scene.add(floor);

    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));

    this.animate = this.animate.bind(this);
    this.animate();
  }

  // --- Snapshot ---
  public takeSnapshot(): string {
      const prevVisibleGhost = this.ghostVoxel.visible;
      const prevVisibleHighlight = this.targetHighlightGroup.visible;
      this.ghostVoxel.visible = false;
      this.targetHighlightGroup.visible = false;
      
      this.renderer.render(this.scene, this.camera);
      const dataUrl = this.renderer.domElement.toDataURL('image/png');
      
      this.ghostVoxel.visible = prevVisibleGhost;
      this.targetHighlightGroup.visible = prevVisibleHighlight;
      return dataUrl;
  }

  // --- History ---
  private pushHistory() {
    this.undoStack.push(this.getVoxelData());
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
    this.notifyHistory();
  }

  private notifyHistory() {
    this.onHistoryChange?.(this.undoStack.length > 0, this.redoStack.length > 0);
  }

  public undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(this.getVoxelData());
    this.loadSnapshot(this.undoStack.pop()!);
    this.notifyHistory();
  }

  public redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(this.getVoxelData());
    this.loadSnapshot(this.redoStack.pop()!);
    this.notifyHistory();
  }

  private loadSnapshot(data: VoxelData[]) {
    this.createVoxels(data);
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
  }

  // --- Configuration ---
  public setMode(mode: AppMode) {
      this.mode = mode;
      this.ghostVoxel.visible = false;
      this.targetHighlightGroup.visible = false;
  }

  public setTool(tool: BuildTool) {
      this.buildTool = tool;
  }

  public setBuildProps(hex: number, mat: VoxelMaterial) {
      this.selectedColor = hex;
      this.selectedMaterial = mat;
      (this.ghostVoxel.material as THREE.MeshStandardMaterial).color.setHex(hex);
  }

  private onMouseMove(event: MouseEvent) {
      if (this.mode !== AppMode.BUILD) return;

      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const interactiveObjects = Array.from(this.meshes.values());
      const floor = this.scene.getObjectByName("FLOOR")!;
      const intersects = this.raycaster.intersectObjects([...interactiveObjects, floor]);

      this.ghostVoxel.visible = false;
      this.targetHighlightGroup.visible = false;

      if (intersects.length > 0) {
          const intersect = intersects[0];
          const isVoxel = interactiveObjects.includes(intersect.object as any);
          
          if (this.buildTool === 'pencil') {
              if (isVoxel && intersect.instanceId !== undefined) {
                  this.targetHighlightGroup.visible = true;
                  const mesh = intersect.object as THREE.InstancedMesh;
                  mesh.getMatrixAt(intersect.instanceId, this.dummy.matrix);
                  this.targetHighlightGroup.position.setFromMatrixPosition(this.dummy.matrix);
                  
                  (this.targetHighlightWire.material as THREE.MeshBasicMaterial).color.set(0xffffff);
                  (this.targetHighlightGlow.material as THREE.MeshBasicMaterial).color.set(0xffffff);
              }
              this.ghostVoxel.visible = true;
              const pos = intersect.point.clone().add(intersect.face!.normal.clone().multiplyScalar(0.5));
              this.ghostVoxel.position.set(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z));
          } else if (this.buildTool === 'eraser' || this.buildTool === 'picker') {
              if (isVoxel && intersect.instanceId !== undefined) {
                  this.targetHighlightGroup.visible = true;
                  const mesh = intersect.object as THREE.InstancedMesh;
                  mesh.getMatrixAt(intersect.instanceId, this.dummy.matrix);
                  this.targetHighlightGroup.position.setFromMatrixPosition(this.dummy.matrix);
                  
                  const highlightColor = this.buildTool === 'eraser' ? 0xff4444 : 0x4ade80;
                  (this.targetHighlightWire.material as THREE.MeshBasicMaterial).color.set(highlightColor);
                  (this.targetHighlightGlow.material as THREE.MeshBasicMaterial).color.set(highlightColor);
              }
          }
      }
  }

  private onMouseDown(event: MouseEvent) {
      if (this.mode !== AppMode.BUILD || this.state !== AppState.STABLE) return;
      if (event.button !== 0) return;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const interactiveObjects = Array.from(this.meshes.values());
      const intersects = this.raycaster.intersectObjects([...interactiveObjects, this.scene.getObjectByName("FLOOR")!]);

      if (intersects.length > 0) {
          const intersect = intersects[0];

          if (this.buildTool === 'pencil') {
              const pos = intersect.point.clone().add(intersect.face!.normal.clone().multiplyScalar(0.5));
              this.addVoxel(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z), this.selectedColor, this.selectedMaterial);
          } else if (this.buildTool === 'eraser') {
              if (interactiveObjects.includes(intersect.object as any) && intersect.instanceId !== undefined) {
                  const mesh = intersect.object as THREE.InstancedMesh;
                  const materialType = Number(mesh.name) as VoxelMaterial;
                  this.removeVoxel(intersect.instanceId, materialType);
              }
          } else if (this.buildTool === 'picker') {
              if (interactiveObjects.includes(intersect.object as any) && intersect.instanceId !== undefined) {
                  const mesh = intersect.object as THREE.InstancedMesh;
                  const materialType = Number(mesh.name) as VoxelMaterial;
                  // Finding the actual voxel object for the color
                  const meshVoxels = this.voxels.filter(v => v.material === materialType);
                  const v = meshVoxels[intersect.instanceId];
                  this.onColorPick(v.color.getHex(), v.material);
              }
          }
      }
  }

  private addVoxel(x: number, y: number, z: number, color: number, material: VoxelMaterial) {
      if (this.voxels.some(v => v.x === x && v.y === y && v.z === z)) return;
      this.pushHistory();

      const newVoxel: SimulationVoxel = {
          id: this.voxels.length,
          x, y, z, color: new THREE.Color(color),
          material,
          vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, rvx: 0, rvy: 0, rvz: 0
      };

      this.voxels.push(newVoxel);
      this.rebuildInstanceMeshes();
      this.onCountChange(this.voxels.length);
  }

  private removeVoxel(instanceId: number, materialType: VoxelMaterial) {
      this.pushHistory();
      // Need to find the index in the global voxels array
      const meshVoxels = this.voxels.filter(v => v.material === materialType);
      const targetVoxel = meshVoxels[instanceId];
      const globalIndex = this.voxels.indexOf(targetVoxel);
      
      if (globalIndex !== -1) {
          this.voxels.splice(globalIndex, 1);
          this.rebuildInstanceMeshes();
          this.onCountChange(this.voxels.length);
      }
  }

  private rebuildInstanceMeshes() {
      this.createVoxels(this.getVoxelData());
  }

  public loadInitialModel(data: VoxelData[]) {
    this.undoStack = [];
    this.redoStack = [];
    this.createVoxels(data);
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
    this.notifyHistory();
  }

  private createVoxels(data: VoxelData[]) {
    // Clear old meshes
    this.meshes.forEach(m => {
        this.scene.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
    });
    this.meshes.clear();

    this.voxels = data.map((v, i) => ({
        id: i,
        x: v.x, y: v.y, z: v.z, 
        color: new THREE.Color(v.color),
        material: v.material ?? VoxelMaterial.MATTE,
        vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, rvx: 0, rvy: 0, rvz: 0
    }));

    // Grouping by material
    const groups = new Map<VoxelMaterial, SimulationVoxel[]>();
    this.voxels.forEach(v => {
        if (!groups.has(v.material)) groups.set(v.material, []);
        groups.get(v.material)!.push(v);
    });

    const geometry = new THREE.BoxGeometry(CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05, CONFIG.VOXEL_SIZE - 0.05);

    groups.forEach((voxels, type) => {
        let material: THREE.Material;
        if (type === VoxelMaterial.METAL) {
            material = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 1.0 });
        } else if (type === VoxelMaterial.GLOW) {
            // Use basic for "flat" glow, or standard with emissive
            material = new THREE.MeshStandardMaterial({ 
                roughness: 0.5, 
                emissive: 0xffffff,
                emissiveIntensity: 1.0
            });
        } else {
            material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
        }

        const mesh = new THREE.InstancedMesh(geometry, material, voxels.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = type.toString();
        this.scene.add(mesh);
        this.meshes.set(type, mesh);
    });

    this.draw();
  }

  private draw() {
    const groups = new Map<VoxelMaterial, SimulationVoxel[]>();
    this.voxels.forEach(v => {
        if (!groups.has(v.material)) groups.set(v.material, []);
        groups.get(v.material)!.push(v);
    });

    groups.forEach((voxels, type) => {
        const mesh = this.meshes.get(type);
        if (!mesh) return;

        voxels.forEach((v, i) => {
            this.dummy.position.set(v.x, v.y, v.z);
            this.dummy.rotation.set(v.rx, v.ry, v.rz);
            this.dummy.updateMatrix();
            mesh.setMatrixAt(i, this.dummy.matrix);
            mesh.setColorAt(i, v.color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
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

  public rebuild(targetModel: VoxelData[]) {
    if (this.state === AppState.REBUILDING || this.mode === AppMode.BUILD) return;
    this.pushHistory();

    const available = this.voxels.map((v, i) => ({ index: i, color: v.color, mat: v.material, taken: false }));
    const mappings: RebuildTarget[] = new Array(this.voxels.length).fill(null);

    targetModel.forEach(target => {
        let bestDist = 9999;
        let bestIdx = -1;

        for (let i = 0; i < available.length; i++) {
            if (available[i].taken) continue;
            // Weigh color distance and material similarity
            const c2 = new THREE.Color(target.color);
            const colorDist = available[i].color.distanceTo(c2);
            const matDist = available[i].mat === target.material ? 0 : 0.5;
            const dist = colorDist + matDist;

            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }

        if (bestIdx !== -1) {
            available[bestIdx].taken = true;
            const h = Math.max(0, (target.y - CONFIG.FLOOR_Y) / 15);
            mappings[available[bestIdx].index] = {
                x: target.x, y: target.y, z: target.z,
                material: target.material ?? VoxelMaterial.MATTE,
                delay: h * 800
            };
        }
    });

    for (let i = 0; i < this.voxels.length; i++) {
        if (!mappings[i]) {
            mappings[i] = {
                x: this.voxels[i].x, y: this.voxels[i].y, z: this.voxels[i].z,
                material: this.voxels[i].material,
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
            
            // Material swap happens at start of rebuild movement
            v.material = t.material;

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
            this.rebuildInstanceMeshes(); // Final pass to ensure instances are correctly grouped
        }
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.updatePhysics();
    
    // Pulse animation for target highlight
    if (this.targetHighlightGroup.visible) {
        const time = performance.now() * 0.005;
        const pulse = 1.0 + Math.sin(time) * 0.03;
        this.targetHighlightGroup.scale.set(pulse, pulse, pulse);
        
        const opacity = 0.4 + Math.sin(time * 2) * 0.2;
        (this.targetHighlightWire.material as THREE.MeshBasicMaterial).opacity = opacity;
        (this.targetHighlightGlow.material as THREE.MeshBasicMaterial).opacity = opacity * 0.2;
    }
    
    this.draw();
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
    if (this.controls) this.controls.autoRotate = enabled;
  }

  public getVoxelData(): VoxelData[] {
      return this.voxels.map((v) => ({
          x: +v.x.toFixed(2),
          y: +v.y.toFixed(2),
          z: +v.z.toFixed(2),
          color: v.color.getHex(),
          material: v.material
      }));
  }

  public getJsonData(): string {
      const data = this.getVoxelData().map(v => ({
          ...v,
          color: '#' + v.color.toString(16).padStart(6, '0')
      }));
      return JSON.stringify(data, null, 2);
  }
  
  public getUniqueColors(): string[] {
    const colors = new Set<string>();
    this.voxels.forEach(v => colors.add('#' + v.color.getHexString()));
    return Array.from(colors);
  }

  public cleanup() {
    cancelAnimationFrame(this.animationId);
    this.container.removeChild(this.renderer.domElement);
    this.renderer.dispose();
  }
}
