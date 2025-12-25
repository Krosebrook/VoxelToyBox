
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useEffect, useRef } from 'react';
import { AppState, AppMode, SavedModel, BuildTool, GroundingSource } from '../types';
import { Box, Bird, Cat, Rabbit, Users, Code2, Wand2, Hammer, FolderOpen, ChevronUp, FileJson, History, Play, Pause, Info, Wrench, Loader2, ExternalLink, Search, MousePointer2, Pencil, Eraser, Pipette, Palette } from 'lucide-react';

interface UIOverlayProps {
  voxelCount: number;
  appState: AppState;
  appMode: AppMode;
  buildTool: BuildTool;
  selectedColor: number;
  currentBaseModel: string;
  customBuilds: SavedModel[];
  customRebuilds: SavedModel[];
  isAutoRotate: boolean;
  isInfoVisible: boolean;
  isGenerating: boolean;
  groundingSources: GroundingSource[];
  onDismantle: () => void;
  onRebuild: (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => void;
  onNewScene: (type: 'Eagle') => void;
  onSelectCustomBuild: (model: SavedModel) => void;
  onSelectCustomRebuild: (model: SavedModel) => void;
  onPromptCreate: () => void;
  onPromptMorph: () => void;
  onShowJson: () => void;
  onImportJson: () => void;
  onToggleRotation: () => void;
  // Fix: Removed duplicate onToggleInfo identifier
  onToggleInfo: () => void;
  onToggleMode: () => void;
  onSetTool: (tool: BuildTool) => void;
  onSetColor: (color: number) => void;
}

const LOADING_MESSAGES = [
    "Crafting voxels...",
    "Designing structure...",
    "Calculating physics...",
    "Searching the web...",
    "Assembling geometry...",
    "Applying polish..."
];

const PRESET_COLORS = [
    { name: 'Classic Blue', hex: 0x3b82f6 },
    { name: 'Ruby Red', hex: 0xef4444 },
    { name: 'Emerald', hex: 0x10b981 },
    { name: 'Sunshine', hex: 0xf59e0b },
    { name: 'Purple Dream', hex: 0x8b5cf6 },
    { name: 'Candy Pink', hex: 0xf472b6 },
    { name: 'Aqua', hex: 0x22d3ee },
    { name: 'Lime', hex: 0xa3e635 },
    { name: 'Tangerine', hex: 0xf97316 },
    { name: 'Deep Rose', hex: 0xbe123c },
    { name: 'Teal', hex: 0x0d9488 },
    { name: 'Sand', hex: 0xfde68a },
    { name: 'Bark', hex: 0x451a03 },
    { name: 'Midnight', hex: 0x1e293b },
    { name: 'Slate', hex: 0x64748b },
    { name: 'Cloud', hex: 0xf8fafc },
];

export const UIOverlay: React.FC<UIOverlayProps> = ({
  voxelCount,
  appState,
  appMode,
  buildTool,
  selectedColor,
  currentBaseModel,
  customBuilds,
  customRebuilds,
  isAutoRotate,
  isInfoVisible,
  isGenerating,
  groundingSources,
  onDismantle,
  onRebuild,
  onNewScene,
  onSelectCustomBuild,
  onSelectCustomRebuild,
  onPromptCreate,
  onPromptMorph,
  onShowJson,
  onImportJson,
  onToggleRotation,
  // Fix: Removed duplicate onToggleInfo identifier in destructuring
  onToggleInfo,
  onToggleMode,
  onSetTool,
  onSetColor
}) => {
  const isStable = appState === AppState.STABLE;
  const isDismantling = appState === AppState.DISMANTLING;
  const isBuildMode = appMode === AppMode.BUILD;
  
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  useEffect(() => {
    if (isGenerating) {
        const interval = setInterval(() => {
            setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 2000);
        return () => clearInterval(interval);
    }
  }, [isGenerating]);
  
  const isEagle = currentBaseModel === 'Eagle';

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none">
      
      {/* --- Top Bar (Stats & Tools) --- */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        
        {/* Global Scene Controls */}
        <div className="pointer-events-auto flex flex-col gap-2">
            <DropdownMenu 
                icon={<FolderOpen size={20} />}
                label="Builds"
                color="indigo"
                title="Open the Builds menu to see presets, your saved models, or generate a new one using AI!"
            >
                <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">NEW BUILDS</div>
                <DropdownItem onClick={() => onNewScene('Eagle')} icon={<Bird size={16}/>} label="Eagle" title="Reset the scene with the classic Eagle preset model." />
                <DropdownItem onClick={onPromptCreate} icon={<Wand2 size={16}/>} label="New build" title="Ask Gemini AI to create a completely new voxel model from your text description!" highlight />
                <div className="h-px bg-slate-100 my-1" />
                
                {customBuilds.length > 0 && (
                    <>
                        <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">YOUR CREATIONS</div>
                        {customBuilds.map((model, idx) => (
                            <DropdownItem 
                                key={`build-${idx}`} 
                                onClick={() => onSelectCustomBuild(model)} 
                                icon={<History size={16}/>} 
                                label={model.name} 
                                title={`Load your previous creation: "${model.name}".`}
                                truncate
                            />
                        ))}
                        <div className="h-px bg-slate-100 my-1" />
                    </>
                )}

                <DropdownItem onClick={onImportJson} icon={<FileJson size={16}/>} label="Import JSON" title="Paste a JSON blueprint to load a shared voxel model." />
            </DropdownMenu>

            <div 
              className="flex items-center gap-3 px-4 py-2 bg-white/90 backdrop-blur-sm shadow-sm rounded-xl border border-slate-200 text-slate-500 font-bold w-fit mt-2"
              title={`This counter shows that your scene currently has ${voxelCount} individual blocks.`}
            >
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                    <Box size={16} strokeWidth={3} />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-wider opacity-60">Voxels</span>
                    <span className="text-lg text-slate-800 font-extrabold font-mono">{voxelCount}</span>
                </div>
            </div>
        </div>

        {/* Utilities */}
        <div className="pointer-events-auto flex gap-2">
            <TactileButton
                onClick={onToggleMode}
                color={isBuildMode ? 'emerald' : 'sky'}
                icon={isBuildMode ? <MousePointer2 size={18} strokeWidth={2.5} /> : <Palette size={18} strokeWidth={2.5} />}
                label={isBuildMode ? "View Mode" : "Build Mode"}
                title={isBuildMode ? "Switch to View Mode: Rotates camera and lets you play with physics!" : "Switch to Build Mode: Allows you to place, erase, and pick blocks!"}
            />
            <TactileButton
                onClick={onToggleRotation}
                color={isAutoRotate ? 'sky' : 'slate'}
                icon={isAutoRotate ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                label=""
                title={isAutoRotate ? "Stop the camera from automatically spinning around your model." : "Make the camera spin slowly around your creation."}
                compact
            />
            <TactileButton
                onClick={onShowJson}
                color="slate"
                icon={<Code2 size={18} strokeWidth={2.5} />}
                label="Share"
                title="Get the JSON blueprint for your current model to save or share with friends!"
            />
            <TactileButton
                onClick={onToggleInfo}
                color={isInfoVisible ? 'indigo' : 'slate'}
                icon={<Info size={18} strokeWidth={2.5} />}
                label=""
                title={isInfoVisible ? "Hide the welcome message and instructions." : "Show the welcome message and helpful information about the app."}
                compact
            />
        </div>
      </div>

      {/* --- Build Mode Toolbox --- */}
      {isBuildMode && (
          <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto animate-in slide-in-from-left-10 duration-500">
              {/* Tool Selection */}
              <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2">
                  <ToolIcon 
                    active={buildTool === 'pencil'} 
                    onClick={() => onSetTool('pencil')} 
                    icon={<Pencil size={20} />} 
                    label="Place" 
                    color="blue"
                    title="Pencil Tool: Click on an existing block to snap a new block to that side."
                  />
                  <ToolIcon 
                    active={buildTool === 'eraser'} 
                    onClick={() => onSetTool('eraser')} 
                    icon={<Eraser size={20} />} 
                    label="Erase" 
                    color="rose"
                    title="Eraser Tool: Click on any block to remove it from your sculpture."
                  />
                  <ToolIcon 
                    active={buildTool === 'picker'} 
                    onClick={() => onSetTool('picker')} 
                    icon={<Pipette size={20} />} 
                    label="Pick" 
                    color="emerald"
                    title="Color Picker Tool: Click on a block to select its color for your next placement!"
                  />
              </div>

              {/* Color Palette */}
              <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-3 min-w-[140px]" title="Choose a color for your next block!">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Palette</div>
                  <div className="grid grid-cols-4 gap-2">
                      {PRESET_COLORS.map(c => (
                          <button
                            key={c.hex}
                            onClick={() => onSetColor(c.hex)}
                            title={`Select color: ${c.name}`}
                            className={`w-6 h-6 rounded border transition-transform hover:scale-110 active:scale-95 ${selectedColor === c.hex ? 'border-indigo-500 ring-2 ring-indigo-200 scale-110 shadow-sm' : 'border-black/5'}`}
                            style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, '0')}` }}
                          />
                      ))}
                  </div>
                  <div className="h-px bg-slate-100" />
                  <input 
                    type="color" 
                    value={`#${selectedColor.toString(16).padStart(6, '0')}`}
                    onChange={(e) => onSetColor(parseInt(e.target.value.substring(1), 16))}
                    className="w-full h-8 cursor-pointer rounded-lg bg-transparent p-0 border-0"
                    title="Click here to choose a custom color using the advanced color picker!"
                  />
              </div>
          </div>
      )}

      {/* --- Grounding Sources Sidebar --- */}
      {groundingSources.length > 0 && !isGenerating && (
          <div className="absolute top-24 right-4 w-64 pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-500">
              <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                      <Search size={14} className="text-slate-400" />
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Inspiration Sources</span>
                  </div>
                  <div className="p-2 flex flex-col gap-1 max-h-[30vh] overflow-y-auto">
                      {groundingSources.map((source, idx) => (
                          <a 
                              key={idx} 
                              href={source.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors group"
                              title={`View original source used for inspiration: ${source.title}\nURL: ${source.uri}`}
                          >
                              <div className="p-1 rounded bg-slate-200 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                  <ExternalLink size={10} />
                              </div>
                              <span className="text-xs font-bold text-slate-600 truncate group-hover:text-blue-600">{source.title}</span>
                          </a>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- Loading Indicator --- */}
      {isGenerating && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300">
              <div className="bg-white/90 backdrop-blur-md border-2 border-indigo-100 px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 min-w-[280px]">
                  <div className="relative">
                      <div className="absolute inset-0 bg-indigo-200 rounded-full animate-ping opacity-20"></div>
                      <Loader2 size={48} className="text-indigo-500 animate-spin" />
                  </div>
                  <div className="text-center">
                      <h3 className="text-lg font-extrabold text-slate-800">Gemini is Building...</h3>
                      <p className="text-slate-500 font-bold text-sm transition-all duration-300">
                          {LOADING_MESSAGES[loadingMsgIndex]}
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* --- Bottom Control Center --- */}
      <div className="absolute bottom-8 left-0 w-full flex justify-center items-end pointer-events-none">
        
        <div className="pointer-events-auto transition-all duration-500 ease-in-out transform">
            
            {/* STATE 1: VIEW MODE + STABLE -> BREAK BUTTON */}
            {!isBuildMode && isStable && !isGenerating && (
                 <div className="animate-in slide-in-from-bottom-10 fade-in duration-300">
                     <BigActionButton 
                        onClick={onDismantle} 
                        icon={<Hammer size={32} strokeWidth={2.5} />} 
                        label="BREAK" 
                        color="rose" 
                        title="BREAK IT! Click to smash the current model into pieces with realistic physics!"
                     />
                 </div>
            )}

            {/* STATE 2: VIEW MODE + DISMANTLED -> REBUILD BUTTON */}
            {!isBuildMode && isDismantling && !isGenerating && (
                <div className="flex items-end gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300">
                     <DropdownMenu 
                        icon={<Wrench size={24} />}
                        label="Rebuild"
                        color="emerald"
                        direction="up"
                        big
                        title="REBUILD IT! Click to choose a new shape and watch the pieces fly together!"
                     >
                        <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">REBUILD</div>
                        
                        {isEagle && (
                            <>
                                <DropdownItem onClick={() => onRebuild('Cat')} icon={<Cat size={18}/>} label="Cat" title="Reassemble all these blocks into a sitting cat model." />
                                <DropdownItem onClick={() => onRebuild('Rabbit')} icon={<Rabbit size={18}/>} label="Rabbit" title="Reassemble all these blocks into a cute rabbit model." />
                                <DropdownItem onClick={() => onRebuild('Twins')} icon={<Users size={18}/>} label="Eagles x2" title="Split the blocks and build two smaller eagles at the same time!" />
                                <div className="h-px bg-slate-100 my-1" />
                            </>
                        )}

                        {customRebuilds.length > 0 && (
                            <>
                                <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">CUSTOM REBUILDS</div>
                                {customRebuilds.map((model, idx) => (
                                    <DropdownItem 
                                        key={`rebuild-${idx}`} 
                                        onClick={() => onSelectCustomRebuild(model)} 
                                        icon={<History size={18}/>} 
                                        label={model.name}
                                        title={`Reassemble the blocks into your previous creation: "${model.name}".`}
                                        truncate 
                                    />
                                ))}
                                <div className="h-px bg-slate-100 my-1" />
                            </>
                        )}

                        <DropdownItem onClick={onPromptMorph} icon={<Wand2 size={18}/>} label="New rebuild" title="Use AI Magic to turn these exact same blocks into anything you can imagine!" highlight />
                     </DropdownMenu>
                </div>
            )}

            {/* STATE 3: BUILD MODE TIP */}
            {isBuildMode && (
                <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border border-slate-200 shadow-lg text-slate-600 font-bold text-sm animate-in slide-in-from-bottom-5 duration-300" title="You are now the architect! Use the tools on the left to build your masterpiece.">
                    <span className="text-emerald-500 mr-2">Build Mode Active:</span> Click to place or remove blocks!
                </div>
            )}
        </div>
      </div>

    </div>
  );
};

// --- Sub-Components ---

const ToolIcon: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: 'blue' | 'rose' | 'emerald', title?: string}> = ({ active, onClick, icon, label, color, title }) => {
    const colors = {
        blue: active ? 'bg-blue-500 text-white shadow-blue-200' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-500',
        rose: active ? 'bg-rose-500 text-white shadow-rose-200' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-500',
        emerald: active ? 'bg-emerald-500 text-white shadow-emerald-200' : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-500'
    };

    return (
        <button 
            onClick={onClick}
            title={title}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all ${colors[color]} ${active ? 'scale-110 shadow-lg' : 'scale-100'}`}
        >
            {icon}
            <span className="text-[9px] font-black uppercase mt-1 tracking-tighter">{label}</span>
        </button>
    );
};

interface TactileButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  color: 'slate' | 'rose' | 'sky' | 'emerald' | 'amber' | 'indigo';
  compact?: boolean;
  title?: string;
}

const TactileButton: React.FC<TactileButtonProps> = ({ onClick, disabled, icon, label, color, compact, title }) => {
  const colorStyles = {
    slate:   'bg-slate-200 text-slate-600 shadow-slate-300 hover:bg-slate-300',
    rose:    'bg-rose-500 text-white shadow-rose-700 hover:bg-rose-600',
    sky:     'bg-sky-500 text-white shadow-sky-700 hover:bg-sky-600',
    emerald: 'bg-emerald-500 text-white shadow-emerald-700 hover:bg-emerald-600',
    amber:   'bg-amber-400 text-amber-900 shadow-amber-600 hover:bg-amber-500',
    indigo:  'bg-indigo-500 text-white shadow-indigo-700 hover:bg-indigo-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`
        group relative flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all duration-100
        border-b-[4px] active:border-b-0 active:translate-y-[4px]
        ${compact ? 'p-2.5' : 'px-4 py-3'}
        ${disabled 
          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed shadow-none' 
          : `${colorStyles[color]} border-black/20 shadow-lg`}
      `}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
};

const BigActionButton: React.FC<{onClick: () => void, icon: React.ReactNode, label: string, color: 'rose', title?: string}> = ({ onClick, icon, label, color, title }) => {
    return (
        <button 
            onClick={onClick}
            title={title || label}
            className="group relative flex flex-col items-center justify-center w-32 h-32 rounded-3xl bg-rose-500 hover:bg-rose-600 text-white shadow-xl shadow-rose-900/30 border-b-[8px] border-rose-800 active:border-b-0 active:translate-y-[8px] transition-all duration-150"
        >
            <div className="mb-2">{icon}</div>
            <div className="text-sm font-black tracking-wider">{label}</div>
        </button>
    )
}

interface DropdownProps {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    color: 'indigo' | 'emerald';
    direction?: 'up' | 'down';
    big?: boolean;
    title?: string;
}

const DropdownMenu: React.FC<DropdownProps> = ({ icon, label, children, color, direction = 'down', big, title }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const bgClass = color === 'indigo' ? 'bg-indigo-500 hover:bg-indigo-600 border-indigo-800' : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-800';

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                title={title || label}
                className={`
                    flex items-center gap-2 font-bold text-white shadow-lg rounded-2xl transition-all active:scale-95
                    ${bgClass}
                    ${big ? 'px-8 py-4 text-lg border-b-[6px] active:border-b-0 active:translate-y-[6px]' : 'px-4 py-3 text-sm border-b-[4px] active:border-b-0 active:translate-y-[4px]'}
                `}
            >
                {icon}
                {label}
                <ChevronUp size={16} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${direction === 'down' ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className={`
                    absolute left-0 ${direction === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'} 
                    w-56 max-h-[60vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border-2 border-slate-100 p-2 flex flex-col gap-1 animate-in fade-in zoom-in duration-200 z-50
                `}>
                    {children}
                </div>
            )}
        </div>
    )
}

const DropdownItem: React.FC<{ onClick: () => void, icon: React.ReactNode, label: string, highlight?: boolean, truncate?: boolean, title?: string }> = ({ onClick, icon, label, highlight, truncate, title }) => {
    return (
        <button 
            onClick={onClick}
            title={title || label}
            className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-colors text-left
                ${highlight 
                    ? 'bg-gradient-to-r from-sky-50 to-blue-50 text-sky-600 hover:from-sky-100 hover:to-blue-100' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
            `}
        >
            <div className="shrink-0">{icon}</div>
            <span className={truncate ? "truncate w-full" : ""}>{label}</span>
        </button>
    )
}
