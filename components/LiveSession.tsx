import React, { useEffect, useRef, useState } from 'react';
import { connectLiveSession } from '../services/geminiService';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/audioService';

interface LiveSessionProps {
  isActive: boolean;
  stream: MediaStream | null;
  onClose: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ isActive, stream, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [volume, setVolume] = useState(0); // For visualizer
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    if (isActive && stream && status === 'idle') {
      startSession();
    } else if (!isActive && status === 'connected') {
      stopSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, stream]);

  const startSession = async () => {
    if (!stream) return;
    try {
      setStatus('connecting');
      
      // 1. Setup Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 24000 }); // Output rate
      audioContextRef.current = ctx;

      // Input Context (16kHz required by Gemini)
      // Note: createMediaStreamSource usually handles resampling if hardware doesn't support 16k natively
      const inputCtx = new AudioContextClass({ sampleRate: 16000 }); 
      
      // 2. Connect to Gemini Live
      const sessionPromise = connectLiveSession(
        (base64Audio) => playAudioChunk(base64Audio, ctx),
        () => setStatus('idle'),
        (err) => {
            console.error("Session Error", err);
            setStatus('error');
        }
      ).catch(err => {
          console.error("Connection Failed", err);
          setStatus('error');
          throw err;
      });
      
      sessionRef.current = sessionPromise; // Store promise to chain sends

      // 3. Setup Input Processing
      const source = inputCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Simple visualizer calc
        let sum = 0;
        for(let i=0; i<inputData.length; i++) sum += Math.abs(inputData[i]);
        setVolume(Math.min((sum / inputData.length) * 500, 100)); // Normalize roughly

        const pcmBlob = createPcmBlob(inputData);
        
        // Send to Gemini
        sessionPromise.then((session: any) => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(processor);
      processor.connect(inputCtx.destination); // Required for script processor to run

      setStatus('connected');

    } catch (err) {
      console.error("Failed to start live session", err);
      setStatus('error');
    }
  };

  const playAudioChunk = async (base64: string, ctx: AudioContext) => {
    try {
        const audioData = base64ToUint8Array(base64);
        const buffer = await decodeAudioData(audioData, ctx);
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        const now = ctx.currentTime;
        // Schedule next chunk
        const start = Math.max(now, nextStartTimeRef.current);
        source.start(start);
        nextStartTimeRef.current = start + buffer.duration;
        
    } catch (e) {
        console.error("Error decoding audio chunk", e);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
        sessionRef.current.then((s: any) => s.close());
    }
    if (processorRef.current) processorRef.current.disconnect();
    if (inputSourceRef.current) inputSourceRef.current.disconnect(); 
    // Do NOT stop tracks here, as stream is owned by parent
    
    if (audioContextRef.current) audioContextRef.current.close();
    
    setStatus('idle');
    onClose();
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
      <div className="bg-eng-panel border border-eng-accent/30 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center text-center shadow-2xl shadow-eng-accent/20">
        
        <div className="relative mb-8">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-100
                ${status === 'connected' ? 'bg-eng-accent/20' : 'bg-slate-700'}
            `} style={{ transform: `scale(${1 + volume/200})` }}>
                <i className={`fas fa-microphone text-4xl ${status === 'connected' ? 'text-eng-accent' : 'text-slate-400'}`}></i>
            </div>
            {status === 'connecting' && (
                <div className="absolute inset-0 rounded-full border-4 border-eng-accent border-t-transparent animate-spin"></div>
            )}
        </div>

        <h3 className="text-xl font-bold text-white mb-2">Live Voice Mode</h3>
        <p className="text-slate-400 mb-6 text-sm">
           {status === 'connecting' ? 'Establishing secure link...' : 
            status === 'error' ? 'Connection Failed.' : 
            'Conversational AI Active. Speak now.'}
        </p>

        <button 
            onClick={stopSession}
            className="px-6 py-2 rounded-full bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-colors"
        >
            End Session
        </button>
      </div>
    </div>
  );
};

export default LiveSession;