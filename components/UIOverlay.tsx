
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { AppState, AppMode, SavedModel, BuildTool, GroundingSource, VoxelMaterial, CustomColor } from '../types';
import { 
  Box, Bird, Cat, Rabbit, Users, Code2, Hammer, FolderOpen, 
  FileJson, History, Play, Pause, Info, Wrench, Search, 
  Pencil, Eraser, Pipette, Palette, Undo2, Redo2, Camera, 
  Sparkles, Zap, BoxSelect, PlusCircle, RotateCw, CloudCheck, Save, X, Maximize, Trash2, Plus, Copy,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, PaintBucket, Split, Volume2, VolumeX,
  FileDown,
  Clock,
  Download,
  Image as ImageIcon,
  Wand2
} from 'lucide-react';
import { Sound } from '../services/SoundService';

interface UIOverlayProps {
  voxelCount: number;
  appState: AppState;
  appMode: AppMode;
  buildTool: BuildTool;
  selectedColor: number;
  selectedMaterial: VoxelMaterial;
  voxelSize: number;
  currentBaseModel: string;
  customBuilds: SavedModel[];
  customRebuilds: SavedModel[];
  customPalette: CustomColor[];
  selectedCount: number;
  isAutoRotate: boolean;
  isInfoVisible: boolean;
  isGenerating: boolean;
  groundingSources: GroundingSource[];
  canUndo: boolean;
  canRedo: boolean;
  lastSaveTime: string | null;
  isMirrorMode: boolean;
  isMuted: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSnapshot: () => void;
  onDismantle: () => void;
  onRebuild: (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => void;
  onNewScene: (type: 'Eagle') => void;
  onRefresh: () => void;
  onSaveCurrent: () => void;
  onSaveAs: () => void;
  onLoadLatest: () => void;
  onExportObj: () => void;
  onSaveColor: (color: number) => void;
  onDeleteColor: (index: number) => void;
  onSelectCustomBuild: (model: SavedModel) => void;
  onSelectCustomRebuild: (model: SavedModel) => void;
  onDeleteBuild: (index: number) => void;
  onPromptCreate: () => void;
  onPromptMorph: () => void;
  onShowJson: () => void;
  onImportJson: () => void;
  onToggleRotation: () => void;
  onToggleInfo: () => void;
  onToggleMode: () => void;
  onToggleMirror: () => void;
  onToggleMute: () => void;
  onSetTool: (tool: BuildTool) => void;
  onSetMaterial: (mat: VoxelMaterial) => void;
  onSetSelectionMaterial: (mat: VoxelMaterial) => void;
  onSetColor: (color: number) => void;
  onSetVoxelSize: (size: number) => void;
  onDeleteSelected: () => void;
  onCopySelected: () => void;
  onMoveSelected: (axis: 'x' | 'y' | 'z', dir: number) => void;
}

const PRESET_COLORS = [
    { name: 'Blue', hex: 0x3b82f6 }, { name: 'Red', hex: 0xef4444 },
    { name: 'Emerald', hex: 0x10b981 }, { name: 'Amber', hex: 0xf59e0b },
    { name: 'Purple', hex: 0x8b5cf6 }, { name: 'Pink', hex: 0xf472b6 },
    { name: 'Teal', hex: 0x0d9488 }, { name: 'Midnight', hex: 0x1e293b },
    { name: 'Rose', hex: 0xbe123c }, { name: 'Lime', hex: 0xa3e635 },
    { name: 'Tangerine', hex: 0xf97316 }, { name: 'Cloud', hex: 0xf8fafc },
    { name: 'Neon Green', hex: 0x39ff14 }, { name: 'Neon Cyan', hex: 0x00ffff },
    { name: 'Neon Pink', hex: 0xff00ff }, { name: 'Neon Yellow', hex: 0xffff00 },
    { name: 'Neon Orange', hex: 0xff5f1f }, { name: 'Neon Purple', hex: 0xb026ff },
    { name: 'Neon Violet', hex: 0x7f00ff }, { name: 'Neon Red', hex: 0xff073a },
    { name: 'Neon Blue', hex: 0x4d4dff },
    { name: 'Pastel Mint', hex: 0xbcf4de }, { name: 'Pastel Sky', hex: 0xbae1ff },
    { name: 'Pastel Lilac', hex: 0xcbbcf6 }, { name: 'Pastel Rose', hex: 0xffd1dc },
    { name: 'Pastel Peach', hex: 0xffdfba }, { name: 'Pastel Lemon', hex: 0xffffba },
    { name: 'Pastel Lavender', hex: 0xe6e6fa }, { name: 'Pastel Coral', hex: 0xffb7b2 },
    { name: 'Pastel Aqua', hex: 0xaec6cf }, { name: 'Pastel Cream', hex: 0xfdfd96 },
    { name: 'Pastel Green', hex: 0x77dd77 },
    { name: 'Coffee', hex: 0x4b3621 }, { name: 'Slate', hex: 0x475569 },
    { name: 'Sand', hex: 0xc2b280 }, { name: 'Forest', hex: 0x064e3b },
    { name: 'Coal', hex: 0x171717 }, { name: 'Silver', hex: 0xd1d5db },
];

/** The UI layer that floats over the 3D canvas. */
export const UIOverlay: React.FC<UIOverlayProps> = (props) => {
  const isStable = props.appState === AppState.STABLE;
  const isDismantling = props.appState === AppState.DISMANTLING;
  const isRebuilding = props.appState === AppState.REBUILDING;
  const isBuildMode = props.appMode === AppMode.BUILD;
  
  const [buildSearchTerm, setBuildSearchTerm] = useState('');
  const [showAutoSave, setShowAutoSave] = useState(false);
  const filteredBuilds = props.customBuilds.filter(model => 
    model.name.toLowerCase().includes(buildSearchTerm.toLowerCase())
  );

  useEffect(() => {
    if (props.lastSaveTime) {
      setShowAutoSave(true);
      const t = setTimeout(() => setShowAutoSave(false), 3000);
      return () => clearTimeout(t);
    }
  }, [props.lastSaveTime]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none p-4 flex flex-col justify-between">
      
      {/* Top Section */}
      <div className="flex justify-between items-start w-full pointer-events-auto">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <DropdownMenu icon={<FolderOpen size={20} />} label="Builds" color="indigo" title="Manage Scenes & Saves">
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace</div>
                    <DropdownItem onClick={props.onSaveCurrent} icon={<Save size={16} className="text-emerald-500" />} label="Save Current" highlight title="Save changes" />
                    <DropdownItem onClick={props.onSaveAs} icon={<FileDown size={16} className="text-emerald-500" />} label="Save As..." title="Save as new build" />
                    <DropdownItem onClick={props.onExportObj} icon={<Download size={16} className="text-blue-500" />} label="Export to OBJ" title="Download 3D model" />
                    <DropdownItem onClick={props.onLoadLatest} icon={<Clock size={16} className="text-orange-500" />} label="Load Latest" title="Recover auto-saved draft" />
                    <DropdownItem onClick={() => props.onNewScene('Eagle')} icon={<PlusCircle size={16} className="text-indigo-500" />} label="New Eagle Scene" title="Start fresh with Eagle template" />
                    
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Presets</div>
                    <DropdownItem onClick={() => props.onNewScene('Eagle')} icon={<Bird size={16}/>} label="Classic Eagle" title="Load Eagle template" />
                    <DropdownItem onClick={props.onPromptCreate} icon={<Sparkles size={16}/>} label="AI Create" highlight title="Generate model from text" />
                    
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                        <span>Library</span>
                        <span className="text-[9px] text-slate-300">{filteredBuilds.length} items</span>
                    </div>
                    {filteredBuilds.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">No saved builds yet</div>
                    )}
                    <div className="max-h-[30vh] overflow-y-auto px-1 flex flex-col gap-1">
                        {filteredBuilds.map((model, idx) => (
                            <DropdownItem 
                                key={idx} 
                                onClick={() => props.onSelectCustomBuild(model)} 
                                icon={model.thumbnail ? <img src={model.thumbnail} className="w-6 h-6 rounded object-cover border border-slate-200" alt="" /> : <History size={16} className="text-slate-400" />} 
                                label={model.name} 
                                truncate 
                                title={`Load "${model.name}"`}
                                onDelete={(e) => {
                                    e.stopPropagation();
                                    props.onDeleteBuild(idx);
                                }}
                            />
                        ))}
                    </div>
                </DropdownMenu>

                <TactileButton onClick={props.onPromptCreate} color="indigo" icon={<Sparkles size={18} />} label="AI Generate" title="Create voxel art with Gemini" />
                <TactileButton onClick={props.onPromptMorph} color="amber" icon={<Wand2 size={18} />} label="AI Morph" title="Transform current build with Gemini" />

                <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-sm h-[44px]">
                    <button 
                        onClick={() => { Sound.play('undo'); props.onUndo(); }} 
                        disabled={!props.canUndo} 
                        title="Undo (Ctrl+Z)"
                        className={`p-2.5 rounded-lg transition-all ${props.canUndo ? 'text-slate-800 hover:bg-slate-100 active:scale-90' : 'text-slate-200 cursor-not-allowed'}`}
                    >
                        <Undo2 size={20} />
                    </button>
                    <button 
                        onClick={() => { Sound.play('redo'); props.onRedo(); }} 
                        disabled={!props.canRedo} 
                        title="Redo (Ctrl+Y)"
                        className={`p-2.5 rounded-lg transition-all ${props.canRedo ? 'text-slate-800 hover:bg-slate-100 active:scale-90' : 'text-slate-200 cursor-not-allowed'}`}
                    >
                        <Redo2 size={20} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm text-slate-600 font-bold" title="Total Voxel Count">
                  <Box size={16} className="text-blue-500" />
                  <span className="text-lg font-mono">{props.voxelCount}</span>
              </div>
            </div>
        </div>

        <div className="flex gap-2">
            <TactileButton onClick={props.onToggleMode} color={isBuildMode ? 'emerald' : 'sky'} icon={isBuildMode ? <BoxSelect size={18}/> : <Palette size={18}/>} label={isBuildMode ? "View" : "Build"} title="Toggle View/Build Mode (B)" />
            <TactileButton onClick={props.onSnapshot} color="indigo" icon={<Camera size={18}/>} compact title="Take Snapshot" />
            <TactileButton onClick={props.onToggleRotation} color={props.isAutoRotate ? 'sky' : 'slate'} icon={props.isAutoRotate ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>} compact title="Toggle Auto-Rotation" />
            <TactileButton onClick={props.onToggleMute} color={props.isMuted ? 'slate' : 'slate'} icon={props.isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>} compact title={props.isMuted ? "Unmute Audio" : "Mute Audio"} />
        </div>
      </div>

      {/* Auto Save Notification */}
      {showAutoSave && props.lastSaveTime && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800/90 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur animate-in fade-in slide-in-from-top-4 shadow-xl pointer-events-auto cursor-pointer" onClick={() => setShowAutoSave(false)}>
            <CloudCheck size={14} className="text-emerald-400" />
            <span>Auto-saved at {props.lastSaveTime}</span>
        </div>
      )}

