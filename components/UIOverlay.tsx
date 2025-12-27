
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { AppState, AppMode, SavedModel, BuildTool, GroundingSource, VoxelMaterial } from '../types';
import { 
  Box, Bird, Cat, Rabbit, Users, Code2, Hammer, FolderOpen, 
  FileJson, History, Play, Pause, Info, Wrench, Search, 
  Pencil, Eraser, Pipette, Palette, Undo2, Redo2, Camera, 
  Sparkles, Zap, BoxSelect, PlusCircle, RotateCw, CloudCheck, Save, X, Maximize
} from 'lucide-react';

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
  isAutoRotate: boolean;
  isInfoVisible: boolean;
  isGenerating: boolean;
  groundingSources: GroundingSource[];
  canUndo: boolean;
  canRedo: boolean;
  lastSaveTime: string | null;
  onUndo: () => void;
  onRedo: () => void;
  onSnapshot: () => void;
  onDismantle: () => void;
  onRebuild: (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => void;
  onNewScene: (type: 'Eagle') => void;
  onRefresh: () => void;
  onSaveCurrent: () => void;
  onSelectCustomBuild: (model: SavedModel) => void;
  onSelectCustomRebuild: (model: SavedModel) => void;
  onPromptCreate: () => void;
  onPromptMorph: () => void;
  onShowJson: () => void;
  onImportJson: () => void;
  onToggleRotation: () => void;
  onToggleInfo: () => void;
  onToggleMode: () => void;
  onSetTool: (tool: BuildTool) => void;
  onSetMaterial: (mat: VoxelMaterial) => void;
  onSetColor: (color: number) => void;
  onSetVoxelSize: (size: number) => void;
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
    { name: 'Pastel Mint', hex: 0xbcf4de }, { name: 'Pastel Sky', hex: 0xbae1ff },
    { name: 'Pastel Lilac', hex: 0xcbbcf6 }, { name: 'Pastel Rose', hex: 0xffd1dc },
    { name: 'Pastel Peach', hex: 0xffdfba }, { name: 'Pastel Lemon', hex: 0xffffba },
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
  const filteredBuilds = props.customBuilds.filter(model => 
    model.name.toLowerCase().includes(buildSearchTerm.toLowerCase())
  );

  return (
    <div className="absolute inset-0 pointer-events-none select-none p-4 flex flex-col justify-between">
      
      {/* Top Section: Navigation & Stats */}
      <div className="flex justify-between items-start w-full pointer-events-auto">
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <DropdownMenu icon={<FolderOpen size={20} />} label="Builds" color="indigo" title="Manage your projects, presets, and AI generations">
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Workspace</div>
                    <DropdownItem onClick={props.onSaveCurrent} icon={<Save size={16} className="text-emerald-500" />} label="Save Current Build" title="Save your current sculpture to the library" highlight />
                    <DropdownItem onClick={() => props.onNewScene('Eagle')} icon={<PlusCircle size={16} className="text-indigo-500" />} label="New Eagle Scene" title="Reset the scene with a fresh Eagle" />
                    
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Presets</div>
                    <DropdownItem onClick={() => props.onNewScene('Eagle')} icon={<Bird size={16}/>} label="Classic Eagle" title="Load the classic eagle model" />
                    <DropdownItem onClick={props.onPromptCreate} icon={<Sparkles size={16}/>} label="AI Create" title="Use Gemini AI to architect a new build from a text prompt" highlight />
                    <DropdownItem onClick={props.onPromptMorph} icon={<RotateCw size={16}/>} label="AI Transmute" title="Morph the current blocks into something new" highlight />
                    
                    <div className="h-px bg-slate-100 my-1" />
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Library</div>
                    {props.customBuilds.length > 0 && (
                        <div className="px-2 py-1">
                            <div className="relative" title="Search through your saved builds">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" placeholder="Search..." value={buildSearchTerm}
                                    onChange={(e) => setBuildSearchTerm(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-3 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}
                    <div className="max-h-[30vh] overflow-y-auto px-1 flex flex-col gap-1">
                        {filteredBuilds.length > 0 ? filteredBuilds.map((model, idx) => (
                            <DropdownItem key={idx} onClick={() => props.onSelectCustomBuild(model)} icon={<History size={16} className="text-slate-400" />} label={model.name} title={`Load saved build: ${model.name}`} truncate />
                        )) : props.customBuilds.length > 0 && <div className="py-4 text-center text-[10px] font-bold text-slate-400">No matches</div>}
                    </div>
                    <div className="h-px bg-slate-100 my-1" />
                    <DropdownItem onClick={props.onImportJson} icon={<FileJson size={16}/>} label="Import JSON" title="Import a model from a JSON blueprint" />
                </DropdownMenu>

                <TactileButton 
                  onClick={props.onPromptCreate} 
                  color="indigo" 
                  icon={<Sparkles size={18} />} 
                  label="AI Generate" 
                  title="Architect a new model from scratch using AI" 
                />

                {/* History Controls in Top Bar */}
                <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-sm h-[44px]">
                    <button 
                        onClick={props.onUndo} 
                        disabled={!props.canUndo}
                        title="Undo the last action (Cmd+Z)"
                        className={`p-2.5 rounded-lg transition-all ${props.canUndo ? 'text-slate-800 hover:bg-slate-100 active:scale-90' : 'text-slate-200 cursor-not-allowed'}`}
                    >
                        <Undo2 size={20} />
                    </button>
                    <button 
                        onClick={props.onRedo} 
                        disabled={!props.canRedo}
                        title="Redo the last undone action (Cmd+Y)"
                        className={`p-2.5 rounded-lg transition-all ${props.canRedo ? 'text-slate-800 hover:bg-slate-100 active:scale-90' : 'text-slate-200 cursor-not-allowed'}`}
                    >
                        <Redo2 size={20} />
                    </button>
                </div>

                <TactileButton onClick={props.onRefresh} color="sky" icon={<RotateCw size={18} />} title="Reset the current sculpture to its original saved state" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm text-slate-600 font-bold" title="Current number of voxels in the scene">
                  <Box size={16} className="text-blue-500" />
                  <span className="text-lg font-mono">{props.voxelCount}</span>
              </div>
              {props.lastSaveTime && (
                <div 
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/5 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-500"
                  title="Your draft is automatically saved to local storage as you build"
                >
                  <CloudCheck size={14} className="text-emerald-500" />
                  <span>Draft Saved {props.lastSaveTime}</span>
                </div>
              )}
            </div>
        </div>

        <div className="flex gap-2">
            <TactileButton 
                onClick={props.onToggleMode} 
                color={isBuildMode ? 'emerald' : 'sky'} 
                icon={isBuildMode ? <BoxSelect size={18}/> : <Palette size={18}/>} 
                label={isBuildMode ? "View" : "Build"} 
                title={isBuildMode ? "Switch to View Mode (Navigation focus)" : "Switch to Build Mode (Tool focus - Key: B)"} 
            />
            <TactileButton onClick={props.onSnapshot} color="indigo" icon={<Camera size={18}/>} title="Export a high-quality PNG snapshot of your creation" compact />
            <TactileButton onClick={props.onToggleRotation} color={props.isAutoRotate ? 'sky' : 'slate'} icon={props.isAutoRotate ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>} title={props.isAutoRotate ? "Pause auto-rotation" : "Resume auto-rotation"} compact />
            <TactileButton onClick={props.onShowJson} color="slate" icon={<Code2 size={18}/>} title="View and copy the JSON blueprint for this model" compact />
            <TactileButton onClick={props.onToggleInfo} color={props.isInfoVisible ? 'amber' : 'slate'} icon={<Info size={18}/>} title="Show/Hide app instructions and welcome info" compact />
        </div>
      </div>

      {/* Middle: Build Controls (Only when building) */}
      {isBuildMode && (
          <div className="flex flex-col gap-3 pointer-events-auto self-start ml-0 translate-y-[-50%] absolute top-1/2 left-4 animate-in slide-in-from-left-4">
              {/* Tool Options */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <ToolIcon active={props.buildTool === 'pencil'} onClick={() => props.onSetTool('pencil')} icon={<Pencil size={20}/>} label="1" color="blue" title="Pencil Tool: Add new voxels (Key: 1)" />
                  <ToolIcon active={props.buildTool === 'eraser'} onClick={() => props.onSetTool('eraser')} icon={<Eraser size={20}/>} label="2" color="rose" title="Eraser Tool: Remove existing voxels (Key: 2)" />
                  <ToolIcon active={props.buildTool === 'picker'} onClick={() => props.onSetTool('picker')} icon={<Pipette size={20}/>} label="3" color="emerald" title="Color Picker: Copy color and material from a voxel (Key: 3)" />
              </div>

              {/* Materials & Scaling */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <MaterialIcon active={props.selectedMaterial === VoxelMaterial.MATTE} onClick={() => props.onSetMaterial(VoxelMaterial.MATTE)} icon={<Box size={18}/>} label="Matte" title="Set material to Matte" />
                  <MaterialIcon active={props.selectedMaterial === VoxelMaterial.METAL} onClick={() => props.onSetMaterial(VoxelMaterial.METAL)} icon={<Zap size={18}/>} label="Metal" title="Set material to Reflective Metal" />
                  <MaterialIcon active={props.selectedMaterial === VoxelMaterial.GLOW} onClick={() => props.onSetMaterial(VoxelMaterial.GLOW)} icon={<Sparkles size={18}/>} label="Glow" title="Set material to Self-Illuminating Glow" />
                  
                  <div className="h-px bg-slate-100 my-1" />
                  
                  <div className="flex flex-col items-center gap-1 px-1 py-1" title={`Adjust voxel scale: ${props.voxelSize.toFixed(2)} (relative to grid)`}>
                      <Maximize size={16} className="text-slate-400 mb-1" />
                      <input 
                        type="range" min="0.4" max="1.1" step="0.05" 
                        value={props.voxelSize} 
                        onChange={(e) => props.onSetVoxelSize(parseFloat(e.target.value))}
                        className="w-10 h-24 appearance-none bg-slate-100 rounded-full cursor-pointer accent-indigo-500 orientation-vertical"
                        style={{ writingMode: 'bt-lr' } as any}
                      />
                      <span className="text-[8px] font-black text-slate-500 uppercase mt-1">Size</span>
                  </div>
              </div>

              {/* Palette */}
              <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-3 max-w-[210px]" title="Color Palette: Select a build color">
                  <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map(c => (
                          <button key={c.hex} onClick={() => props.onSetColor(c.hex)} className={`w-6 h-6 rounded-lg transition-all ${props.selectedColor === c.hex ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 shadow-md' : 'border border-black/5 hover:scale-105'}`} style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }} title={`Color: ${c.name}`} />
                      ))}
                  </div>
                  <div className="h-px bg-slate-100 my-1" />
                  <AdvancedColorPicker selectedColor={props.selectedColor} onSetColor={props.onSetColor} />
              </div>
          </div>
      )}

      {/* Bottom: Rebuild / Dismantle Actions */}
      <div className="flex justify-center items-center gap-4 pointer-events-auto">
          {isStable && !props.isGenerating && !isBuildMode && (
               <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <BigActionButton onClick={props.onDismantle} icon={<Hammer size={32}/>} label="BREAK" color="rose" title="Shatter the sculpture into pieces using physics" />
                  <BigActionButton onClick={props.onPromptMorph} icon={<Sparkles size={32}/>} label="TRANSMUTE" color="indigo" title="AI Rebuild: Morph the current model into something new" glow />
               </div>
          )}
          {!isBuildMode && (isDismantling || isRebuilding) && !props.isGenerating && (
              <DropdownMenu icon={<Wrench size={24}/>} label="Rebuild" color="emerald" direction="up" big title="Morph the shattered pieces into a new model">
                <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Morph to...</div>
                {props.currentBaseModel === 'Eagle' && (
                    <>
                        <DropdownItem onClick={() => props.onRebuild('Cat')} icon={<Cat size={18}/>} label="Cat" title="Rebuild into a Cat" />
                        <DropdownItem onClick={() => props.onRebuild('Rabbit')} icon={<Rabbit size={18}/>} label="Rabbit" title="Rebuild into a Rabbit" />
                        <DropdownItem onClick={() => props.onRebuild('Twins')} icon={<Users size={18}/>} label="Twins" title="Rebuild into Twin Eaglets" />
                    </>
                )}
                {props.customRebuilds.map((model, idx) => (
                    <DropdownItem key={idx} onClick={() => props.onSelectCustomRebuild(model)} icon={<History size={18}/>} label={model.name} title={`Rebuild into saved model: ${model.name}`} truncate />
                ))}
                <DropdownItem onClick={props.onPromptMorph} icon={<Sparkles size={18}/>} label="AI Morph" title="Use Gemini AI to rebuild these blocks into something new" highlight />
              </DropdownMenu>
          )}
          
          {props.isGenerating && (
              <div className="flex flex-col items-center gap-2 animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                      <Sparkles size={32} className="animate-spin duration-slow" />
                  </div>
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Architecting...</span>
              </div>
          )}
      </div>

    </div>
  );
};

// --- Advanced Color Picker ---

const AdvancedColorPicker: React.FC<{ selectedColor: number, onSetColor: (color: number) => void }> = ({ selectedColor, onSetColor }) => {
    // Current state in HSV for better UI manipulation
    const threeColor = useMemo(() => new THREE.Color(selectedColor), [selectedColor]);
    const initialHsl = useMemo(() => {
        const h = { h: 0, s: 0, l: 0 };
        threeColor.getHSL(h);
        return h;
    }, [threeColor]);

    const [hue, setHue] = useState(initialHsl.h * 360);
    const [sat, setSat] = useState(initialHsl.s * 100);
    const [lum, setLum] = useState(initialHsl.l * 100);

    // Sync internal state when external color changes (e.g. from preset or picker tool)
    useEffect(() => {
        const currentHex = new THREE.Color().setHSL(hue / 360, sat / 100, lum / 100).getHex();
        if (currentHex !== selectedColor) {
            const h = { h: 0, s: 0, l: 0 };
            threeColor.getHSL(h);
            setHue(h.h * 360);
            setSat(h.s * 100);
            setLum(h.l * 100);
        }
    }, [selectedColor, threeColor]);

    const handleHslChange = (h: number, s: number, l: number) => {
        setHue(h); setSat(s); setLum(l);
        const nextColor = new THREE.Color().setHSL(h / 360, s / 100, l / 100);
        onSetColor(nextColor.getHex());
    };

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        height: '100px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'crosshair',
        backgroundColor: `hsl(${hue}, 100%, 50%)`,
        backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)'
    };

    const hueBarStyle: React.CSSProperties = {
        height: '12px',
        width: '100%',
        borderRadius: '6px',
        marginTop: '8px',
        cursor: 'pointer',
        background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
    };

    const handleAreaMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const update = (evt: MouseEvent | TouchEvent) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const clientX = 'touches' in evt ? evt.touches[0].clientX : (evt as MouseEvent).clientX;
            const clientY = 'touches' in evt ? evt.touches[0].clientY : (evt as MouseEvent).clientY;
            
            let s = ((clientX - rect.left) / rect.width) * 100;
            let v = 100 - ((clientY - rect.top) / rect.height) * 100;
            s = Math.max(0, Math.min(100, s));
            v = Math.max(0, Math.min(100, v));

            const h = hue;
            const l_hsl = (v / 100) * (1 - (s / 100) / 2);
            const s_hsl = l_hsl === 0 || l_hsl === 1 ? 0 : (v / 100 - l_hsl) / Math.min(l_hsl, 1 - l_hsl);
            
            handleHslChange(h, s_hsl * 100, l_hsl * 100);
        };

        const stop = () => {
            window.removeEventListener('mousemove', update);
            window.removeEventListener('mouseup', stop);
            window.removeEventListener('touchmove', update);
            window.removeEventListener('touchend', stop);
        };

        window.addEventListener('mousemove', update);
        window.addEventListener('mouseup', stop);
        window.addEventListener('touchmove', update);
        window.addEventListener('touchend', stop);
        
        if ('touches' in e) update(e.nativeEvent as TouchEvent);
        else update(e.nativeEvent as MouseEvent);
    };

    const handleHueMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        const update = (evt: MouseEvent | TouchEvent) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const clientX = 'touches' in evt ? evt.touches[0].clientX : (evt as MouseEvent).clientX;
            let h = ((clientX - rect.left) / rect.width) * 360;
            h = Math.max(0, Math.min(360, h));
            handleHslChange(h, sat, lum);
        };

        const stop = () => {
            window.removeEventListener('mousemove', update);
            window.removeEventListener('mouseup', stop);
            window.removeEventListener('touchmove', update);
            window.removeEventListener('touchend', stop);
        };

        window.addEventListener('mousemove', update);
        window.addEventListener('mouseup', stop);
        window.addEventListener('touchmove', update);
        window.addEventListener('touchend', stop);

        if ('touches' in e) update(e.nativeEvent as TouchEvent);
        else update(e.nativeEvent as MouseEvent);
    };

    const v_hsv = (lum / 100) + (sat / 100) * Math.min(lum / 100, 1 - lum / 100);
    const s_hsv = v_hsv === 0 ? 0 : 2 * (1 - (lum / 100) / v_hsv);
    const mLeft = s_hsv * 100;
    const mTop = 100 - v_hsv * 100;

    return (
        <div className="flex flex-col gap-2">
            <div 
                style={containerStyle} 
                onMouseDown={handleAreaMouseDown}
                onTouchStart={handleAreaMouseDown}
            >
                <div 
                    className="absolute w-3 h-3 border-2 border-white rounded-full shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${mLeft}%`, top: `${mTop}%` }}
                />
            </div>
            <div 
                style={hueBarStyle} 
                onMouseDown={handleHueMouseDown}
                onTouchStart={handleHueMouseDown}
                className="relative"
            >
                <div 
                    className="absolute top-0 bottom-0 w-1.5 bg-white border border-slate-300 rounded-full shadow-sm -translate-x-1/2"
                    style={{ left: `${(hue / 360) * 100}%` }}
                />
            </div>
            <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <span>Spectrum</span>
                <span className="text-slate-600">#{selectedColor.toString(16).padStart(6, '0')}</span>
            </div>
        </div>
    );
};

