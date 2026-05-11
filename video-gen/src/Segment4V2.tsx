import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { DashboardHighlightsV2 } from './components/DashboardHighlightsV2';

export const Segment4V2: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
      <Audio src={staticFile('segment4_v2.mp3')} />
      <DashboardHighlightsV2 />
    </AbsoluteFill>
  );
};
