import React, { useState } from 'react';
import { Upload, Music, Wand2, ArrowRight, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { SongData, VisualData, AiGenerationState } from './types';
import Editor from './components/Editor';
import { generateCaption, generateCoverImage } from './services/geminiService';

function App() {
  const [songData, setSongData] = useState<SongData>({ file: null, url: null, name: '' });
  const [visualData, setVisualData] = useState<VisualData>({ backgroundImage: null, caption: '' });
  const [step, setStep] = useState<number>(1); // 1: Upload, 2: Customize, 3: Editor
  const [aiState, setAiState] = useState<AiGenerationState>({
    isGeneratingImage: false,
    isGeneratingCaption: false,
    error: null,
  });
  const [mood, setMood] = useState<string>('');

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSongData({ file, url, name: file.name.replace(/\.[^/.]+$/, "") });
      setStep(2);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setVisualData(prev => ({ ...prev, backgroundImage: ev.target!.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiGeneration = async () => {
    if (!mood) return;
    setAiState({ isGeneratingCaption: true, isGeneratingImage: true, error: null });

    try {
      // Parallel execution for speed
      const [image, caption] = await Promise.all([
        generateCoverImage(mood),
        generateCaption(songData.name, mood)
      ]);

      setVisualData({
        backgroundImage: image,
        caption: caption
      });
    } catch (err) {
      setAiState(prev => ({ ...prev, error: "Falha ao gerar conteúdo IA. Verifique sua chave API." }));
    } finally {
      setAiState({ isGeneratingCaption: false, isGeneratingImage: false, error: null });
    }
  };

  const reset = () => {
    setSongData({ file: null, url: null, name: '' });
    setVisualData({ backgroundImage: null, caption: '' });
    setStep(1);
    setMood('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-green-500 selection:text-black">
      {/* Header */}
      <header className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/80 backdrop-blur z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
           <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
             <Music className="text-black w-5 h-5" />
           </div>
           <h1 className="text-xl font-bold tracking-tight">StatusBeat</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 flex flex-col items-center">
        
        {/* Step 1: Upload Audio */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center w-full max-w-xl text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
              Transforme sua música em Status
            </h2>
            <p className="text-gray-400 text-lg">
              Carregue um arquivo de áudio e crie um vídeo visual incrível para o WhatsApp.
            </p>

            <label className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/50 hover:bg-slate-800/50 hover:border-green-500 transition-all cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center justify-center pt-5 pb-6 z-10">
                <div className="p-4 bg-slate-800 rounded-full mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-green-400" />
                </div>
                <p className="mb-2 text-lg font-semibold text-slate-200">Clique para enviar música</p>
                <p className="text-sm text-slate-500">MP3, WAV (Max 10MB)</p>
              </div>
              <input type="file" className="hidden" accept="audio/*" onChange={handleAudioUpload} />
            </label>
          </div>
        )}

        {/* Step 2: Customize Visuals */}
        {step === 2 && (
          <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 animate-in slide-in-from-right duration-500">
            
            {/* Left Col: Settings */}
            <div className="space-y-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Music className="w-5 h-5 text-green-400" /> 
                  Música Selecionada
                </h3>
                <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
                  <span className="truncate flex-1 font-medium text-slate-200">{songData.name}</span>
                  <button onClick={reset} className="text-red-400 hover:text-red-300 p-2"><X className="w-4 h-4"/></button>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-400" /> 
                  IA Mágica (Opcional)
                </h3>
                <p className="text-slate-400 text-sm">
                  Descreva o "vibe" da música e deixe nossa IA criar a capa e a legenda perfeita.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ex: Triste, Chuvoso, Amor, Festa na praia..." 
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 transition"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                  />
                  <button 
                    onClick={handleAiGeneration}
                    disabled={aiState.isGeneratingImage || !mood}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    {aiState.isGeneratingImage ? <Loader2 className="animate-spin w-4 h-4"/> : <Wand2 className="w-4 h-4"/>}
                    Gerar
                  </button>
                </div>
                {aiState.error && <p className="text-red-400 text-sm">{aiState.error}</p>}
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-400" /> 
                  Manual (Upload)
                </h3>
                <label className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-slate-400"/>
                </label>
                <input 
                  type="text"
                  placeholder="Legenda personalizada..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 transition"
                  value={visualData.caption}
                  onChange={(e) => setVisualData(prev => ({...prev, caption: e.target.value}))}
                />
              </div>

              <button 
                onClick={() => setStep(3)}
                className="w-full py-4 bg-green-500 hover:bg-green-400 text-black font-bold text-lg rounded-xl shadow-lg shadow-green-900/20 transition transform active:scale-98 flex items-center justify-center gap-2"
              >
                Continuar para o Estúdio <ArrowRight className="w-5 h-5"/>
              </button>
            </div>

            {/* Right Col: Preview */}
            <div className="flex flex-col items-center justify-start space-y-4 sticky top-24">
               <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Preview de Imagem</span>
               <div className="w-[270px] h-[480px] bg-black rounded-lg border border-slate-700 shadow-2xl relative overflow-hidden flex items-center justify-center">
                  {aiState.isGeneratingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin"/>
                      <span className="text-xs text-purple-400">Criando arte...</span>
                    </div>
                  ) : visualData.backgroundImage ? (
                    <>
                      <img src={visualData.backgroundImage} alt="Background" className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                         <h2 className="text-white font-bold text-xl drop-shadow-lg text-center">{songData.name}</h2>
                         <p className="text-slate-200 text-sm mt-2 text-center drop-shadow">{visualData.caption}</p>
                         <div className="mt-8 w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                           <div className="w-1/2 h-full bg-green-500"></div>
                         </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-600 text-sm text-center px-4">
                      Carregue uma imagem ou gere com IA para ver o preview aqui.
                    </div>
                  )}
               </div>
            </div>

          </div>
        )}

        {/* Step 3: Editor & Recording */}
        {step === 3 && (
          <div className="w-full animate-in fade-in duration-500">
             <Editor 
                songData={songData} 
                visualData={visualData} 
                onBack={() => setStep(2)} 
             />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
