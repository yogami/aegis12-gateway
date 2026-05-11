import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const CircuitBreakerArchitecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase Boundaries
  const phase1End = 284;
  const phase2End = 484;
  const phase3End = 726;

  // Global opacity
  const mainOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Node scale
  const nodeScale = spring({ frame: frame - 10, fps, config: { damping: 12 } });

  // P1 Animations (The Violation)
  const p1IntentPos = interpolate(frame, [phase1End - 60, phase1End], [0, 250], { extrapolateRight: 'clamp' });

  // P2 Animations (The Hardware Kill)
  const p2BlockOpacity = interpolate(frame, [phase1End, phase1End + 15], [0, 1], { extrapolateRight: 'clamp' });
  const p2EnclavePulse = frame > phase1End && frame < phase3End ? Math.sin((frame - phase1End) / 3) * 0.5 + 0.5 : 0;
  
  // P3 Animations (The Escalation)
  const p3SquadsScale = spring({ frame: frame - phase2End, fps, config: { damping: 12 } });
  const p3ArrowOpacity = interpolate(frame, [phase2End + 30, phase2End + 60], [0, 1], { extrapolateRight: 'clamp' });

  // P4 Animations (Human Oversight)
  const p4HumanScale = spring({ frame: frame - phase3End, fps, config: { damping: 12 } });
  const p4StampScale = spring({ frame: frame - (phase3End + 60), fps, config: { damping: 12 } });
  const p4StampOpacity = interpolate(frame, [phase3End + 60, phase3End + 75], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', backgroundColor: '#0f172a' }}>
      
      <div style={{ position: 'relative', width: 1000, height: 600 }}>
        
        {/* Agent Node */}
        <div style={{ position: 'absolute', top: 300, left: 0, padding: '30px 50px', backgroundColor: '#334155', borderRadius: 20, border: '4px solid #64748b', transform: `scale(${nodeScale})` }}>
          <h2 style={{ fontSize: 40, margin: 0 }}>AI Agent</h2>
        </div>

        {/* Path to Enclave */}
        <div style={{ position: 'absolute', top: 345, left: 200, width: 250, height: 4, backgroundColor: '#64748b' }} />

        {/* Malicious Intent traveling */}
        {frame > phase1End - 60 && frame < phase1End && (
            <div style={{ position: 'absolute', top: 320, left: 200 + p1IntentPos, backgroundColor: '#ef4444', color: 'white', padding: '5px 15px', borderRadius: 10, fontWeight: 'bold' }}>
              Malicious Intent
            </div>
        )}

        {/* Phala TEE Enclave Node */}
        <div style={{ 
          position: 'absolute', top: 290, left: 450,
          padding: '30px 50px', 
          backgroundColor: '#0ea5e9', 
          borderRadius: 20, 
          border: `6px solid ${frame > phase1End && frame < phase3End ? `rgba(239, 68, 68, ${p2EnclavePulse + 0.5})` : '#bae6fd'}`,
          boxShadow: frame > phase1End && frame < phase3End ? `0 0 40px rgba(239, 68, 68, ${p2EnclavePulse})` : 'none',
          transform: `scale(${nodeScale})`,
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: 40, margin: 0, color: '#0f172a' }}>Phala TEE</h2>
          <p style={{ margin: 0, color: '#0f172a', fontWeight: 'bold' }}>Active Policy Engine</p>
        </div>

        {/* Path to Treasury */}
        <div style={{ position: 'absolute', top: 345, left: 710, width: 250, height: 4, backgroundColor: '#64748b', opacity: 0.3 }} />

        {/* DAO Treasury Node */}
        <div style={{ position: 'absolute', top: 300, left: 960, padding: '30px 50px', backgroundColor: '#166534', borderRadius: 20, border: '4px solid #22c55e', opacity: 0.3, transform: `scale(${nodeScale})` }}>
          <h2 style={{ fontSize: 40, margin: 0 }}>DAO Treasury</h2>
        </div>

        {/* The Hardware Kill (Phase 2) */}
        {frame >= phase1End && (
            <div style={{ position: 'absolute', top: 240, left: 410, fontSize: 100, color: '#ef4444', opacity: p2BlockOpacity, zIndex: 10 }}>
                🛡️ BLOCK
            </div>
        )}

        {/* Phase 3: The Escalation */}
        {frame >= phase2End && (
            <>
                <svg style={{ position: 'absolute', top: 120, left: 550, width: 100, height: 170, opacity: p3ArrowOpacity }}>
                    <line x1="50" y1="170" x2="50" y2="0" stroke="#f59e0b" strokeWidth="6" strokeDasharray="10,10" />
                    <polygon points="40,20 60,20 50,0" fill="#f59e0b" />
                </svg>

                <div style={{ position: 'absolute', top: 20, left: 460, padding: '30px 50px', backgroundColor: '#b45309', borderRadius: 20, border: '4px solid #f59e0b', transform: `scale(${p3SquadsScale})`, textAlign: 'center' }}>
                    <h2 style={{ fontSize: 40, margin: 0 }}>Squads V4 Multisig</h2>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#fef3c7' }}>Escalation Proposal</p>
                </div>
            </>
        )}

        {/* Phase 4: Human Oversight */}
        {frame >= phase3End && (
            <>
                <svg style={{ position: 'absolute', top: 60, left: 750, width: 200, height: 20, opacity: p3ArrowOpacity }}>
                    <line x1="0" y1="10" x2="200" y2="10" stroke="#22c55e" strokeWidth="6" />
                </svg>

                <div style={{ position: 'absolute', top: 20, left: 880, padding: '30px 50px', backgroundColor: '#3f6212', borderRadius: 20, border: '4px solid #84cc16', transform: `scale(${p4HumanScale})`, textAlign: 'center' }}>
                    <h2 style={{ fontSize: 40, margin: 0 }}>Human Council</h2>
                </div>

                <div style={{ 
                    position: 'absolute', 
                    top: 150, left: 720, 
                    transform: `rotate(-10deg) scale(${p4StampScale})`,
                    opacity: p4StampOpacity,
                    border: '8px solid #22c55e',
                    borderRadius: 20,
                    padding: '20px 30px',
                    color: '#22c55e',
                    fontSize: 48,
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    zIndex: 20,
                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)'
                }}>
                    EU AI Act Art. 14<br/>(Human Oversight)
                </div>
            </>
        )}
      </div>
    </AbsoluteFill>
  );
};
