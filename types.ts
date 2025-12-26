
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';

export enum AppState {
  STABLE = 'STABLE',
  DISMANTLING = 'DISMANTLING',
  REBUILDING = 'REBUILDING'
}

export enum AppMode {
  VIEW = 'VIEW',
  BUILD = 'BUILD'
}

export type BuildTool = 'pencil' | 'eraser' | 'picker';

export enum VoxelMaterial {
  MATTE = 0,
  METAL = 1,
  GLOW = 2
}

export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: number;
  material?: VoxelMaterial;
}

export interface SimulationVoxel {
  id: number;
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  material: VoxelMaterial;
  // Physics state
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  rvx: number;
  rvy: number;
  rvz: number;
}

export interface RebuildTarget {
  x: number;
  y: number;
  z: number;
  material: VoxelMaterial;
  delay: number;
  isRubble?: boolean;
}

export interface SavedModel {
  name: string;
  data: VoxelData[];
  baseModel?: string;
  timestamp?: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}