// --- Atomic Sub-Components ---

const ToolIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string, title?: string}> = ({ active, onClick, icon, label, color, title }) => (
    <button onClick={onClick} title={title} className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${active ? `bg-${color}-500 text-white shadow-lg scale-110` : 'text-slate-400 hover:bg-slate-50'}`}>
        {icon}
        <span className="text-[9px] font-black mt-1 uppercase opacity-60">{label}</span>
    </button>
);

const MaterialIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, title?: string}> = ({ active, onClick, icon, label, title }) => (
    <button onClick={onClick} title={title} className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${active ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
        {icon}
        <span className="text-[8px] font-black uppercase mt-1 opacity-60">{label}</span>
    </button>
);

const TactileButton: React.FC<{onClick: () => void, icon: React.ReactNode, label?: string, color: string, compact?: boolean, title?: string}> = ({ onClick, icon, label, color, compact, title }) => {
    const bg = {
        sky: 'bg-sky-500 hover:bg-sky-600 border-sky-700',
        emerald: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700',
        indigo: 'bg-indigo-500 hover:bg-indigo-600 border-indigo-700',
        slate: 'bg-slate-700 hover:bg-slate-800 border-slate-900',
        amber: 'bg-amber-500 hover:bg-amber-600 border-amber-700',
        rose: 'bg-rose-500 hover:bg-rose-600 border-rose-700',
    }[color] || 'bg-slate-500';

    return (
        <button onClick={onClick} title={title} className={`flex items-center gap-2 font-bold text-white rounded-xl transition-all border-b-[4px] active:border-b-0 active:translate-y-[4px] shadow-lg ${bg} ${compact ? 'p-2.5' : 'px-4 py-2.5'}`}>
            {icon}
            {label && <span className="text-sm">{label}</span>}
        </button>
    );
};

const BigActionButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, color: string, title?: string, glow?: boolean}> = ({ onClick, icon, label, color, title, glow }) => {
    const bg = {
        rose: 'bg-rose-500 border-rose-800 hover:bg-rose-600',
        indigo: 'bg-indigo-500 border-indigo-800 hover:bg-indigo-600',
        emerald: 'bg-emerald-500 border-emerald-800 hover:bg-emerald-600',
    }[color] || 'bg-slate-500 border-slate-800';

    return (
        <button 
            onClick={onClick} 
            title={title} 
            className={`w-28 h-28 rounded-3xl text-white shadow-2xl border-b-[8px] active:border-b-0 active:translate-y-[8px] flex flex-col items-center justify-center gap-2 transition-all group ${bg} ${glow ? 'animate-pulse ring-4 ring-indigo-500/20' : ''}`}
        >
            <div className="group-hover:scale-110 transition-transform">{icon}</div>
            <span className="text-[10px] font-black tracking-widest uppercase">{label}</span>
        </button>
    );
};

const DropdownMenu: React.FC<{icon: React.ReactNode, label: string, color: string, children: React.ReactNode, title?: string, direction?: 'up'|'down', big?: boolean}> = ({ icon, label, color, children, title, direction = 'down' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <TactileButton onClick={() => setOpen(!open)} icon={icon} label={label} color={color} title={title} compact={!label} />
            {open && (
                <div className={`absolute left-0 ${direction === 'up' ? 'bottom-full mb-4' : 'top-full mt-4'} w-52 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 flex flex-col gap-1 animate-in zoom-in-95 duration-200`}>
                    {children}
                </div>
            )}
        </div>
    );
};

const DropdownItem: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, title?: string, highlight?: boolean, truncate?: boolean}> = ({ onClick, icon, label, title, highlight, truncate }) => (
    <button onClick={() => { onClick(); }} title={title} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${highlight ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}>
        <span className="shrink-0">{icon}</span>
        <span className={truncate ? 'truncate text-left' : 'text-left'}>{label}</span>
    </button>
);