      {/* Middle: Build Controls */}
      {isBuildMode && (
          <div className="flex flex-col gap-3 pointer-events-auto self-start ml-0 translate-y-[-50%] absolute top-1/2 left-4 animate-in slide-in-from-left-4">
              {/* Tool Selection */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <ToolIcon active={props.buildTool === 'pencil'} onClick={() => props.onSetTool('pencil')} icon={<Pencil size={20}/>} label="1" color="blue" title="Pencil: Add new voxels" />
                  <ToolIcon active={props.buildTool === 'eraser'} onClick={() => props.onSetTool('eraser')} icon={<Eraser size={20}/>} label="2" color="rose" title="Eraser: Remove voxels" />
                  <ToolIcon active={props.buildTool === 'picker'} onClick={() => props.onSetTool('picker')} icon={<Pipette size={20}/>} label="3" color="emerald" title="Picker: Sample color and material" />
                  <ToolIcon active={props.buildTool === 'select'} onClick={() => props.onSetTool('select')} icon={<BoxSelect size={20}/>} label="4" color="indigo" title="Select: Drag to select multiple voxels" />
                  <ToolIcon active={props.buildTool === 'paintBucket'} onClick={() => props.onSetTool('paintBucket')} icon={<PaintBucket size={20}/>} label="5" color="amber" title="Paint Bucket: Flood fill connected voxels" />
              </div>

              {/* Material Selection */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <MaterialIcon active={props.selectedMaterial === VoxelMaterial.MATTE} onClick={() => props.onSetMaterial(VoxelMaterial.MATTE)} icon={<Box size={18}/>} label="Matte" title="Matte: Standard non-reflective surface" />
                  <MaterialIcon active={props.selectedMaterial === VoxelMaterial.METAL} onClick={() => props.onSetMaterial(VoxelMaterial.METAL)} icon={<Zap size={18}/>} label="Metal" title="Metal: Shiny reflective surface" />
                  <MaterialIcon active={props.selectedMaterial === VoxelMaterial.GLOW} onClick={() => props.onSetMaterial(VoxelMaterial.GLOW)} icon={<Sparkles size={18}/>} label="Glow" title="Glow: Self-illuminating surface" />
              </div>

              {/* Utility Tools */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <MaterialIcon active={props.isMirrorMode} onClick={props.onToggleMirror} icon={<Split size={18}/>} label="Mirror" title="Mirror Mode: Symmetrical building along the X-axis" />
                  
                  {/* Voxel Size Slider */}
                  <div className="flex flex-col items-center justify-center pt-2 gap-1 w-14" title="Adjust Voxel Size">
                    <Maximize size={16} className="text-slate-400" />
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.1" 
                      value={props.voxelSize} 
                      onChange={(e) => props.onSetVoxelSize(parseFloat(e.target.value))}
                      className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500 -rotate-90 translate-y-4 mb-8"
                    />
                    <span className="text-[8px] font-black text-slate-400">{props.voxelSize}</span>
                  </div>
              </div>

              {/* Color Presets */}
              <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-3 max-w-[210px]">
                  <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map(c => (
                          <button key={c.hex} onClick={() => { Sound.play('ui'); props.onSetColor(c.hex); }} className={`w-6 h-6 rounded-lg transition-all ${props.selectedColor === c.hex ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 shadow-md' : 'border border-black/5 hover:scale-105'}`} style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }} title={c.name} />
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Selection Actions Menu */}
      {props.selectedCount > 0 && isBuildMode && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-3xl p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-8">
              <div className="flex items-center justify-between gap-8 border-b border-slate-100 pb-3">
                  <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Selection</span>
                      <span className="text-xl font-black text-indigo-600 font-mono">{props.selectedCount} <span className="text-xs text-slate-500 uppercase">voxels</span></span>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={props.onCopySelected} className="p-3 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors" title="Duplicate Selection">
                          <Copy size={20} />
                      </button>
                      <button onClick={props.onDeleteSelected} className="p-3 rounded-xl bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors" title="Delete Selection">
                          <Trash2 size={20} />
                      </button>
                  </div>
              </div>
              
              {/* Material Selection for Selected Voxels */}
              <div className="flex flex-col items-center gap-2 border-b border-slate-100 pb-3">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apply Material</span>
                 <div className="flex gap-2">
                    <MaterialIcon active={false} onClick={() => props.onSetSelectionMaterial(VoxelMaterial.MATTE)} icon={<Box size={18}/>} label="Matte" title="Apply Matte Material" />
                    <MaterialIcon active={false} onClick={() => props.onSetSelectionMaterial(VoxelMaterial.METAL)} icon={<Zap size={18}/>} label="Metal" title="Apply Metal Material" />
                    <MaterialIcon active={false} onClick={() => props.onSetSelectionMaterial(VoxelMaterial.GLOW)} icon={<Sparkles size={18}/>} label="Glow" title="Apply Glow Material" />
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center gap-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase">X Axis</span>
                      <div className="flex gap-1">
                          <button onClick={() => props.onMoveSelected('x', -1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="Move Left"><ArrowLeft size={16}/></button>
                          <button onClick={() => props.onMoveSelected('x', 1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="Move Right"><ArrowRight size={16}/></button>
                      </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Y Axis</span>
                      <div className="flex gap-1">
                          <button onClick={() => props.onMoveSelected('y', -1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="Move Down"><ChevronDown size={16}/></button>
                          <button onClick={() => props.onMoveSelected('y', 1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="Move Up"><ChevronUp size={16}/></button>
                      </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase">Z Axis</span>
                      <div className="flex gap-1">
                          <button onClick={() => props.onMoveSelected('z', -1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="Move Backward"><ArrowDown size={16}/></button>
                          <button onClick={() => props.onMoveSelected('z', 1)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200" title="Move Forward"><ArrowUp size={16}/></button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Bottom Actions */}
      <div className="flex justify-center items-center gap-4 pointer-events-auto">
          {isStable && !props.isGenerating && !isBuildMode && (
               <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <BigActionButton onClick={props.onDismantle} icon={<Hammer size={32}/>} label="BREAK" color="rose" title="Simulate physics collapse" />
                  <BigActionButton onClick={props.onPromptMorph} icon={<Sparkles size={32}/>} label="TRANSMUTE" color="indigo" glow title="Morph into a new shape using AI" />
               </div>
          )}
      </div>

    </div>
  );
};

// --- Atomic Sub-Components ---

const ToolIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string, title?: string}> = ({ active, onClick, icon, label, color, title }) => (
    <button onClick={() => { Sound.play('ui'); onClick(); }} title={title} className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${active ? `bg-${color}-500 text-white shadow-lg scale-110` : 'text-slate-400 hover:bg-slate-50'}`} onMouseEnter={() => Sound.play('hover')}>
        {icon}
        <span className="text-[9px] font-black mt-1 uppercase opacity-60">{label}</span>
    </button>
);

const MaterialIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, title?: string}> = ({ active, onClick, icon, label, title }) => (
    <button onClick={() => { Sound.play('ui'); onClick(); }} title={title} className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${active ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} onMouseEnter={() => Sound.play('hover')}>
        {icon}
        <span className="text-[8px] font-black uppercase mt-1 opacity-60">{label}</span>
    </button>
);

const TactileButton: React.FC<{onClick: () => void, icon: React.ReactNode, label?: string, color: string, compact?: boolean, title?: string}> = ({ onClick, icon, label, color, compact, title }) => {
    const bg = { sky: 'bg-sky-500 hover:bg-sky-600', emerald: 'bg-emerald-500 hover:bg-emerald-600', indigo: 'bg-indigo-500 hover:bg-indigo-600', slate: 'bg-slate-700 hover:bg-slate-800', amber: 'bg-amber-500 hover:bg-amber-600' }[color] || 'bg-slate-500';
    return (
        <button onClick={() => { Sound.play('ui'); onClick(); }} title={title} className={`flex items-center gap-2 font-bold text-white rounded-xl transition-all border-b-[4px] active:border-b-0 active:translate-y-[4px] shadow-lg ${bg} ${compact ? 'p-2.5' : 'px-4 py-2.5'}`} onMouseEnter={() => Sound.play('hover')}>
            {icon}{label && <span className="text-sm">{label}</span>}
        </button>
    );
};

const BigActionButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, color: string, glow?: boolean, title?: string}> = ({ onClick, icon, label, color, glow, title }) => {
    const bg = { rose: 'bg-rose-500 border-rose-800 hover:bg-rose-600', indigo: 'bg-indigo-500 border-indigo-800 hover:bg-indigo-600' }[color] || 'bg-slate-500';
    return (
        <button onClick={() => { Sound.play('ui'); onClick(); }} title={title} className={`w-28 h-28 rounded-3xl text-white shadow-2xl border-b-[8px] active:border-b-0 active:translate-y-[8px] flex flex-col items-center justify-center gap-2 transition-all group ${bg} ${glow ? 'animate-pulse ring-4 ring-indigo-500/20' : ''}`} onMouseEnter={() => Sound.play('hover')}>
            <div className="group-hover:scale-110 transition-transform">{icon}</div>
            <span className="text-[10px] font-black tracking-widest uppercase">{label}</span>
        </button>
    );
};

const DropdownMenu: React.FC<{icon: React.ReactNode, label: string, color: string, children: React.ReactNode, title?: string}> = ({ icon, label, color, children, title }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
    return (
        <div className="relative" ref={ref}>
            <TactileButton onClick={() => setOpen(!open)} icon={icon} label={label} color={color} title={title} />
            {open && <div className="absolute left-0 top-full mt-4 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 flex flex-col gap-1 animate-in zoom-in-95 duration-200">{children}</div>}
        </div>
    );
};

const DropdownItem: React.FC<{
    onClick: () => void, 
    icon: React.ReactNode, 
    label: string, 
    highlight?: boolean, 
    truncate?: boolean, 
    title?: string,
    onDelete?: (e: React.MouseEvent) => void
}> = ({ onClick, icon, label, highlight, truncate, title, onDelete }) => (
    <button 
        onClick={() => { Sound.play('ui'); onClick(); }} 
        title={title} 
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-colors group relative ${highlight ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`} 
        onMouseEnter={() => Sound.play('hover')}
    >
        <div className="flex items-center gap-3 overflow-hidden">
            <span className="shrink-0 flex items-center justify-center">{icon}</span>
            <span className={truncate ? 'truncate text-left' : 'text-left'}>{label}</span>
        </div>
        
        {onDelete && (
            <div 
                role="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-100 text-rose-500 rounded-lg transition-all absolute right-2"
                title="Delete this build"
            >
                <Trash2 size={14} />
            </div>
        )}
    </button>
);
