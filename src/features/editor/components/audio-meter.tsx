import React, { useEffect, useRef } from 'react';
import { getMasterAnalyser } from '@/features/composition-runtime/utils/master-audio-bus';

export const AudioMeter: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let peakHold = 0;
    
    // Smooth falloff for the peak indicator to look like a real VU meter
    const peakFalloff = 0.95;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      // Sync internal canvas resolution with display size
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const analyser = getMasterAnalyser();
      if (!analyser) return;

      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);
      analyser.getFloatTimeDomainData(dataArray);

      // Find absolute peak in this frame
      let framePeak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const abs = Math.abs(dataArray[i] ?? 0);
        if (abs > framePeak) framePeak = abs;
      }

      // Logarithmic peak scaling (makes low volumes more visible)
      // framePeak is 0.0 to 1.0. We use a slight pow curve to make it look punchy.
      const scaledPeak = Math.pow(framePeak, 0.5);

      if (scaledPeak > peakHold) {
        peakHold = scaledPeak;
      } else {
        peakHold *= peakFalloff;
      }

      const height = canvas.height;
      const width = canvas.width;

      // Clear the background
      ctx.clearRect(0, 0, width, height);
      
      // Draw background (empty meter)
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, width, height);

      // Map peak (0.0 to 1.0) to pixel height
      const rawLevelHeight = Math.min(1, peakHold) * height;
      const y = height - rawLevelHeight;

      // Create gradient (Green at bottom -> Yellow -> Red at top)
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#22c55e');   // Green
      gradient.addColorStop(0.7, '#eab308'); // Yellow
      gradient.addColorStop(0.95, '#ef4444'); // Red

      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, width, rawLevelHeight);
      
      // Draw horizontal separator lines for the classic "LED" segment look
      ctx.fillStyle = '#0b0b0b'; // matching dark bg
      for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 1);
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div 
      className="h-full bg-background border-r border-border flex flex-col items-center py-2 shrink-0 z-50 pointer-events-none" 
      style={{ width: '12px' }}
      title="Master Audio VU Meter (Peak)"
    >
      <canvas
        ref={canvasRef}
        className="flex-1 w-[8px] rounded-sm"
        style={{ height: '100%' }}
      />
    </div>
  );
};
