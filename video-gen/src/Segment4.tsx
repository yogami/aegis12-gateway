import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { DashboardHighlights } from './components/DashboardHighlights';

export const Segment4: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('segment4.mp3')} />
      <DashboardHighlights />
    </AbsoluteFill>
  );
};
