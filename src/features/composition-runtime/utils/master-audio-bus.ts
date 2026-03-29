/**
 * Master Audio Bus
 * 
 * Creates a centralized Web Audio API graph to measure and route all editor audio.
 * Graph: [All Source Nodes] -> masterGain -> masterAnalyser -> destination
 * 
 * This enables global VU meters, peak detection, and global volume control.
 */

let masterAudioContext: AudioContext | null = null;
let masterAnalyser: AnalyserNode | null = null;
let masterGain: GainNode | null = null;

export function getMasterAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!masterAudioContext || masterAudioContext.state === 'closed') {
    const webkitWindow = window as Window & { webkitAudioContext?: typeof AudioContext; };
    const AudioContextCtor = window.AudioContext ?? webkitWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;

    masterAudioContext = new AudioContextCtor();
    
    // Create master nodes
    masterGain = masterAudioContext.createGain();
    masterAnalyser = masterAudioContext.createAnalyser();
    
    // Configure analyser for VU meter (frequent peak sampling)
    masterAnalyser.fftSize = 256;
    masterAnalyser.smoothingTimeConstant = 0.5;
    
    // Route: sources -> gain -> analyser -> speakers
    masterGain.connect(masterAnalyser);
    masterAnalyser.connect(masterAudioContext.destination);
  }

  return masterAudioContext;
}

export function connectToMasterBus(sourceNode: AudioNode): void {
  const ctx = getMasterAudioContext();
  if (!ctx || !masterGain) return;
  sourceNode.connect(masterGain);
}

export function getMasterAnalyser(): AnalyserNode | null {
  // Ensure the context and graph are initialized
  getMasterAudioContext();
  return masterAnalyser;
}

export function setMasterVolume(volume: number): void {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, volume);
  }
}

export function ensureMasterContextResumed(): void {
  if (masterAudioContext?.state === 'suspended') {
    masterAudioContext.resume();
  }
}
