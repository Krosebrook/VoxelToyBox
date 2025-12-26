
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { VoxelEngine } from './services/VoxelEngine';
import { UIOverlay } from './components/UIOverlay';
import { JsonModal } from './components/JsonModal';
import { PromptModal } from './components/PromptModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Generators } from './utils/voxelGenerators';
import { AppState, AppMode, VoxelData, SavedModel, GroundingSource, BuildTool, VoxelMaterial } from './types';
import { GoogleGenAI, Type } from "@google/genai";

const STORAGE_KEY = 'voxel_toybox_saved_models';

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  
  const [appState, setAppState] = useState<AppState>(AppState.STABLE);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.VIEW);
  const [buildTool, setBuildTool] = useState<BuildTool>('pencil');
  const [selectedColor, setSelectedColor] = useState<number>(0x3b82f6);
  const [selectedMaterial, setSelectedMaterial] = useState<VoxelMaterial>(VoxelMaterial.MATTE);

  const [voxelCount, setVoxelCount] = useState<number>(0);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalMode, setJsonModalMode] = useState<'view' | 'import'>('view');
  
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<'create' | 'morph'>('create');
  
  const [showWelcome, setShowWelcome] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [jsonData, setJsonData] = useState('');
  const [isAutoRotate, setIsAutoRotate] = useState(true);

  // History State
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Models state
  const [currentBaseModel, setCurrentBaseModel] = useState<string>('Eagle');
  const [customBuilds, setCustomBuilds] = useState<SavedModel[]>([]);
  const [customRebuilds, setCustomRebuilds] = useState<SavedModel[]>([]);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);

  // Load from Storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const { builds, rebuilds } = JSON.parse(saved);
            setCustomBuilds(builds || []);
            setCustomRebuilds(rebuilds || []);
        } catch (e) { console.error("Persistence load error", e); }
    }
  }, []);

  // Sync to Storage
  useEffect(() => {
    if (customBuilds.length > 0 || customRebuilds.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ 
            builds: customBuilds, 
            rebuilds: customRebuilds 
        }));
    }
  }, [customBuilds, customRebuilds]);

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = isMac ? e.metaKey : e.ctrlKey;

        if (cmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
        }
        if ((cmd && e.shiftKey && e.key.toLowerCase() === 'z') || (cmd && e.key.toLowerCase() === 'y')) {
            e.preventDefault();
            handleRedo();
        }
        if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey) {
            handleToggleMode();
        }
        if (appMode === AppMode.BUILD) {
            if (e.key === '1') handleSetTool('pencil');
            if (e.key === '2') handleSetTool('eraser');
            if (e.key === '3') handleSetTool('picker');
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, canUndo, canRedo]);

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
      (u, r) => { setCanUndo(u); setCanRedo(r); }
    );

    engineRef.current = engine;
    engine.loadInitialModel(Generators.Eagle());

    const handleResize = () => engine.handleResize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => setShowWelcome(false), 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      engine.cleanup();
    };
  }, []);

  const handleToggleMode = () => {
      const newMode = appMode === AppMode.VIEW ? AppMode.BUILD : AppMode.VIEW;
      setAppMode(newMode);
      engineRef.current?.setMode(newMode);
      if (newMode === AppMode.BUILD && isAutoRotate) handleToggleRotation();
  };

  const handleSetTool = (tool: BuildTool) => {
      setBuildTool(tool);
      engineRef.current?.setTool(tool);
  };

  const handleSetMaterial = (mat: VoxelMaterial) => {
      setSelectedMaterial(mat);
      engineRef.current?.setBuildProps(selectedColor, mat);
  };

  const handleSetColor = (color: number) => {
      setSelectedColor(color);
      engineRef.current?.setBuildProps(color, selectedMaterial);
  };

  const handleUndo = () => engineRef.current?.undo();
  const handleRedo = () => engineRef.current?.redo();
  const handleDismantle = () => engineRef.current?.dismantle();

  const handleNewScene = (type: 'Eagle') => {
    const generator = Generators[type];
    if (generator && engineRef.current) {
      engineRef.current.loadInitialModel(generator());
      setCurrentBaseModel('Eagle');
      setGroundingSources([]);
    }
  };

  const handleRefresh = () => {
    if (!engineRef.current) return;
    // Check if current base model is a preset
    if (currentBaseModel === 'Eagle') {
        engineRef.current.loadInitialModel(Generators.Eagle());
    } else {
        // Find in custom builds
        const custom = customBuilds.find(b => b.name === currentBaseModel);
        if (custom) {
            engineRef.current.loadInitialModel(custom.data);
        } else {
            // Default fallback
            engineRef.current.loadInitialModel(Generators.Eagle());
        }
    }
  };

  const handleSelectCustomBuild = (model: SavedModel) => {
      if (engineRef.current) {
          engineRef.current.loadInitialModel(model.data);
          setCurrentBaseModel(model.name);
          setGroundingSources([]);
      }
  };

  const handleRebuild = (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => {
    const generator = Generators[type];
    if (generator && engineRef.current) {
      engineRef.current.rebuild(generator());
    }
  };

  const handleSelectCustomRebuild = (model: SavedModel) => {
      if (engineRef.current) engineRef.current.rebuild(model.data);
  };

  const handleShowJson = () => {
    if (engineRef.current) {
      setJsonData(engineRef.current.getJsonData());
      setJsonModalMode('view');
      setIsJsonModalOpen(true);
    }
  };

  const handleImportClick = () => {
      setJsonModalMode('import');
      setIsJsonModalOpen(true);
  };

  const handleSnapshot = () => {
      if (!engineRef.current) return;
      const dataUrl = engineRef.current.takeSnapshot();
      const link = document.createElement('a');
      link.download = `voxel-creation-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
  };

  const handleJsonImport = (jsonStr: string) => {
      try {
          const rawData = JSON.parse(jsonStr);
          const voxelData: VoxelData[] = rawData.map((v: any) => {
              let colorVal = v.c || v.color;
              let colorInt = 0xCCCCCC;
              if (typeof colorVal === 'string') {
                  if (colorVal.startsWith('#')) colorVal = colorVal.substring(1);
                  colorInt = parseInt(colorVal, 16);
              } else if (typeof colorVal === 'number') colorInt = colorVal;

              return {
                  x: Number(v.x) || 0,
                  y: Number(v.y) || 0,
                  z: Number(v.z) || 0,
                  color: isNaN(colorInt) ? 0xCCCCCC : colorInt,
                  material: v.material ?? VoxelMaterial.MATTE
              };
          });
          if (engineRef.current) {
              engineRef.current.loadInitialModel(voxelData);
              setCurrentBaseModel('Imported Build');
              setGroundingSources([]);
          }
      } catch (e) {
          alert("Import failed. Check JSON format.");
      }
  };

  const handlePromptSubmit = async (prompt: string) => {
    if (!process.env.API_KEY) throw new Error("API Key not found");
    setIsGenerating(true);
    setGroundingSources([]);
    setIsPromptModalOpen(false);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const model = 'gemini-3-pro-preview';
        const systemContext = `Voxel builder. Output JSON list of {x, y, z, color(hex), material(0:Matte, 1:Metal, 2:Glow)}. MAX 800 voxels. Focus on aesthetics. Model: "${prompt}".`;

        const response = await ai.models.generateContent({
            model,
            contents: systemContext,
            config: {
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
                            material: { type: Type.INTEGER, description: "0:Matte, 1:Metal, 2:Glow" }
                        },
                        required: ["x", "y", "z", "color"]
                    }
                }
            }
        });

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
            setGroundingSources(chunks.filter(c => c.web).map(c => ({ title: c.web.title || 'Source', uri: c.web.uri })));
        }

        if (response.text) {
            const rawData = JSON.parse(response.text);
            const voxelData: VoxelData[] = rawData.map((v: any) => ({
                x: v.x, y: v.y, z: v.z, 
                color: parseInt(v.color.replace('#', ''), 16),
                material: v.material ?? VoxelMaterial.MATTE
            }));
            if (engineRef.current) {
                if (promptMode === 'create') {
                    engineRef.current.loadInitialModel(voxelData);
                    setCustomBuilds(p => [...p, { name: prompt, data: voxelData, timestamp: Date.now() }]);
                    setCurrentBaseModel(prompt);
                } else {
                    engineRef.current.rebuild(voxelData);
                    setCustomRebuilds(p => [...p, { name: prompt, data: voxelData, baseModel: currentBaseModel, timestamp: Date.now() }]);
                }
            }
        }
    } catch (err) {
        alert("Generation failed!");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleToggleRotation = () => {
      const newState = !isAutoRotate;
      setIsAutoRotate(newState);
      engineRef.current?.setAutoRotate(newState);
  }

  return (
    <div className="relative w-full h-screen bg-[#f0f2f5] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      
      <UIOverlay 
        voxelCount={voxelCount}
        appState={appState}
        appMode={appMode}
        buildTool={buildTool}
        selectedColor={selectedColor}
        selectedMaterial={selectedMaterial}
        currentBaseModel={currentBaseModel}
        customBuilds={customBuilds}
        customRebuilds={customRebuilds.filter(r => r.baseModel === currentBaseModel)} 
        isAutoRotate={isAutoRotate}
        isInfoVisible={showWelcome}
        isGenerating={isGenerating}
        groundingSources={groundingSources}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSnapshot={handleSnapshot}
        onDismantle={handleDismantle}
        onRebuild={handleRebuild}
        onNewScene={handleNewScene}
        onRefresh={handleRefresh}
        onSelectCustomBuild={handleSelectCustomBuild}
        onSelectCustomRebuild={handleSelectCustomRebuild}
        onPromptCreate={() => {setPromptMode('create'); setIsPromptModalOpen(true);}}
        onPromptMorph={() => {setPromptMode('morph'); setIsPromptModalOpen(true);}}
        onShowJson={handleShowJson}
        onImportJson={handleImportClick}
        onToggleRotation={handleToggleRotation}
        onToggleInfo={() => setShowWelcome(!showWelcome)}
        onToggleMode={handleToggleMode}
        onSetTool={handleSetTool}
        onSetMaterial={handleSetMaterial}
        onSetColor={handleSetColor}
      />

      <WelcomeScreen visible={showWelcome} />
      <JsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} data={jsonData} isImport={jsonModalMode === 'import'} onImport={handleJsonImport} />
      <PromptModal isOpen={isPromptModalOpen} mode={promptMode} onClose={() => setIsPromptModalOpen(false)} onSubmit={handlePromptSubmit} />
    </div>
  );
};

export default App;
