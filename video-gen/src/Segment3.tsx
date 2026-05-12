import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { CircuitBreakerArchitecture } from './components/CircuitBreakerArchitecture';

export const Segment3: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('segment3.mp3')} />
      <CircuitBreakerArchitecture />
    </AbsoluteFill>
  );
};
