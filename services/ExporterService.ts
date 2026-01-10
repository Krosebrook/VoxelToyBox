
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { VoxelData } from '../types';
import { CONFIG } from '../utils/voxelConstants';

export class ExporterService {
  /**
   * Generates an OBJ file string with hidden face removal (occlusion culling).
   * Creates 8 vertices per visible voxel to ensure safe topology.
   */
  static generateOBJ(voxels: VoxelData[]): string {
    const voxelMap = new Map<string, VoxelData>();
    voxels.forEach(v => voxelMap.set(`${v.x},${v.y},${v.z}`, v));

    let objOutput = `# Voxel Toy Box Export\n# Objects: ${voxels.length}\n`;
    let vertexCount = 1; // OBJ indices are 1-based

    // Standard cube corners relative to center
    // Format: [x, y, z]
    const size = CONFIG.VOXEL_SIZE / 2; // Half-size for offsets
    const corners = [
      [-1, -1, 1],  // 0: left bottom front
      [1, -1, 1],   // 1: right bottom front
      [-1, 1, 1],   // 2: left top front
      [1, 1, 1],    // 3: right top front
      [-1, -1, -1], // 4: left bottom back
      [1, -1, -1],  // 5: right bottom back
      [-1, 1, -1],  // 6: left top back
      [1, 1, -1]    // 7: right top back
    ];

    // Faces defined by corner indices [v1, v2, v3, v4] and neighbor direction [x, y, z]
    // Follows counter-clockwise winding order for OBJ
    const faces = [
      { dir: [0, 0, 1], indices: [0, 1, 3, 2] },    // Front
      { dir: [0, 0, -1], indices: [5, 4, 6, 7] },   // Back
      { dir: [0, 1, 0], indices: [2, 3, 7, 6] },    // Top
      { dir: [0, -1, 0], indices: [4, 5, 1, 0] },   // Bottom
      { dir: [1, 0, 0], indices: [1, 5, 7, 3] },    // Right
      { dir: [-1, 0, 0], indices: [4, 0, 2, 6] }    // Left
    ];

    objOutput += `mtllib model.mtl\n`;

    voxels.forEach(v => {
      // Check for visible faces (occlusion culling)
      const visibleFaces = faces.filter(face => 
        !voxelMap.has(`${v.x + face.dir[0]},${v.y + face.dir[1]},${v.z + face.dir[2]}`)
      );

      if (visibleFaces.length === 0) return; // Skip hidden voxels

      // Write vertices for this voxel
      corners.forEach(c => {
         objOutput += `v ${(v.x * CONFIG.VOXEL_SIZE) + (c[0] * size)} ${(v.y * CONFIG.VOXEL_SIZE) + (c[1] * size)} ${(v.z * CONFIG.VOXEL_SIZE) + (c[2] * size)}\n`;
      });

      // Use material for color
      objOutput += `usemtl mat_${v.color.toString(16)}\n`;

      // Write faces
      visibleFaces.forEach(f => {
        const i = f.indices.map(idx => vertexCount + idx);
        objOutput += `f ${i[0]} ${i[1]} ${i[2]} ${i[3]}\n`;
      });

      vertexCount += 8;
    });

    return objOutput;
  }

  /**
   * Generates a Material Library (MTL) string for the unique colors in the voxel set.
   */
  static generateMTL(voxels: VoxelData[]): string {
    const colors = new Set<number>(voxels.map(v => v.color));
    let mtl = "# Voxel Toy Box Materials\n";
    
    colors.forEach(c => {
        const r = ((c >> 16) & 255) / 255;
        const g = ((c >> 8) & 255) / 255;
        const b = (c & 255) / 255;
        
        mtl += `newmtl mat_${c.toString(16)}\n`;
        mtl += `Kd ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}\n`;
        mtl += `d 1.0\n`; // Opaque
        mtl += `illum 2\n\n`; // Diffuse specular
    });
    
    return mtl;
  }

  /**
   * Triggers a browser download for text content.
   */
  static downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
