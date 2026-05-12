import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const ActivePolicyEngineDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const nodeScale = spring({ frame: frame - 5, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <h1 style={{ fontSize: 64, opacity, marginBottom: 80, fontWeight: 'bold', color: '#38bdf8' }}>
        v1 Architecture: Corporate Card Infrastructure (Authority)
      </h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: '40px', position: 'relative' }}>
        
        {/* Agent Node */}
        <div style={{ transform: `scale(${nodeScale})`, padding: '40px 60px', backgroundColor: '#334155', borderRadius: 20, border: '4px solid #64748b', textAlign: 'center' }}>
          <h2 style={{ fontSize: 48, margin: 0 }}>AI Agent</h2>
        </div>

        {/* Arrow */}
        <div style={{ fontSize: 50, opacity, color: '#ef4444' }}>➔</div>

        {/* Active Policy Engine Node (The Firewall) */}
        <div style={{ 
            transform: `scale(${nodeScale})`, 
            padding: '50px 70px', 
            backgroundColor: '#0ea5e9', 
            borderRadius: 20, 
            border: '6px solid #bae6fd', 
            textAlign: 'center',
            boxShadow: '0 0 40px rgba(14, 165, 233, 0.6)'
        }}>
          <h2 style={{ fontSize: 48, margin: 0, color: '#0f172a' }}>Phala Hardware Enclave</h2>
          <p style={{ fontSize: 28, margin: '15px 0 0 0', fontWeight: 'bold', color: '#0f172a' }}>Active Policy Engine</p>
        </div>

        {/* Arrow */}
        <div style={{ fontSize: 50, opacity, color: '#22c55e' }}>➔</div>

        {/* Treasury Node */}
        <div style={{ transform: `scale(${nodeScale})`, padding: '40px 60px', backgroundColor: '#166534', borderRadius: 20, border: '4px solid #22c55e', textAlign: 'center' }}>
          <h2 style={{ fontSize: 48, margin: 0 }}>DAO Treasury</h2>
        </div>
      </div>
      
      {/* Padlock Icon coming down onto the enclave */}
      <div style={{
          position: 'absolute',
          top: interpolate(frame, [20, 40], [-100, 360], { extrapolateRight: 'clamp' }),
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 80,
          opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' }),
          zIndex: 20
      }}>
          🔒
      </div>

    </AbsoluteFill>
  );
};
