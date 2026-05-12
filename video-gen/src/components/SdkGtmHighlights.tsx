import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const SdkGtmHighlights: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase Boundaries
  const phase1End = 222; // unhackable corporate card
  const phase2End = 562; // npm install
  const phase3End = 869; // import statement
  const phase4End = 1218; // enforce statement

  // IDE Animations
  const ideScale = spring({ frame: frame - 10, fps, config: { damping: 12 } });
  const terminalY = spring({ frame: frame - (phase1End + 30), fps, config: { damping: 14 } });
  const terminalHeight = interpolate(terminalY, [0, 1], [0, 200]);

  // Typing logic for terminal
  const terminalTextRaw = "npm install @aegis12/sdk";
  const terminalChars = interpolate(frame, [phase2End - 100, phase2End - 30], [0, terminalTextRaw.length], { extrapolateRight: 'clamp' });
  const terminalText = terminalTextRaw.substring(0, Math.floor(terminalChars));
  
  // Terminal install success (green)
  const installSuccess = frame > phase2End - 10;

  // Typing logic for IDE Editor Phase 3 (import)
  const line1Raw = "import { AegisEnclave } from '@aegis12/sdk';";
  const line1Chars = interpolate(frame, [phase3End - 150, phase3End - 50], [0, line1Raw.length], { extrapolateRight: 'clamp' });
  const line1 = line1Raw.substring(0, Math.floor(line1Chars));

  // Typing logic for IDE Editor Phase 4 (enforce)
  const line2Raw = "const firewall = new AegisEnclave({ limit: 1000 });";
  const line2Chars = interpolate(frame, [phase4End - 300, phase4End - 200], [0, line2Raw.length], { extrapolateRight: 'clamp' });
  const line2 = line2Raw.substring(0, Math.floor(line2Chars));

  const line3Raw = "await firewall.enforce(unsignedIntent);";
  const line3Chars = interpolate(frame, [phase4End - 150, phase4End - 50], [0, line3Raw.length], { extrapolateRight: 'clamp' });
  const line3 = line3Raw.substring(0, Math.floor(line3Chars));

  // Fade Out
  const fadeOut = interpolate(frame, [phase4End + 30, phase4End + 90], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* IDE Window */}
      <div style={{
          width: 1200, height: 800,
          backgroundColor: '#1e293b',
          borderRadius: 16,
          boxShadow: '0 0 50px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: `scale(${ideScale})`,
          border: '1px solid #475569'
      }}>
          
          {/* IDE Header */}
          <div style={{ width: '100%', height: 40, backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', paddingLeft: 20, gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#22c55e' }} />
              <div style={{ marginLeft: 20, color: '#94a3b8', fontSize: 14, fontFamily: 'monospace' }}>agent.ts — your-eliza-agent</div>
          </div>

          {/* IDE Editor Area */}
          <div style={{ flex: 1, padding: 40, fontFamily: 'monospace', fontSize: 32, color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ color: '#c084fc' }}>{line1}</div>
            <div style={{ color: '#38bdf8', marginTop: 20 }}>{line2}</div>
            <div style={{ color: '#fbbf24' }}>{line3}</div>
          </div>

          {/* Terminal Area */}
          {frame > phase1End + 30 && (
             <div style={{ width: '100%', height: terminalHeight, backgroundColor: '#020617', borderTop: '1px solid #334155', padding: 20, fontFamily: 'monospace', fontSize: 24, color: '#94a3b8' }}>
                 <div style={{ color: '#38bdf8', marginBottom: 10 }}>TERMINAL</div>
                 <div>
                    <span style={{ color: '#22c55e' }}>~ </span>
                    <span style={{ color: '#f8fafc' }}>{terminalText}</span>
                 </div>
                 {installSuccess && (
                     <div style={{ marginTop: 10, color: '#94a3b8' }}>
                        added 1 package, and audited 392 packages in 2s<br/>
                        <span style={{ color: '#22c55e' }}>found 0 vulnerabilities</span>
                     </div>
                 )}
             </div>
          )}
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
