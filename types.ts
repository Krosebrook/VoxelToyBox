
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';

/** Represents the global state of the voxel world animation and physics. */
export enum AppState {
  /** No active physics or transitions. Voxels are at their target positions. */
  STABLE = 'STABLE',
  /** Voxels are falling and bouncing under physics simulation. */
  DISMANTLING = 'DISMANTLING',
  /** Voxels are lerping towards a new target model structure. */
  REBUILDING = 'REBUILDING'
}

/** Determines if the user is currently manipulating the scene or just observing. */
export enum AppMode {
  /** Navigation and visualization focus. */
  VIEW = 'VIEW',
  /** Tool-based manipulation (pencil, eraser, picker, paint bucket). */
  BUILD = 'BUILD'
}

/** Available building interaction types. */
export type BuildTool = 'pencil' | 'eraser' | 'picker' | 'select' | 'paintBucket';

/** Surface properties for voxel rendering groups. */
export enum VoxelMaterial {
  /** Default matte finish with high roughness. */
  MATTE = 0,
  /** Reflective surface with low roughness. */
  METAL = 1,
  /** Self-illuminated surface. */
  GLOW = 2
}

/** Basic structural data for a single voxel point. */
export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: number;
  material?: VoxelMaterial;
}

/** User-saved color entry with a name and hex value. */
export interface CustomColor {
  name: string;
  hex: number;
}

/** Extended data used within the VoxelEngine for physics and rendering. */
export interface SimulationVoxel {
  id: number;
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  material: VoxelMaterial;
  // Physics: Velocity
  vx: number;
  vy: number;
  vz: number;
  // Physics: Rotation
  rx: number;
  ry: number;
  rz: number;
  // Physics: Angular Velocity
  rvx: number;
  rvy: number;
  rvz: number;
}

/** Interpolation target data for morphing transitions. */
export interface RebuildTarget {
  x: number;
  y: number;
  z: number;
  material: VoxelMaterial;
  delay: number;
  isRubble?: boolean;
}

/** Persistent data structure for a named build. */
export interface SavedModel {
  name: string;
  data: VoxelData[];
  baseModel?: string;
  timestamp?: number;
}

/** Source metadata from search grounding. */
export interface GroundingSource {
  title: string;
  uri: string;
}
