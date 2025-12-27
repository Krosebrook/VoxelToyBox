
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { AppState, AppMode, SimulationVoxel, RebuildTarget, VoxelData, BuildTool, VoxelMaterial } from '../types';
import { CONFIG } from '../utils/voxelConstants';

/**
 * VoxelEngine handles the heavy lifting of 3D rendering, physics simulation,
 * and user interactions using Three.js and InstancedMeshes.
 */
export class VoxelEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  
  private meshes: Map<VoxelMaterial, THREE.InstancedMesh> = new Map();
  private dummy = new THREE.Object3D();
  
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  private ghostVoxel: THREE.Mesh;
  private targetHighlightGroup: THREE.Group;
  private targetHighlightWire: THREE.Mesh;
  private targetHighlightGlow: THREE.Mesh;

  // Selection Box (Drag)
  private selectionMesh: THREE.Mesh;
  private selectionStartPoint: THREE.Vector3 | null = null;
  private isSelecting: boolean = false;
  private selectedVoxelIds: Set<number> = new Set();
  
  // Persistent selection outline (Multiple voxels)
  private persistentSelectionOutline: THREE.InstancedMesh | null = null;
  
  private voxelSize: number = CONFIG.VOXEL_SIZE;
  private voxels: SimulationVoxel[] = [];
  
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
  private isMirrorMode: boolean = false;

  private onStateChange: (state: AppState) => void;
  private onCountChange: (count: number) => void;
  private onColorPick: (color: number, material: VoxelMaterial) => void;
  private onSelectionChange?: (count: number) => void;
  private onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  private animationId: number = 0;

  constructor(
    container: HTMLElement, 
    onStateChange: (state: AppState) => void,
    onCountChange: (count: number) => void,
    onColorPick: (color: number, material: VoxelMaterial) => void,
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void,
    onSelectionChange?: (count: number) => void
  ) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.onCountChange = onCountChange;
    this.onColorPick = onColorPick;
    this.onHistoryChange = onHistoryChange;
    this.onSelectionChange = onSelectionChange;

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

    this.initOverlays();
    this.initLighting();
    this.initEnvironment();

    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));

    this.animate = this.animate.bind(this);
    this.animate();
  }

  private initOverlays() {
    const ghostGeo = new THREE.BoxGeometry(1, 1, 1);
    const ghostMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false
    });
    this.ghostVoxel = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostVoxel.visible = false;
    this.scene.add(this.ghostVoxel);

    this.targetHighlightGroup = new THREE.Group();
    const highlightGeo = new THREE.BoxGeometry(1.08, 1.08, 1.08);
    this.targetHighlightWire = new THREE.Mesh(highlightGeo, new THREE.MeshBasicMaterial({ 
      color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8
    }));
    this.targetHighlightGlow = new THREE.Mesh(highlightGeo, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false
    }));
    this.targetHighlightGroup.add(this.targetHighlightWire, this.targetHighlightGlow);
    this.targetHighlightGroup.visible = false;
    this.scene.add(this.targetHighlightGroup);

    // Selection Box Overlay (Drag)
    const selectionGeo = new THREE.BoxGeometry(1, 1, 1);
    const selectionMat = new THREE.MeshBasicMaterial({ 
        color: 0x4f46e5, transparent: true, opacity: 0.2, side: THREE.DoubleSide 
    });
    this.selectionMesh = new THREE.Mesh(selectionGeo, selectionMat);
    this.selectionMesh.visible = false;
    this.scene.add(this.selectionMesh);
    
    this.updateOverlayScales();
  }

  private updateOverlayScales() {
    const scale = this.voxelSize;
    this.ghostVoxel.scale.set(scale, scale, scale);
    this.targetHighlightGroup.scale.set(scale, scale, scale);
  }

  private initLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(60, 100, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(dirLight);
  }

  private initEnvironment() {
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(200, 32), 
        new THREE.MeshStandardMaterial({ color: 0xdae1e7, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = CONFIG.FLOOR_Y;
    floor.receiveShadow = true;
    floor.name = "FLOOR";
    this.scene.add(floor);
  }

  public takeSnapshot(): string {
      const prevG = this.ghostVoxel.visible;
      const prevH = this.targetHighlightGroup.visible;
      this.ghostVoxel.visible = false;
      this.targetHighlightGroup.visible = false;
      this.renderer.render(this.scene, this.camera);
      const dataUrl = this.renderer.domElement.toDataURL('image/png');
      this.ghostVoxel.visible = prevG;
      this.targetHighlightGroup.visible = prevH;
      return dataUrl;
  }

  // --- Group Manipulation Methods ---

  public deleteSelected() {
    if (this.selectedVoxelIds.size === 0) return;
    this.pushHistory();
    this.voxels = this.voxels.filter(v => !this.selectedVoxelIds.has(v.id));
    this.clearSelection();
    this.rebuildInstanceMeshes();
    this.onCountChange(this.voxels.length);
  }

  public copySelected() {
    if (this.selectedVoxelIds.size === 0) return;
    this.pushHistory();
    const selected = this.voxels.filter(v => this.selectedVoxelIds.has(v.id));
    const copies = selected.map(v => ({
        ...v,
        id: Date.now() + Math.random(),
        x: v.x + 1 // Offset to show it was copied
    }));
    this.voxels.push(...copies);
    this.rebuildInstanceMeshes();
    this.onCountChange(this.voxels.length);
  }

  public moveSelected(axis: 'x' | 'y' | 'z', dir: number) {
    if (this.selectedVoxelIds.size === 0) return;
    this.pushHistory();
    this.voxels.forEach(v => {
        if (this.selectedVoxelIds.has(v.id)) {
            v[axis] += dir;
        }
    });
    this.rebuildInstanceMeshes();
  }

  public clearSelection() {
    this.selectedVoxelIds.clear();
    this.onSelectionChange?.(0);
    this.rebuildInstanceMeshes();
  }

  // --- Interaction Logic ---

  public setMode(mode: AppMode) {
      this.mode = mode;
      this.ghostVoxel.visible = false;
      this.targetHighlightGroup.visible = false;
      if (mode !== AppMode.BUILD) this.clearSelection();
  }

  public setTool(tool: BuildTool) {
      this.buildTool = tool;
      this.clearSelection();
  }

  public setMirrorMode(enabled: boolean) {
    this.isMirrorMode = enabled;
  }

  private onMouseMove(event: MouseEvent) {
      if (this.mode !== AppMode.BUILD) return;
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.isSelecting && this.selectionStartPoint) {
          const floor = this.scene.getObjectByName("FLOOR")!;
          const intersects = this.raycaster.intersectObject(floor);
          if (intersects.length > 0) {
              const currentPoint = intersects[0].point;
              this.updateSelectionBox(this.selectionStartPoint, currentPoint);
          }
          return;
      }

      const interactiveObjects = Array.from(this.meshes.values());
      const floor = this.scene.getObjectByName("FLOOR")!;
      const intersects = this.raycaster.intersectObjects([...interactiveObjects, floor]);

      this.ghostVoxel.visible = false;
      this.targetHighlightGroup.visible = false;

      if (intersects.length > 0) {
          const intersect = intersects[0];
          const isVoxel = interactiveObjects.includes(intersect.object as any);
          if (this.buildTool === 'pencil') {
              const pos = intersect.point.clone().add(intersect.face!.normal.clone().multiplyScalar(0.5));
              this.ghostVoxel.visible = true;
              this.ghostVoxel.position.set(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z));
          } else if ((this.buildTool === 'eraser' || this.buildTool === 'picker' || this.buildTool === 'paintBucket') && isVoxel) {
              this.updateHighlight(intersect.object as THREE.InstancedMesh, intersect.instanceId!, 0xffffff);
          }
      }
  }

  private updateSelectionBox(start: THREE.Vector3, end: THREE.Vector3) {
      this.selectionMesh.visible = true;
      const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const size = new THREE.Vector3(
          Math.abs(start.x - end.x) || 0.1,
          10, // Height is fixed for floor-based dragging or can be relative
          Math.abs(start.z - end.z) || 0.1
      );
      this.selectionMesh.position.copy(center);
      this.selectionMesh.scale.copy(size);
  }

  private onMouseDown(event: MouseEvent) {
      if (this.mode !== AppMode.BUILD || this.state !== AppState.STABLE) return;
      if (event.button !== 0) return;

      if (this.buildTool === 'select') {
          const floor = this.scene.getObjectByName("FLOOR")!;
          const intersects = this.raycaster.intersectObject(floor);
          if (intersects.length > 0) {
              this.selectionStartPoint = intersects[0].point.clone();
              this.isSelecting = true;
              this.controls.enabled = false;
              this.clearSelection();
          }
          return;
      }

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const interactiveObjects = Array.from(this.meshes.values());
      const intersects = this.raycaster.intersectObjects([...interactiveObjects, this.scene.getObjectByName("FLOOR")!]);

      if (intersects.length > 0) {
          const intersect = intersects[0];
          const isVoxel = interactiveObjects.includes(intersect.object as any);
          if (this.buildTool === 'pencil') {
              const pos = intersect.point.clone().add(intersect.face!.normal.clone().multiplyScalar(0.5));
              this.addVoxel(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z), this.selectedColor, this.selectedMaterial);
          } else if (this.buildTool === 'eraser' && isVoxel) {
              this.removeVoxel(intersect.instanceId!, Number(intersect.object.name));
          } else if (this.buildTool === 'picker' && isVoxel) {
              const meshVoxels = this.voxels.filter(v => v.material === Number(intersect.object.name));
              const v = meshVoxels[intersect.instanceId!];
              this.onColorPick(v.color.getHex(), v.material);
          } else if (this.buildTool === 'paintBucket' && isVoxel) {
              const meshVoxels = this.voxels.filter(v => v.material === Number(intersect.object.name));
              const v = meshVoxels[intersect.instanceId!];
              this.paintFill(v.x, v.y, v.z, this.selectedColor, this.selectedMaterial);
          }
      }
  }

  private paintFill(startX: number, startY: number, startZ: number, fillHex: number, fillMat: VoxelMaterial) {
    const startVoxel = this.voxels.find(v => v.x === startX && v.y === startY && v.z === startZ);
    if (!startVoxel) return;

    const targetHex = startVoxel.color.getHex();
    const targetMat = startVoxel.material;

    // If already the same, skip
    if (targetHex === fillHex && targetMat === fillMat) return;

    this.pushHistory();

    const queue: [number, number, number][] = [[startX, startY, startZ]];
    const visited = new Set<string>();
    visited.add(`${startX},${startY},${startZ}`);

    // Map for fast spatial lookup
    const voxelMap = new Map<string, SimulationVoxel>();
    this.voxels.forEach(v => voxelMap.set(`${v.x},${v.y},${v.z}`, v));

    let affected = 0;
    while (queue.length > 0) {
      const [x, y, z] = queue.shift()!;
      const key = `${x},${y},${z}`;
      const v = voxelMap.get(key);

      if (v && v.color.getHex() === targetHex && v.material === targetMat) {
        v.color.setHex(fillHex);
        v.material = fillMat;
        affected++;

        // Neighbors (6-connectivity)
        const neighbors = [
          [x + 1, y, z], [x - 1, y, z],
          [x, y + 1, z], [x, y - 1, z],
          [x, y, z + 1], [x, y, z - 1]
        ];

        for (const [nx, ny, nz] of neighbors) {
          const nkey = `${nx},${ny},${nz}`;
          if (!visited.has(nkey) && voxelMap.has(nkey)) {
            visited.add(nkey);
            queue.push([nx, ny, nz]);
          }
        }
      }
    }

    if (affected > 0) {
      this.rebuildInstanceMeshes();
    }
  }

  private onMouseUp() {
      if (this.isSelecting) {
          this.isSelecting = false;
          this.selectionMesh.visible = false;
          this.controls.enabled = true;
          this.finishSelection();
      }
  }

  private finishSelection() {
      const box = new THREE.Box3().setFromObject(this.selectionMesh);
      this.selectedVoxelIds.clear();
      this.voxels.forEach(v => {
          if (box.containsPoint(new THREE.Vector3(v.x, v.y, v.z))) {
              this.selectedVoxelIds.add(v.id);
          }
      });
      this.onSelectionChange?.(this.selectedVoxelIds.size);
      this.rebuildInstanceMeshes();
  }

  private rebuildInstanceMeshes() {
      this.createVoxels(this.getVoxelData());
  }

  private createVoxels(data: VoxelData[]) {
    this.meshes.forEach(m => { this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
    this.meshes.clear();

    if (this.persistentSelectionOutline) {
        this.scene.remove(this.persistentSelectionOutline);
        this.persistentSelectionOutline.geometry.dispose();
        (this.persistentSelectionOutline.material as THREE.Material).dispose();
        this.persistentSelectionOutline = null;
    }

    const groups = new Map<VoxelMaterial, SimulationVoxel[]>();
    this.voxels.forEach(v => {
        if (!groups.has(v.material)) groups.set(v.material, []);
        groups.get(v.material)!.push(v);
    });

    const geometry = new THREE.BoxGeometry(this.voxelSize - 0.05, this.voxelSize - 0.05, this.voxelSize - 0.05);
    groups.forEach((voxels, type) => {
        const material = this.getMaterialByType(type);
        const mesh = new THREE.InstancedMesh(geometry, material, voxels.length);
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = type.toString();
        this.scene.add(mesh);
        this.meshes.set(type, mesh);
    });

    // Create persistent selection outline mesh (Wireframe overlay for all selected)
    if (this.voxels.length > 0) {
        const outlineGeo = new THREE.BoxGeometry(this.voxelSize + 0.02, this.voxelSize + 0.02, this.voxelSize + 0.02);
        const outlineMat = new THREE.MeshBasicMaterial({ 
            color: 0x4f46e5, 
            wireframe: true, 
            transparent: true, 
            opacity: 0.6, 
            depthWrite: false 
        });
        this.persistentSelectionOutline = new THREE.InstancedMesh(outlineGeo, outlineMat, this.voxels.length);
        this.persistentSelectionOutline.visible = true;
        this.scene.add(this.persistentSelectionOutline);
    }

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
            this.dummy.scale.set(1, 1, 1);
            this.dummy.updateMatrix();
            mesh.setMatrixAt(i, this.dummy.matrix);
            
            // Highlight selected voxels by color
            const isSelected = this.selectedVoxelIds.has(v.id);
            if (isSelected) {
                mesh.setColorAt(i, new THREE.Color(0xfacc15)); // Gold
            } else {
                mesh.setColorAt(i, v.color);
            }
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    // Draw the persistent wireframe overlay
    if (this.persistentSelectionOutline) {
        this.voxels.forEach((v, i) => {
            const isSelected = this.selectedVoxelIds.has(v.id);
            this.dummy.position.set(v.x, v.y, v.z);
            this.dummy.rotation.set(v.rx, v.ry, v.rz);
            
            if (isSelected) {
                // Pulse size slightly for visual flair
                const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.02;
                this.dummy.scale.set(pulse, pulse, pulse);
            } else {
                // Effectively hide non-selected ones
                this.dummy.scale.set(0, 0, 0);
            }
            
            this.dummy.updateMatrix();
            this.persistentSelectionOutline!.setMatrixAt(i, this.dummy.matrix);
        });
        this.persistentSelectionOutline.instanceMatrix.needsUpdate = true;
    }
  }

  private getMaterialByType(type: VoxelMaterial): THREE.Material {
      switch (type) {
          case VoxelMaterial.METAL: return new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 1.0 });
          case VoxelMaterial.GLOW: return new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 1.5 });
          default: return new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });
      }
  }

  // --- Boilerplate & History ---

  private pushHistory() {
    this.undoStack.push(this.getVoxelData());
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack = [];
    this.notifyHistory();
  }

  private notifyHistory() { this.onHistoryChange?.(this.undoStack.length > 0, this.redoStack.length > 0); }

  public undo() { if (this.undoStack.length === 0) return; this.redoStack.push(this.getVoxelData()); this.loadSnapshot(this.undoStack.pop()!); }
  public redo() { if (this.redoStack.length === 0) return; this.undoStack.push(this.getVoxelData()); this.loadSnapshot(this.redoStack.pop()!); }

  private loadSnapshot(data: VoxelData[]) {
    this.voxels = data.map((v, i) => ({
        id: i, x: v.x, y: v.y, z: v.z, color: new THREE.Color(v.color), material: v.material ?? 0,
        vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, rvx: 0, rvy: 0, rvz: 0
    }));
    this.rebuildInstanceMeshes();
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE;
    this.onStateChange(this.state);
    this.notifyHistory();
  }

  private updateHighlight(mesh: THREE.InstancedMesh, id: number, color: number) {
      this.targetHighlightGroup.visible = true;
      mesh.getMatrixAt(id, this.dummy.matrix);
      this.targetHighlightGroup.position.setFromMatrixPosition(this.dummy.matrix);
      (this.targetHighlightWire.material as THREE.MeshBasicMaterial).color.set(color);
  }

  private addVoxel(x: number, y: number, z: number, color: number, material: VoxelMaterial) {
      if (this.voxels.length >= CONFIG.MAX_VOXELS) return;
      if (this.voxels.some(v => v.x === x && v.y === y && v.z === z)) return;
      this.pushHistory();
      
      const addOne = (vx: number, vy: number, vz: number) => {
        if (this.voxels.some(v => v.x === vx && v.y === vy && v.z === vz)) return;
        this.voxels.push({ 
          id: Date.now() + Math.random(), 
          x: vx, y: vy, z: vz, 
          color: new THREE.Color(color), 
          material, 
          vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, rvx: 0, rvy: 0, rvz: 0 
        });
      };

      addOne(x, y, z);
      if (this.isMirrorMode) {
        addOne(-x, y, z);
      }

      this.rebuildInstanceMeshes();
      this.onCountChange(this.voxels.length);
  }

  private removeVoxel(instanceId: number, materialType: VoxelMaterial) {
      this.pushHistory();
      const meshVoxels = this.voxels.filter(v => v.material === materialType);
      const target = meshVoxels[instanceId];
      if (!target) return;

      const deleteAt = (vx: number, vy: number, vz: number) => {
        const idx = this.voxels.findIndex(v => v.x === vx && v.y === vy && v.z === vz);
        if (idx !== -1) {
          this.voxels.splice(idx, 1);
        }
      };

      const tx = target.x;
      const ty = target.y;
      const tz = target.z;

      deleteAt(tx, ty, tz);
      if (this.isMirrorMode) {
        deleteAt(-tx, ty, tz);
      }

      this.rebuildInstanceMeshes();
      this.onCountChange(this.voxels.length);
  }

  public loadInitialModel(data: VoxelData[]) {
    this.undoStack = []; this.redoStack = [];
    this.voxels = data.map((v, i) => ({ id: i, x: v.x, y: v.y, z: v.z, color: new THREE.Color(v.color), material: v.material ?? 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, rvx: 0, rvy: 0, rvz: 0 }));
    this.rebuildInstanceMeshes();
    this.onCountChange(this.voxels.length);
    this.state = AppState.STABLE; this.onStateChange(this.state);
    this.notifyHistory();
  }

  public dismantle() {
    if (this.state !== AppState.STABLE || this.mode === AppMode.BUILD) return;
    this.state = AppState.DISMANTLING;
    this.onStateChange(this.state);
    this.voxels.forEach(v => { v.vx = (Math.random() - 0.5) * 0.9; v.vy = Math.random() * 0.7; v.vz = (Math.random() - 0.5) * 0.9; v.rvx = (Math.random() - 0.5) * 0.3; v.rvy = (Math.random() - 0.5) * 0.3; v.rvz = (Math.random() - 0.5) * 0.3; });
  }

  public rebuild(targetModel: VoxelData[]) {
    if (this.state === AppState.REBUILDING || this.mode === AppMode.BUILD) return;
    this.pushHistory();
    const sourceVoxels = [...this.voxels];
    const targetVoxels = [...targetModel];
    if (sourceVoxels.length === 0) sourceVoxels.push({ id: -1, x: 0, y: CONFIG.FLOOR_Y + 5, z: 0, color: new THREE.Color(0xffffff), material: VoxelMaterial.MATTE, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, rvx: 0, rvy: 0, rvz: 0 });
    while (sourceVoxels.length < targetVoxels.length) { const idx = Math.floor(Math.random() * sourceVoxels.length); sourceVoxels.push({ ...sourceVoxels[idx], id: Date.now() + Math.random() }); }
    this.voxels = sourceVoxels;
    this.rebuildInstanceMeshes();
    const available = this.voxels.map((v, i) => ({ index: i, color: v.color, mat: v.material, taken: false }));
    const mappings: RebuildTarget[] = new Array(this.voxels.length).fill(null);
    targetVoxels.forEach(target => {
        let bestScore = 9999; let bestIdx = -1;
        for (let i = 0; i < available.length; i++) {
            if (available[i].taken) continue;
            const targetColor = new THREE.Color(target.color);
            const score = Math.sqrt(Math.pow(available[i].color.r - targetColor.r, 2) + Math.pow(available[i].color.g - targetColor.g, 2) + Math.pow(available[i].color.b - targetColor.b, 2)) + (available[i].mat === target.material ? 0 : 0.4);
            if (score < bestScore) { bestScore = score; bestIdx = i; }
        }
        if (bestIdx !== -1) { available[bestIdx].taken = true; const h = Math.max(0, (target.y - CONFIG.FLOOR_Y) / 15); mappings[available[bestIdx].index] = { x: target.x, y: target.y, z: target.z, material: target.material ?? VoxelMaterial.MATTE, delay: h * 600 }; }
    });
    for (let i = 0; i < this.voxels.length; i++) if (!mappings[i]) mappings[i] = { x: this.voxels[i].x, y: this.voxels[i].y, z: this.voxels[i].z, material: this.voxels[i].material, isRubble: true, delay: 0 };
    this.rebuildTargets = mappings; this.rebuildStartTime = Date.now();
    this.state = AppState.REBUILDING; this.onStateChange(this.state);
  }

  private updatePhysics() {
    if (this.state === AppState.DISMANTLING) {
        this.voxels.forEach(v => {
            v.vy -= CONFIG.GRAVITY; v.x += v.vx; v.y += v.vy; v.z += v.vz; v.rx += v.rvx; v.ry += v.rvy; v.rz += v.rvz;
            if (v.y < CONFIG.FLOOR_Y + 0.5) { v.y = CONFIG.FLOOR_Y + 0.5; v.vy *= -0.55; v.vx *= CONFIG.DAMPING; v.vz *= CONFIG.DAMPING; }
        });
    } else if (this.state === AppState.REBUILDING) {
        const elapsed = Date.now() - this.rebuildStartTime; let allDone = true;
        this.voxels.forEach((v, i) => {
            const t = this.rebuildTargets[i]; if (!t) return;
            if (t.isRubble) { v.vy -= CONFIG.GRAVITY; v.y += v.vy; if (v.y < CONFIG.FLOOR_Y + 0.5) { v.y = CONFIG.FLOOR_Y + 0.5; v.vy = 0; } return; }
            if (elapsed < t.delay) { allDone = false; return; }
            v.x += (t.x - v.x) * CONFIG.MORPH_SPEED; v.y += (t.y - v.y) * CONFIG.MORPH_SPEED; v.z += (t.z - v.z) * CONFIG.MORPH_SPEED;
            if (Math.abs(t.x - v.x) + Math.abs(t.y - v.y) + Math.abs(t.z - v.z) > 0.02) allDone = false;
            else { v.x = t.x; v.y = t.y; v.z = t.z; v.rx = v.ry = v.rz = 0; }
        });
        if (allDone) { this.state = AppState.STABLE; this.onStateChange(this.state); this.onCountChange(this.voxels.length); }
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    if (this.state !== AppState.STABLE) this.updatePhysics();
    this.draw();
    this.renderer.render(this.scene, this.camera);
  }

  public handleResize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(window.innerWidth, window.innerHeight); }
  public setAutoRotate(enabled: boolean) { this.controls.autoRotate = enabled; }
  public getVoxelData(): VoxelData[] { return this.voxels.map(v => ({ x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2), color: v.color.getHex(), material: v.material })); }
  public getJsonData(): string { return JSON.stringify(this.getVoxelData().map(v => ({ ...v, color: '#' + v.color.toString(16).padStart(6, '0') })), null, 2); }
  public setBuildProps(hex: number, mat: VoxelMaterial) { this.selectedColor = hex; this.selectedMaterial = mat; (this.ghostVoxel.material as THREE.MeshStandardMaterial).color.setHex(hex); }
  public setVoxelSize(size: number) { this.voxelSize = size; this.updateOverlayScales(); this.rebuildInstanceMeshes(); }
  public cleanup() { cancelAnimationFrame(this.animationId); this.container.removeChild(this.renderer.domElement); this.renderer.dispose(); }
}
