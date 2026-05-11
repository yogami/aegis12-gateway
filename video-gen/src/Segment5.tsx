import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { SdkGtmHighlights } from './components/SdkGtmHighlights';

export const Segment5: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('segment5.mp3')} />
      <SdkGtmHighlights />
    </AbsoluteFill>
  );
};
