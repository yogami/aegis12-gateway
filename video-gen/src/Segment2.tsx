import { AbsoluteFill, Audio, staticFile, useCurrentFrame, Sequence } from 'remotion';
import { EvolvingArchitecture } from './components/EvolvingArchitecture';

export const Segment2: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('segment2.mp3')} />
      <EvolvingArchitecture />
    </AbsoluteFill>
  );
};
