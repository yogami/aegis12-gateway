import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const PassiveLoggerDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const nodeScale = spring({ frame: frame - 10, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <h1 style={{ fontSize: 64, opacity, marginBottom: 80, fontWeight: 'bold' }}>
        v0 Architecture: Compliance Logging (Observability)
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '80px', position: 'relative' }}>
        
        {/* Agent Node */}
        <div style={{ transform: `scale(${nodeScale})`, padding: '40px 60px', backgroundColor: '#334155', borderRadius: 20, border: '4px solid #64748b', textAlign: 'center' }}>
          <h2 style={{ fontSize: 48, margin: 0 }}>AI Agent</h2>
        </div>

        {/* Arrow */}
        <div style={{ fontSize: 60, opacity }}>➔</div>

        {/* Treasury Node */}
        <div style={{ transform: `scale(${nodeScale})`, padding: '40px 60px', backgroundColor: '#166534', borderRadius: 20, border: '4px solid #22c55e', textAlign: 'center' }}>
          <h2 style={{ fontSize: 48, margin: 0 }}>DAO Treasury</h2>
        </div>

        {/* Passive Logger Node (Sidecar) */}
        <div style={{ position: 'absolute', top: -180, left: '50%', transform: `translateX(-50%) scale(${nodeScale})`, padding: '30px 40px', backgroundColor: '#7f1d1d', borderRadius: 20, border: '4px dashed #ef4444', textAlign: 'center', opacity: 0.6 }}>
          <h2 style={{ fontSize: 36, margin: 0 }}>Passive API Logger</h2>
          <p style={{ fontSize: 24, margin: '10px 0 0 0', fontStyle: 'italic' }}>Post-mortem audit only</p>
        </div>
        
        {/* Arrow to sidecar */}
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%) rotate(-90deg)', fontSize: 40, opacity: 0.6 }}>➔</div>

      </div>

      {/* Red "ARCHIVED" stamp that comes in later */}
      {frame > 300 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(-15deg) scale(${spring({ frame: frame - 300, fps, config: { damping: 12 } })})`,
          color: '#ef4444',
          border: '12px solid #ef4444',
          borderRadius: 20,
          padding: '20px 40px',
          fontSize: 120,
          fontWeight: '900',
          textTransform: 'uppercase',
          textShadow: '0 0 20px rgba(239,68,68,0.5)',
          boxShadow: '0 0 40px rgba(239,68,68,0.5)',
          zIndex: 10
        }}>
          ARCHIVED
        </div>
      )}
    </AbsoluteFill>
  );
};
