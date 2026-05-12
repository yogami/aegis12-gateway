import { AbsoluteFill, Audio, staticFile, useCurrentFrame, Sequence, interpolate, spring, useVideoConfig } from 'remotion';
import { PassiveLoggerDiagram } from './components/PassiveLoggerDiagram';
import { ActivePolicyEngineDiagram } from './components/ActivePolicyEngineDiagram';

export const Segment1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The pivot happens around frame 435 (14.5 seconds)
  const pivotFrame = 435;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('segment1.mp3')} />

      <Sequence from={0} durationInFrames={pivotFrame}>
        <PassiveLoggerDiagram />
      </Sequence>

      <Sequence from={pivotFrame}>
        <ActivePolicyEngineDiagram />
      </Sequence>
    </AbsoluteFill>
  );
};
