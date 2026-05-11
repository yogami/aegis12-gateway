import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, OffthreadVideo, staticFile } from 'remotion';

export const DashboardHighlightsV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase Boundaries
  const phase1End = 191; // Intro
  const phase2End = 484; // Policy Config
  const phase3End = 869; // Telemetry right side
  const phase4End = 1109; // Sub-millisecond / ZK proof
  const phase5End = 1432; // Circuit Breaker bottom left

  // Background dimming for highlights
  // Dim the background only during specific highlights (Phase 2, 3, 4, 5)
  const bgDim = (frame > phase1End && frame < phase5End + 30) ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)';

  // Phase 2: Policy Configuration Highlight (Top Leftish)
  const p2Opacity = interpolate(frame, [phase1End, phase1End + 15, phase2End - 15, phase2End], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const p2BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 250, left: 100, width: 500, height: 400,
    border: '6px solid #38bdf8', borderRadius: 16,
    boxShadow: '0 0 50px rgba(56, 189, 248, 0.5)',
    opacity: p2Opacity
  };

  // Phase 3 & 4: Intent Feed Highlight (Right Side)
  const p3Opacity = interpolate(frame, [phase2End, phase2End + 15, phase4End - 15, phase4End], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const p3BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 250, left: 700, width: 1100, height: 750,
    border: '6px solid #22c55e', borderRadius: 16,
    boxShadow: '0 0 50px rgba(34, 197, 94, 0.5)',
    opacity: p3Opacity
  };

  // Phase 5: Circuit Breaker Highlight (Bottom Left)
  const p5Opacity = interpolate(frame, [phase4End, phase4End + 15, phase5End - 15, phase5End], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const p5BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 680, left: 100, width: 500, height: 350,
    border: '6px solid #ef4444', borderRadius: 16,
    boxShadow: '0 0 50px rgba(239, 68, 68, 0.5)',
    opacity: p5Opacity
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      
      {/* Background UI Video */}
      <OffthreadVideo src={staticFile('ui_base.webm')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Dim Overlay */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: bgDim, transition: 'background-color 0.5s' }} />

      {/* Highlights */}
      <div style={p2BoxStyle} />
      <div style={p3BoxStyle} />
      <div style={p5BoxStyle} />

      {/* Text Labels for Context */}
      <div style={{ position: 'absolute', top: 200, left: 100, fontSize: 36, fontWeight: 'bold', color: '#38bdf8', opacity: p2Opacity, textShadow: '0 0 10px #000' }}>
        Policy Configuration
      </div>

      <div style={{ position: 'absolute', top: 200, left: 700, fontSize: 36, fontWeight: 'bold', color: '#22c55e', opacity: p3Opacity, textShadow: '0 0 10px #000' }}>
        Live Telemetry Feed
      </div>

      <div style={{ position: 'absolute', top: 630, left: 100, fontSize: 36, fontWeight: 'bold', color: '#ef4444', opacity: p5Opacity, textShadow: '0 0 10px #000' }}>
        Circuit Breaker Lockdown
      </div>

    </AbsoluteFill>
  );
};
