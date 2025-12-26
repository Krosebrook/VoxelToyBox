
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect, useRef } from 'react';
import { AppState, AppMode, SavedModel, BuildTool, GroundingSource, VoxelMaterial } from '../types';
import { Box, Bird, Cat, Rabbit, Users, Code2, Wand2, Hammer, FolderOpen, ChevronUp, FileJson, History, Play, Pause, Info, Wrench, Loader2, ExternalLink, Search, MousePointer2, Pencil, Eraser, Pipette, Palette, Undo2, Redo2, Camera, Sparkles, Zap, BoxSelect, PlusCircle, RotateCw } from 'lucide-react';

interface UIOverlayProps {
  voxelCount: number;
  appState: AppState;
  appMode: AppMode;
  buildTool: BuildTool;
  selectedColor: number;
  selectedMaterial: VoxelMaterial;
  currentBaseModel: string;
  customBuilds: SavedModel[];
  customRebuilds: SavedModel[];
  isAutoRotate: boolean;
  isInfoVisible: boolean;
  isGenerating: boolean;
  groundingSources: GroundingSource[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSnapshot: () => void;
  onDismantle: () => void;
  onRebuild: (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => void;
  onNewScene: (type: 'Eagle') => void;
  onRefresh: () => void;
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
}

const PRESET_COLORS = [
    { name: 'Blue', hex: 0x3b82f6 }, { name: 'Red', hex: 0xef4444 },
    { name: 'Emerald', hex: 0x10b981 }, { name: 'Amber', hex: 0xf59e0b },
    { name: 'Purple', hex: 0x8b5cf6 }, { name: 'Pink', hex: 0xf472b6 },
    { name: 'Teal', hex: 0x0d9488 }, { name: 'Midnight', hex: 0x1e293b },
    { name: 'Rose', hex: 0xbe123c }, { name: 'Lime', hex: 0xa3e635 },
    { name: 'Tangerine', hex: 0xf97316 }, { name: 'Cloud', hex: 0xf8fafc },
];

export const UIOverlay: React.FC<UIOverlayProps> = ({
  voxelCount,
  appState,
  appMode,
  buildTool,
  selectedColor,
  selectedMaterial,
  currentBaseModel,
  customBuilds,
  customRebuilds,
  isAutoRotate,
  isInfoVisible,
  isGenerating,
  groundingSources,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSnapshot,
  onDismantle,
  onRebuild,
  onNewScene,
  onRefresh,
  onSelectCustomBuild,
  onSelectCustomRebuild,
  onPromptCreate,
  onPromptMorph,
  onShowJson,
  onImportJson,
  onToggleRotation,
  onToggleInfo,
  onToggleMode,
  onSetTool,
  onSetMaterial,
  onSetColor
}) => {
  const isStable = appState === AppState.STABLE;
  const isDismantling = appState === AppState.DISMANTLING;
  const isBuildMode = appMode === AppMode.BUILD;
  
  const isEagle = currentBaseModel === 'Eagle';

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none p-4">
      
      {/* --- Top Bar --- */}
      <div className="flex justify-between items-start w-full">
        <div className="pointer-events-auto flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <DropdownMenu icon={<FolderOpen size={20} />} label="Builds" color="indigo" title="Manage your voxel projects">
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">New Scene</div>
                    <DropdownItem onClick={() => onNewScene('Eagle')} icon={<PlusCircle size={16} className="text-indigo-500" />} label="Eagle Preset" />
                    
                    <div className="h-px bg-slate-100 my-1" />
                    
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Presets</div>
                    <DropdownItem onClick={() => onNewScene('Eagle')} icon={<Bird size={16}/>} label="Classic Eagle" />
                    <DropdownItem onClick={onPromptCreate} icon={<Sparkles size={16}/>} label="AI Create" highlight />
                    
                    <div className="h-px bg-slate-100 my-1" />
                    
                    {customBuilds.length > 0 && (
                        <>
                            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Library</div>
                            {customBuilds.map((model, idx) => (
                                <DropdownItem key={idx} onClick={() => onSelectCustomBuild(model)} icon={<History size={16}/>} label={model.name} truncate />
                            ))}
                        </>
                    )}
                    <DropdownItem onClick={onImportJson} icon={<FileJson size={16}/>} label="Import JSON" />
                </DropdownMenu>

                <TactileButton 
                    onClick={onRefresh} 
                    color="sky" 
                    icon={<RotateCw size={18} />} 
                    label="Fetch Latest" 
                    title="Refresh current scene" 
                />
            </div>

            <div className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm text-slate-600 font-bold w-fit" title="Total Voxel Count">
                <Box size={16} className="text-blue-500" />
                <span className="text-lg font-mono">{voxelCount}</span>
            </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
            <TactileButton onClick={onToggleMode} color={isBuildMode ? 'emerald' : 'sky'} icon={isBuildMode ? <BoxSelect size={18}/> : <Palette size={18}/>} label={isBuildMode ? "View" : "Build"} title="Toggle Build Mode (Key: B)" />
            <TactileButton onClick={onSnapshot} color="indigo" icon={<Camera size={18}/>} label="" title="Export Snapshot (PNG)" compact />
            <TactileButton onClick={onToggleRotation} color={isAutoRotate ? 'sky' : 'slate'} icon={isAutoRotate ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>} label="" title="Toggle Rotation" compact />
            <TactileButton onClick={onShowJson} color="slate" icon={<Code2 size={18}/>} label="" title="Share Blueprint" compact />
            <TactileButton onClick={onToggleInfo} color={isInfoVisible ? 'amber' : 'slate'} icon={<Info size={18}/>} label="" title="Instructions" compact />
        </div>
      </div>

      {/* --- Build Sidebar --- */}
      {isBuildMode && (
          <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto animate-in slide-in-from-left-4">
              {/* History */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex gap-2 justify-center">
                <button onClick={onUndo} disabled={!canUndo} title="Undo (Cmd+Z)" className={`p-2.5 rounded-xl transition-all ${canUndo ? 'text-slate-800 hover:bg-slate-100 active:scale-90' : 'text-slate-200 cursor-not-allowed'}`}><Undo2 size={20}/></button>
                <button onClick={onRedo} disabled={!canRedo} title="Redo (Cmd+Shift+Z)" className={`p-2.5 rounded-xl transition-all ${canRedo ? 'text-slate-800 hover:bg-slate-100 active:scale-90' : 'text-slate-200 cursor-not-allowed'}`}><Redo2 size={20}/></button>
              </div>

              {/* Tools */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <ToolIcon active={buildTool === 'pencil'} onClick={() => onSetTool('pencil')} icon={<Pencil size={20}/>} label="1" color="blue" />
                  <ToolIcon active={buildTool === 'eraser'} onClick={() => onSetTool('eraser')} icon={<Eraser size={20}/>} label="2" color="rose" />
                  <ToolIcon active={buildTool === 'picker'} onClick={() => onSetTool('picker')} icon={<Pipette size={20}/>} label="3" color="emerald" />
              </div>

              {/* Materials */}
              <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <MaterialIcon active={selectedMaterial === VoxelMaterial.MATTE} onClick={() => onSetMaterial(VoxelMaterial.MATTE)} icon={<Box size={18}/>} label="Matte" />
                  <MaterialIcon active={selectedMaterial === VoxelMaterial.METAL} onClick={() => onSetMaterial(VoxelMaterial.METAL)} icon={<Zap size={18}/>} label="Metal" />
                  <MaterialIcon active={selectedMaterial === VoxelMaterial.GLOW} onClick={() => onSetMaterial(VoxelMaterial.GLOW)} icon={<Sparkles size={18}/>} label="Glow" />
              </div>

              {/* Palette */}
              <div className="bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-3">
                  <div className="grid grid-cols-4 gap-2">
                      {PRESET_COLORS.map(c => (
                          <button key={c.hex} onClick={() => onSetColor(c.hex)} className={`w-6 h-6 rounded-lg transition-all ${selectedColor === c.hex ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 shadow-md' : 'border border-black/5 hover:scale-105'}`} style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }} title={c.name} />
                      ))}
                  </div>
                  <input type="color" value={`#${selectedColor.toString(16).padStart(6, '0')}`} onChange={(e) => onSetColor(parseInt(e.target.value.substring(1), 16))} className="w-full h-8 cursor-pointer rounded-lg bg-transparent p-0 border-0" title="Custom Color" />
              </div>
          </div>
      )}

      {/* --- Rebuild Control --- */}
      <div className="absolute bottom-10 left-0 w-full flex justify-center items-center pointer-events-none">
          <div className="pointer-events-auto">
              {!isBuildMode && isStable && !isGenerating && (
                   <BigActionButton onClick={onDismantle} icon={<Hammer size={32}/>} label="BREAK" color="rose" title="Shatter sculpture (Physics)" />
              )}
              {!isBuildMode && isDismantling && !isGenerating && (
                  <DropdownMenu icon={<Wrench size={24}/>} label="Rebuild" color="emerald" direction="up" big title="Morph parts into new shape">
                    <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Morph to...</div>
                    {isEagle && (
                        <>
                            <DropdownItem onClick={() => onRebuild('Cat')} icon={<Cat size={18}/>} label="Cat" />
                            <DropdownItem onClick={() => onRebuild('Rabbit')} icon={<Rabbit size={18}/>} label="Rabbit" />
                            <DropdownItem onClick={() => onRebuild('Twins')} icon={<Users size={18}/>} label="Twins" />
                        </>
                    )}
                    {customRebuilds.length > 0 && customRebuilds.map((model, idx) => (
                        <DropdownItem key={idx} onClick={() => onSelectCustomRebuild(model)} icon={<History size={18}/>} label={model.name} truncate />
                    ))}
                    <DropdownItem onClick={onPromptMorph} icon={<Sparkles size={18}/>} label="AI Morph" highlight />
                  </DropdownMenu>
              )}
          </div>
      </div>

    </div>
  );
};

// --- Helpers ---

const ToolIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string}> = ({ active, onClick, icon, label, color }) => {
    const theme = active ? `bg-${color}-500 text-white shadow-lg scale-110` : 'text-slate-400 hover:bg-slate-50';
    return (
        <button onClick={onClick} className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${theme}`}>
            {icon}
            <span className="text-[9px] font-black mt-1 uppercase opacity-60">{label}</span>
        </button>
    );
};

const MaterialIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => {
    return (
        <button onClick={onClick} className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${active ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title={`Material: ${label}`}>
            {icon}
            <span className="text-[8px] font-black uppercase mt-1 opacity-60">{label}</span>
        </button>
    );
};

const TactileButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, color: string, compact?: boolean, title?: string}> = ({ onClick, icon, label, color, compact, title }) => {
    const colors: Record<string, string> = {
        sky: 'bg-sky-500 hover:bg-sky-600 border-sky-700',
        emerald: 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700',
        indigo: 'bg-indigo-500 hover:bg-indigo-600 border-indigo-700',
        slate: 'bg-slate-700 hover:bg-slate-800 border-slate-900',
        amber: 'bg-amber-500 hover:bg-amber-600 border-amber-700',
        rose: 'bg-rose-500 hover:bg-rose-600 border-rose-700',
    };
    return (
        <button onClick={onClick} title={title} className={`flex items-center gap-2 font-bold text-white rounded-xl transition-all border-b-[4px] active:border-b-0 active:translate-y-[4px] shadow-lg ${colors[color]} ${compact ? 'p-2.5' : 'px-4 py-2.5'}`}>
            {icon}
            {label && <span className="text-sm">{label}</span>}
        </button>
    );
};

const BigActionButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, color: string, title: string}> = ({ onClick, icon, label, color, title }) => (
    <button onClick={onClick} title={title} className="w-28 h-28 rounded-3xl bg-rose-500 hover:bg-rose-600 text-white shadow-2xl border-b-[8px] border-rose-800 active:border-b-0 active:translate-y-[8px] flex flex-col items-center justify-center gap-2 transition-all group">
        <div className="group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-xs font-black tracking-widest">{label}</span>
    </button>
);

const DropdownMenu: React.FC<{icon: React.ReactNode, label: string, color: string, children: React.ReactNode, title?: string, direction?: 'up'|'down', big?: boolean}> = ({ icon, label, color, children, title, direction = 'down', big }) => {
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

const DropdownItem: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, highlight?: boolean, truncate?: boolean}> = ({ onClick, icon, label, highlight, truncate }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${highlight ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}>
        <span className="shrink-0">{icon}</span>
        <span className={truncate ? 'truncate' : ''}>{label}</span>
    </button>
);
