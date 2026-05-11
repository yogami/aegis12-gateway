import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence } from 'remotion';

export const EvolvingArchitecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase Boundaries
  const phase1End = 377;
  const phase2End = 511;
  const phase3End = 782;

  // Global opacity
  const mainOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // P1 Animations (The Bottleneck)
  const p1OraclePulse = Math.sin(frame / 5) * 0.5 + 0.5; // pulses 0 to 1
  const p1WarningOpacity = interpolate(frame, [150, 180], [0, 1], { extrapolateRight: 'clamp' });
  const p1Shatter = interpolate(frame, [phase1End, phase1End + 15], [1, 0], { extrapolateRight: 'clamp' });

  // P2 Animations (The Solution / Asynchronous Attestation)
  const p2TitleScale = spring({ frame: frame - phase1End, fps, config: { damping: 12 } });
  
  // P3 Animations (Hot Path)
  const p3TeeScale = spring({ frame: frame - phase2End, fps, config: { damping: 12 } });
  const p3IntentPos = interpolate(frame, [phase2End + 30, phase2End + 60], [0, 300], { extrapolateRight: 'clamp' });
  const p3ZeroLatencyOpacity = interpolate(frame, [phase2End + 60, phase2End + 75], [0, 1], { extrapolateRight: 'clamp' });

  // P4 Animations (Cold Path)
  const p4SolanaScale = spring({ frame: frame - phase3End, fps, config: { damping: 12 } });
  const p4ZkProofY = interpolate(frame, [phase3End + 30, phase3End + 60], [0, -250], { extrapolateRight: 'clamp' });
  const p4ZkProofX = interpolate(frame, [phase3End + 30, phase3End + 60], [0, 250], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      
      {/* PHASE 1: THE BOTTLENECK */}
      {frame < phase1End + 30 && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%) scale(${p1Shatter})`, opacity: p1Shatter, display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ padding: '30px 50px', backgroundColor: '#334155', borderRadius: 20, border: '4px solid #64748b' }}>
            <h2 style={{ fontSize: 40, margin: 0 }}>AI Agent</h2>
          </div>
          
          <div style={{ fontSize: 40 }}>➔</div>
          
          <div style={{ 
            padding: '30px 50px', 
            backgroundColor: '#7f1d1d', 
            borderRadius: 20, 
            border: `6px solid rgba(239, 68, 68, ${p1OraclePulse})`,
            boxShadow: `0 0 40px rgba(239, 68, 68, ${p1OraclePulse})`,
            position: 'relative'
          }}>
            <h2 style={{ fontSize: 40, margin: 0 }}>Heavy Oracle (ZK)</h2>
            
            {/* Latency Warning */}
            <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', fontSize: 24, opacity: p1WarningOpacity, whiteSpace: 'nowrap' }}>
              ⚠️ LATENCY BOTTLENECK
            </div>
          </div>

          <div style={{ fontSize: 40 }}>➔</div>

          <div style={{ padding: '30px 50px', backgroundColor: '#166534', borderRadius: 20, border: '4px solid #22c55e' }}>
            <h2 style={{ fontSize: 40, margin: 0 }}>DAO Treasury</h2>
          </div>
        </div>
      )}

      {/* PHASE 2: THE TITLE */}
      {frame >= phase1End && frame < phase2End && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%, -50%) scale(${p2TitleScale})`, fontSize: 80, fontWeight: 'bold', color: '#38bdf8', textAlign: 'center' }}>
          ASYNCHRONOUS<br/>ATTESTATION
        </div>
      )}

      {/* PHASE 3 & 4: THE SOLUTION */}
      {frame >= phase2End && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: 40, alignItems: 'center' }}>
          
          <div style={{ padding: '30px 50px', backgroundColor: '#334155', borderRadius: 20, border: '4px solid #64748b', transform: `scale(${p3TeeScale})` }}>
            <h2 style={{ fontSize: 40, margin: 0 }}>AI Agent</h2>
          </div>
          
          <div style={{ position: 'relative', width: 200, height: 100 }}>
            {/* The Intent traveling */}
            {frame < phase2End + 75 && (
              <div style={{ position: 'absolute', left: p3IntentPos, top: 25, backgroundColor: '#cbd5e1', color: '#0f172a', padding: '5px 15px', borderRadius: 10, fontWeight: 'bold' }}>
                Unsigned x402
              </div>
            )}
            <div style={{ position: 'absolute', top: '35%', width: '100%', height: 4, backgroundColor: '#64748b' }} />
          </div>
          
          <div style={{ 
            padding: '30px 50px', 
            backgroundColor: '#0ea5e9', 
            borderRadius: 20, 
            border: '6px solid #bae6fd',
            position: 'relative',
            transform: `scale(${p3TeeScale})`
          }}>
            <h2 style={{ fontSize: 40, margin: 0, color: '#0f172a' }}>Phala TEE</h2>
            
            {/* Zero Latency Badge */}
            <div style={{ position: 'absolute', bottom: -50, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#22c55e', color: 'white', padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', fontSize: 24, opacity: p3ZeroLatencyOpacity, whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(34,197,94,0.5)' }}>
              ⚡ 0-LATENCY
            </div>

            {/* PHASE 4: The Cold Path (Solana) */}
            {frame >= phase3End && (
              <>
                <div style={{ position: 'absolute', top: p4ZkProofY, left: p4ZkProofX, backgroundColor: '#f59e0b', color: '#0f172a', padding: '10px 20px', borderRadius: 10, fontWeight: 'bold', zIndex: 10, whiteSpace: 'nowrap' }}>
                  ZK-Proof Anchor
                </div>
                
                <div style={{ position: 'absolute', top: -350, left: 200, transform: `scale(${p4SolanaScale})`, padding: '30px 50px', backgroundColor: '#1e1b4b', borderRadius: 20, border: '4px solid #818cf8', whiteSpace: 'nowrap' }}>
                  <h2 style={{ fontSize: 40, margin: 0, color: '#818cf8' }}>Solana Ledger</h2>
                  <p style={{ margin: 0, color: '#cbd5e1', fontWeight: 'bold' }}>EU AI Act Art. 12</p>
                </div>

                {/* Connecting lines */}
                <svg style={{ position: 'absolute', top: -200, left: 100, width: 300, height: 200, zIndex: -1 }}>
                    <line x1="0" y1="200" x2="200" y2="0" stroke="#818cf8" strokeWidth="4" strokeDasharray="10,10" />
                </svg>
              </>
            )}

          </div>

          <div style={{ position: 'relative', width: 200, height: 100 }}>
             {/* The Signed Transaction traveling (Phase 4) */}
             {frame >= phase3End && (
                <>
                  <div style={{ position: 'absolute', left: interpolate(frame, [phase3End + 10, phase3End + 40], [0, 250], { extrapolateRight: 'clamp' }), top: 25, backgroundColor: '#22c55e', color: 'white', padding: '5px 15px', borderRadius: 10, fontWeight: 'bold' }}>
                    Signed Tx
                  </div>
                </>
             )}
            <div style={{ position: 'absolute', top: '35%', width: '100%', height: 4, backgroundColor: '#64748b' }} />
          </div>

          <div style={{ padding: '30px 50px', backgroundColor: '#166534', borderRadius: 20, border: '4px solid #22c55e', transform: `scale(${p3TeeScale})` }}>
            <h2 style={{ fontSize: 40, margin: 0 }}>DAO Treasury</h2>
          </div>

        </div>
      )}
    </AbsoluteFill>
  );
};
