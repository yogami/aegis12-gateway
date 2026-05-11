import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, OffthreadVideo, staticFile } from 'remotion';

export const DashboardHighlights: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase Boundaries
  const phase1End = 300;
  const phase2End = 527;
  const phase3End = 879;

  // Background dimming for highlights
  const bgDim = frame < phase3End ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)';

  // Phase 1: Policy Configuration Highlight (Top Leftish usually)
  // These bounding boxes are approximations for a 1920x1080 screen with 90% zoom
  const p1Opacity = interpolate(frame, [0, 15, phase1End - 15, phase1End], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const p1BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 250, left: 100, width: 500, height: 400,
    border: '6px solid #38bdf8', borderRadius: 16,
    boxShadow: '0 0 50px rgba(56, 189, 248, 0.5)',
    opacity: p1Opacity
  };

  // Phase 2: Lockdown / Circuit Breaker Highlight (Bottom Left usually)
  const p2Opacity = interpolate(frame, [phase1End, phase1End + 15, phase2End - 15, phase2End], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const p2BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 680, left: 100, width: 500, height: 350,
    border: '6px solid #ef4444', borderRadius: 16,
    boxShadow: '0 0 50px rgba(239, 68, 68, 0.5)',
    opacity: p2Opacity
  };

  // Phase 3: Live Intent Feed Highlight (Right Side usually)
  const p3Opacity = interpolate(frame, [phase2End, phase2End + 15, phase3End - 15, phase3End], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const p3BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 250, left: 700, width: 1100, height: 750,
    border: '6px solid #22c55e', borderRadius: 16,
    boxShadow: '0 0 50px rgba(34, 197, 94, 0.5)',
    opacity: p3Opacity
  };

  // Phase 4: Enclave Badge (Top Center) & Fade to Black
  const p4Opacity = interpolate(frame, [phase3End, phase3End + 15], [0, 1], { extrapolateRight: 'clamp' });
  const p4BoxStyle: React.CSSProperties = {
    position: 'absolute', top: 50, left: 800, width: 350, height: 100,
    border: '6px solid #f59e0b', borderRadius: 16,
    boxShadow: '0 0 50px rgba(245, 158, 11, 0.8)',
    opacity: p4Opacity
  };
  
  const fadeOut = interpolate(frame, [phase3End + 60, phase3End + 120], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      
      {/* Background UI Video */}
      <OffthreadVideo src={staticFile('ui_base.webm')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Dim Overlay */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: bgDim, transition: 'background-color 0.5s' }} />

      {/* Highlights */}
      <div style={p1BoxStyle} />
      <div style={p2BoxStyle} />
      <div style={p3BoxStyle} />
      <div style={p4BoxStyle} />

      {/* Text Labels for Context */}
      <div style={{ position: 'absolute', top: 200, left: 100, fontSize: 36, fontWeight: 'bold', color: '#38bdf8', opacity: p1Opacity, textShadow: '0 0 10px #000' }}>
        Corporate Card
      </div>
      
      <div style={{ position: 'absolute', top: 630, left: 100, fontSize: 36, fontWeight: 'bold', color: '#ef4444', opacity: p2Opacity, textShadow: '0 0 10px #000' }}>
        Cyber-Resilience (Article 15)
      </div>

      <div style={{ position: 'absolute', top: 200, left: 700, fontSize: 36, fontWeight: 'bold', color: '#22c55e', opacity: p3Opacity, textShadow: '0 0 10px #000' }}>
        Real Capital Execution
      </div>

      {/* Fade to Black Finale */}
      <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'black', opacity: fadeOut, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ color: 'white', fontSize: 80, fontWeight: 'bold' }}>
          Aegis-12: Institutional Guardrails
        </h1>
      </div>

    </AbsoluteFill>
  );
};
