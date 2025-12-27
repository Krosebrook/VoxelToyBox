
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/** Standard color palette for presets. */
export const COLORS = {
  DARK: 0x4A3728,
  LIGHT: 0x654321,
  WHITE: 0xF0F0F0,
  GOLD: 0xFFD700,
  BLACK: 0x111111,
  WOOD: 0x3B2F2F,
  GREEN: 0x228B22,
  TALON: 0xE5C100,
};

/** Global engine configuration. */
export const CONFIG = {
  /** Distance between voxel centers (Mesh size relative to the unit grid). */
  VOXEL_SIZE: 0.9,
  /** The Y-coordinate of the ground plane. */
  FLOOR_Y: -12,
  /** Background clear color for the WebGL context. */
  BG_COLOR: 0xf0f2f5,
  /** Maximum number of voxels allowed in the scene for performance stability. */
  MAX_VOXELS: 1500,
  /** Physics gravity constant. */
  GRAVITY: 0.025,
  /** Physics friction/damping constant. */
  DAMPING: 0.9,
  /** Interpolation speed for rebuilding transitions. */
  MORPH_SPEED: 0.12
};
