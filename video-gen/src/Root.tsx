import { Composition } from 'remotion';
import { Segment1 } from './Segment1';
import { Segment2 } from './Segment2';
import { Segment3 } from './Segment3';
import { Segment4 } from './Segment4';
import { Segment4V2 } from './Segment4V2';
import { Segment5 } from './Segment5';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Segment1"
        component={Segment1}
        durationInFrames={1710}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Segment2"
        component={Segment2}
        durationInFrames={1158}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Segment3"
        component={Segment3}
        durationInFrames={1055}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Segment4"
        component={Segment4}
        durationInFrames={1036}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Segment4V2"
        component={Segment4V2}
        durationInFrames={1540}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="Segment5"
        component={Segment5}
        durationInFrames={1309}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
