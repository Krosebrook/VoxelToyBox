
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VoxelEngine } from './services/VoxelEngine';
import { UIOverlay } from './components/UIOverlay';
import { JsonModal } from './components/JsonModal';
import { PromptModal } from './components/PromptModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Generators } from './utils/voxelGenerators';
import { AppState, AppMode, VoxelData, SavedModel, GroundingSource, BuildTool, VoxelMaterial, CustomColor } from './types';
import { CONFIG } from './utils/voxelConstants';
import { GoogleGenAI, Type } from "@google/genai";
import { Search } from 'lucide-react';

const STORAGE_KEY = 'voxel_toybox_saved_models';
const PALETTE_KEY = 'voxel_toybox_custom_palette';
const AUTO_SAVE_KEY = 'voxel_toybox_current_draft';

/**
 * Root Application component. Manages UI state, interaction handlers, 
 * persistence, and calls to the VoxelEngine.
 */
const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  
  // App UI State
  const [appState, setAppState] = useState<AppState>(AppState.STABLE);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.VIEW);
  const [buildTool, setBuildTool] = useState<BuildTool>('pencil');
  const [selectedColor, setSelectedColor] = useState<number>(0x3b82f6);
  const [selectedMaterial, setSelectedMaterial] = useState<VoxelMaterial>(VoxelMaterial.MATTE);
  const [voxelSize, setVoxelSize] = useState<number>(CONFIG.VOXEL_SIZE);
  const [isMirrorMode, setIsMirrorMode] = useState(false);

  // Selection State
  const [selectedCount, setSelectedCount] = useState(0);

  // Custom Palette state
  const [customPalette, setCustomPalette] = useState<CustomColor[]>([]);

  // Stats & Modals
  const [voxelCount, setVoxelCount] = useState<number>(0);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalMode, setJsonModalMode] = useState<'view' | 'import'>('view');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<'create' | 'morph'>('create');
  
  // UX State
  const [showWelcome, setShowWelcome] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jsonData, setJsonData] = useState('');
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [lastSaveTime, setLastSaveTime] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // History Tracking
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Content state
  const [currentBaseModel, setCurrentBaseModel] = useState<string>('Eagle');
  const [customBuilds, setCustomBuilds] = useState<SavedModel[]>([]);
  const [customRebuilds, setCustomRebuilds] = useState<SavedModel[]>([]);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);

  /** Load persistent library and palette from storage on mount. */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const { builds, rebuilds } = JSON.parse(saved);
            setCustomBuilds(builds || []);
            setCustomRebuilds(rebuilds || []);
        } catch (e) { console.error("Library load error", e); }
    }

    const savedPalette = localStorage.getItem(PALETTE_KEY);
    if (savedPalette) {
      try {
        setCustomPalette(JSON.parse(savedPalette));
      } catch (e) { console.error("Palette load error", e); }
    }
    
    // Check for API key presence
    const checkKey = async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            const selected = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(selected);
        }
    };
    checkKey();
  }, []);

  /** Sync library to storage when it changes. */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
        builds: customBuilds, 
        rebuilds: customRebuilds 
    }));
  }, [customBuilds, customRebuilds]);

  /** Sync palette to storage when it changes. */
  useEffect(() => {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(customPalette));
  }, [customPalette]);

  /** Persistence: Save the current canvas draft. */
  const performAutoSave = useCallback(() => {
    if (!engineRef.current) return;
    const data = engineRef.current.getVoxelData();
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
    setLastSaveTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, []);

  /** Debounced auto-save on change. */
  useEffect(() => {
    if (voxelCount > 0) {
      const timer = setTimeout(performAutoSave, 2000);
      return () => clearTimeout(timer);
    }
  }, [voxelCount, performAutoSave]);

  /** Fallback periodic save. */
  useEffect(() => {
    const interval = setInterval(performAutoSave, 120000);
    return () => clearInterval(interval);
  }, [performAutoSave]);

  /** Global keybindings for building and navigation. */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = isMac ? e.metaKey : e.ctrlKey;

        if (cmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault(); engineRef.current?.undo();
        }
        if ((cmd && e.shiftKey && e.key.toLowerCase() === 'z') || (cmd && e.key.toLowerCase() === 'y')) {
            e.preventDefault(); engineRef.current?.redo();
        }
        if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
            handleToggleMode();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, isAutoRotate]);

  /** Core Engine Initialization. */
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new VoxelEngine(
      containerRef.current,
      (newState) => setAppState(newState),
      (count) => setVoxelCount(count),
      (color, mat) => {
          setSelectedColor(color);
          setSelectedMaterial(mat);
          engineRef.current?.setBuildProps(color, mat);
      },
      (u, r) => { setCanUndo(u); setCanRedo(r); },
      (selected) => setSelectedCount(selected)
    );

    engineRef.current = engine;
    
    // Load recovery draft or default
    const recovered = localStorage.getItem(AUTO_SAVE_KEY);
    if (recovered) {
      try {
        engine.loadInitialModel(JSON.parse(recovered));
        setCurrentBaseModel('Recovered Draft');
      } catch (e) { engine.loadInitialModel(Generators.Eagle()); }
    } else { engine.loadInitialModel(Generators.Eagle()); }

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => setShowWelcome(false), 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      engine.cleanup();
    };
  }, []);

  // --- UI Handlers ---

  const handleToggleMode = () => {
      const newMode = appMode === AppMode.VIEW ? AppMode.BUILD : AppMode.VIEW;
      setAppMode(newMode);
      engineRef.current?.setMode(newMode);
      if (newMode === AppMode.BUILD && isAutoRotate) handleToggleRotation();
  };

  const handleToggleRotation = () => {
      const newState = !isAutoRotate;
      setIsAutoRotate(newState);
      engineRef.current?.setAutoRotate(newState);
  };

  const handleSaveCurrent = () => {
    if (!engineRef.current) return;
    const name = window.prompt("Enter a name for your build:", currentBaseModel || "My Build");
    if (name?.trim()) {
      const newModel: SavedModel = { name: name.trim(), data: engineRef.current.getVoxelData(), timestamp: Date.now() };
      setCustomBuilds(prev => [...prev.filter(b => b.name !== newModel.name), newModel]);
      setCurrentBaseModel(newModel.name);
      performAutoSave();
    }
  };

  const handleSaveColor = (color: number) => {
    const defaultName = `Color #${color.toString(16).padStart(6, '0')}`;
    const name = window.prompt("Enter a name for this color:", defaultName);
    if (name?.trim()) {
      const newColor: CustomColor = { name: name.trim(), hex: color };
      setCustomPalette(prev => [...prev, newColor]);
    }
  };

  const handleDeleteColor = (index: number) => {
    setCustomPalette(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectApiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handlePromptSubmit = async (prompt: string) => {
    // Ensure API Key selection if not already marked as present
    if (!hasApiKey && window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        if (!selected) {
            await handleSelectApiKey();
        }
    }

    setIsGenerating(true);
    setGroundingSources([]);
    setIsPromptModalOpen(false);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `You are a Voxel Architecture Expert.
Output a JSON array of voxel objects.
EACH OBJECT MUST HAVE:
- x, y, z: integers (the grid coordinates)
- color: string hex code (e.g., "#3b82f6")
- material: integer (0=Matte, 1=Metal, 2=Glow)

Rules:
- Generate 300-600 voxels.
- Be creative and detailed.
- Use materials effectively (e.g., metal for machine parts, glow for eyes).
- Focus on clear, iconic silhouettes.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction,
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            x: { type: Type.INTEGER },
                            y: { type: Type.INTEGER },
                            z: { type: Type.INTEGER },
                            color: { type: Type.STRING },
                            material: { type: Type.INTEGER }
                        },
                        required: ["x", "y", "z", "color"]
                    }
                }
            }
        });

        // Handle Search Grounding Sources
        const meta = response.candidates?.[0]?.groundingMetadata;
        if (meta?.groundingChunks) {
            const sources = meta.groundingChunks
                .filter(chunk => chunk.web)
                .map(chunk => ({
                    title: chunk.web.title || 'Source',
                    uri: chunk.web.uri
                }));
            setGroundingSources(sources);
        }

        if (response.text) {
            // Clean markdown if present
            let cleanedJson = response.text.trim();
            if (cleanedJson.startsWith('```')) {
                cleanedJson = cleanedJson.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
            }
            
            const parsed = JSON.parse(cleanedJson);
            const data: VoxelData[] = parsed.map((v: any) => ({
                x: Number(v.x), 
                y: Number(v.y), 
                z: Number(v.z), 
                color: typeof v.color === 'string' ? parseInt(v.color.replace('#', ''), 16) : Number(v.color),
                material: v.material ?? VoxelMaterial.MATTE
            }));
            
            if (promptMode === 'create') {
                engineRef.current?.loadInitialModel(data);
                setCustomBuilds(p => [...p, { name: prompt, data, timestamp: Date.now() }]);
                setCurrentBaseModel(prompt);
            } else {
                if (appState === AppState.STABLE) {
                    engineRef.current?.dismantle();
                    setTimeout(() => engineRef.current?.rebuild(data), 600);
                } else {
                    engineRef.current?.rebuild(data);
                }
                setCustomRebuilds(p => [...p, { name: prompt, data, baseModel: currentBaseModel, timestamp: Date.now() }]);
            }
        }
    } catch (err: any) { 
        console.error("AI Generation Error:", err);
        if (err.message?.includes("Requested entity was not found")) {
            setHasApiKey(false);
            alert("Model access error. Please re-select a paid API key via the key dialog.");
            handleSelectApiKey();
        } else {
            alert("Gemini failed to architect your idea. Please try a simpler concept."); 
        }
    } finally { 
        setIsGenerating(false); 
    }
  };

  const handleToggleMirror = () => {
    const newState = !isMirrorMode;
    setIsMirrorMode(newState);
    engineRef.current?.setMirrorMode(newState);
  };

  return (
    <div className="relative w-full h-screen bg-[#f0f2f5] overflow-hidden antialiased">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      <UIOverlay 
        voxelCount={voxelCount} appState={appState} appMode={appMode}
        buildTool={buildTool} selectedColor={selectedColor} selectedMaterial={selectedMaterial}
        voxelSize={voxelSize}
        currentBaseModel={currentBaseModel} customBuilds={customBuilds}
        customRebuilds={customRebuilds.filter(r => r.baseModel === currentBaseModel)} 
        customPalette={customPalette}
        selectedCount={selectedCount}
        isAutoRotate={isAutoRotate} isInfoVisible={showWelcome} isGenerating={isGenerating}
        groundingSources={groundingSources} canUndo={canUndo} canRedo={canRedo} lastSaveTime={lastSaveTime}
        isMirrorMode={isMirrorMode}
        onUndo={() => engineRef.current?.undo()} onRedo={() => engineRef.current?.redo()}
        onSnapshot={() => {
            const link = document.createElement('a');
            link.download = `voxel-${Date.now()}.png`; link.href = engineRef.current?.takeSnapshot() || '';
            link.click();
        }}
        onDismantle={() => engineRef.current?.dismantle()}
        onRebuild={(t) => engineRef.current?.rebuild(Generators[t]())}
        onNewScene={(t) => { engineRef.current?.loadInitialModel(Generators[t]()); setCurrentBaseModel(t); }}
        onRefresh={() => {
            const target = customBuilds.find(b => b.name === currentBaseModel);
            engineRef.current?.loadInitialModel(target ? target.data : Generators.Eagle());
        }}
        onSaveCurrent={handleSaveCurrent}
        onSaveColor={handleSaveColor}
        onDeleteColor={handleDeleteColor}
        onSelectCustomBuild={(m) => { engineRef.current?.loadInitialModel(m.data); setCurrentBaseModel(m.name); }}
        onSelectCustomRebuild={(m) => engineRef.current?.rebuild(m.data)}
        onPromptCreate={() => {setPromptMode('create'); setIsPromptModalOpen(true);}}
        onPromptMorph={() => {setPromptMode('morph'); setIsPromptModalOpen(true);}}
        onShowJson={() => { setJsonData(engineRef.current?.getJsonData() || ''); setJsonModalMode('view'); setIsJsonModalOpen(true); }}
        onImportJson={() => { setJsonModalMode('import'); setIsJsonModalOpen(true); }}
        onToggleRotation={handleToggleRotation} onToggleInfo={() => setShowWelcome(!showWelcome)}
        onToggleMode={handleToggleMode}
        onToggleMirror={handleToggleMirror}
        onSetTool={(t) => { setBuildTool(t); engineRef.current?.setTool(t); }}
        onSetMaterial={(m) => { setSelectedMaterial(m); engineRef.current?.setBuildProps(selectedColor, m); }}
        onSetColor={(c) => { setSelectedColor(c); engineRef.current?.setBuildProps(c, selectedMaterial); }}
        onSetVoxelSize={(s) => { setVoxelSize(s); engineRef.current?.setVoxelSize(s); }}
        onDeleteSelected={() => engineRef.current?.deleteSelected()}
        onCopySelected={() => engineRef.current?.copySelected()}
        onMoveSelected={(a, d) => engineRef.current?.moveSelected(a, d)}
      />

      <WelcomeScreen visible={showWelcome} />
      <JsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} data={jsonData} isImport={jsonModalMode === 'import'} 
        onImport={(s) => {
            const data: VoxelData[] = JSON.parse(s).map((v: any) => ({
                x: +v.x, y: +v.y, z: +v.z, color: parseInt(v.color.replace('#', ''), 16), material: v.material ?? 0
            }));
            engineRef.current?.loadInitialModel(data); setCurrentBaseModel('Imported Build');
        }} 
      />
      <PromptModal isOpen={isPromptModalOpen} mode={promptMode} onClose={() => setIsPromptModalOpen(false)} onSubmit={handlePromptSubmit} />

      {/* Search Grounding Display */}
      {groundingSources.length > 0 && (
          <div className="absolute bottom-6 right-6 w-72 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-4 animate-in slide-in-from-bottom-4 pointer-events-auto z-40 max-h-[30vh] overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Search size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Research Sources</span>
              </div>
              <div className="flex flex-col gap-2">
                  {groundingSources.map((s, idx) => (
                      <a 
                        key={idx} 
                        href={s.uri} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:underline flex items-center gap-2 group truncate"
                      >
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 group-hover:bg-indigo-500 shrink-0" />
                          <span className="truncate">{s.title}</span>
                      </a>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
