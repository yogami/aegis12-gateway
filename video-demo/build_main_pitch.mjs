import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execSync } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';

// Constants
const FISH_API_KEY = 'cfcfa3c247e04d24a29f6eece228c261';
const VOICE_ID = '2fcfdf3229d94dc2bcb02b2c35405545';
const OUT_DIR = '/Users/user1000/gitprojects/aegis12-gateway/video-demo';

const IMG1 = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/pitch_slide_1_yami_gopal_1775908725395.png';
const IMG2 = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/pitch_slide_2_catalyst_1775908513458.png';
const IMG3 = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/pitch_slide_3_market_1775908525861.png';
const IMG4 = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/pitch_slide_4_validation_1775908541589.png';
const DEMO_MP4 = path.join(OUT_DIR, 'Aegis-12-Code-Execution.mp4');

const FULL_SCRIPT = `I am Yami Gopal, the founder of Berlin AI Labs and the core architect behind Aegis 12. Over the last five years, my focus has shifted from scaling institutional data architectures to penetrating the computational limits of Zero-Knowledge proofs and hardware enclaves. My specific technical mandate at Berlin AI Labs has been dissecting Layer-1 consensus vulnerabilities and building deterministic security models that mathematically bypass probabilistic middleware. 

We began building Aegis 12 because the current state of autonomous agentic capital is structurally broken. Developers are blindly trusting server-centric frameworks holding private keys in memory. When these agents hit production, they are immediately susceptible to memory extraction and M E V interception. We realized we needed to move the physical security boundary completely off-chain, mathematically binding it to the Solana network directly. 

The specific opportunity we are targeting is the institutional unblocking of Agent-driven capital. Trillions of dollars in automated liquidity are currently bottlenecked in traditional finance, because on-chain agents lack deterministic security. Our Total Addressable Market isn't retail; it is the enterprise protocol layer. By providing mathematical execution guarantees, we capture the core infrastructure routing fees of the incoming machine-to-machine economy. 

Our immediate validation came entirely from protocol security engineers. When we demonstrated our raw ability to bind a Solana Durable Nonce to an A W S Nitro slice, bypassing the 1232-byte MTU limit without increasing on-chain compute unit costs, the consensus was absolute. We successfully decoupled execution from trust. 

Our long-term vision is to enforce Aegis 12 as the default security primitive for the Solana ecosystem. We envision a future where absolutely no protocol interacts with an autonomous agent without a verifiable Proof of Execution. We are entirely eliminating the 'Trust Gap' in decentralized infrastructure, securing the frontier of intelligent capital.`;

function getFfmpegPath() {
    try { return execSync('which ffmpeg').toString().trim(); } 
    catch (e) { return fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'; }
}

async function execute() {
    console.log('--- Aegis 12 Main Pitch Renderer ---');
    const audioPath = path.join(OUT_DIR, 'main_pitch_audio.mp3');
    const outPath = path.join(OUT_DIR, 'Aegis-12-Main-Pitch-Yami.mp4');
    const ffmpegPath = getFfmpegPath();

    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); // FORCE REGENERATE AUDIO

    if (!fs.existsSync(audioPath)) {
        console.log('Generating TTS Audio...');
        const resp = await axios.post('https://api.fish.audio/v1/tts', {
            text: FULL_SCRIPT,
            reference_id: VOICE_ID,
            format: 'mp3',
        }, {
            headers: { 'Authorization': `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 60000,
        });
        fs.writeFileSync(audioPath, resp.data);
    } else {
        console.log('Audio already exists. Reusing.');
    }

    // Measure audio duration
    console.log('Measuring Audio Duration...');
    let audioDurStr = execSync(`"${ffmpegPath}" -i "${audioPath}" 2>&1 | grep "Duration" | awk '{print $2}' | tr -d ,`).toString().trim();
    console.log("Audio Duration String:", audioDurStr); // 00:02:15.52
    let durParts = audioDurStr.split(':');
    let totalAudioSecs = parseFloat(durParts[0])*3600 + parseFloat(durParts[1])*60 + parseFloat(durParts[2]);
    console.log("Total Audio Secs:", totalAudioSecs);

    // Timing distribution:
    // Slide 1 (Team): 0 to 24s
    // Slide 2 (Catalyst): 24s to 49s
    // Slide 3 (Market): 49s to 75s
    // Slide 4 (Validation): 75s to 98s
    // Slide 5 (Vision / Demo MP4): 98s to End
    
    // Instead of complex map filters, we can just render the images into a sequence, and append the video.
    // However, the cleanest way is a complex filter graph over black background.
    console.log('Building FFmpeg Frame Map...');
    const IMG4 = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/pitch_slide_4_validation_clean_1775909309429.png';
    const DEMO_MP4 = path.join(OUT_DIR, 'Aegis-12-Code-Execution.mp4');

    // Dynamically composite Yami Gopal's actual PFP onto Slide 1
    console.log('Compositing Profile Picture onto Slide 1...');
    const pfpPath = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/yami_profile_final_crop_1775909449477.png';
    const slide1BaseUrl = '/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/pitch_slide_1_yami_gopal_1775908725395.png';
    const slide1Merged = path.join(OUT_DIR, 'slide1_with_avatar.png');
    execSync(`"${ffmpegPath}" -y -i "${slide1BaseUrl}" -i "${pfpPath}" -filter_complex "[1:v]scale=250:250,format=rgba,colorchannelmixer=aa=1[pfp]; [0:v][pfp]overlay=W/2+150:180" "${slide1Merged}"`);
    const IMG1 = slide1Merged;

    // We will extract exactly 45 seconds of the demo video's ending to act as Slide 5 (from t=55s to 100s)
    const demoClipPath = path.join(OUT_DIR, 'demo_clip.mp4');
    try {
      execSync(`"${ffmpegPath}" -y -ss 00:00:55 -i "${DEMO_MP4}" -t 45 -c:v libx264 -preset fast -crf 23 -video_track_timescale 90k "${demoClipPath}"`);
    } catch(e) {
      console.log('Failed to cut demo clip. Fallback to image 1 for end.');
      execSync(`cp "${IMG1}" "${demoClipPath}.jpg"`);
    }

    const bgPath = path.join(OUT_DIR, 'bg_black.png');
    execSync(`"${ffmpegPath}" -y -f lavfi -i color=c=black:s=1920x1080:d=1 -frames:v 1 "${bgPath}"`);

    const filterGraph = `
      [0:v]loop=loop=-1:size=1:start=0,setpts=PTS-STARTPTS[bg];
      [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=rgba,colorchannelmixer=aa=1[img1];
      [2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=rgba,colorchannelmixer=aa=1[img2];
      [3:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=rgba,colorchannelmixer=aa=1[img3];
      [4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=rgba,colorchannelmixer=aa=1[img4];
      [5:v]scale=1920:1080,format=rgba,setpts=PTS-STARTPTS+98/TB[img5];
      [bg][img1]overlay=enable='between(t,0,24)'[v1];
      [v1][img2]overlay=enable='between(t,24,49)'[v2];
      [v2][img3]overlay=enable='between(t,49,76)'[v3];
      [v3][img4]overlay=enable='between(t,76,98)'[v4];
      [v4][img5]overlay=enable='gte(t,98)':eof_action=pass[outv]
    `.replace(/\\s+/g, '');

    console.log('Executing FFmpeg Render...');
    try {
        const cmd = `"${ffmpegPath}" -y -i "${bgPath}" -i "${IMG1}" -i "${IMG2}" -i "${IMG3}" -i "${IMG4}" -i "${demoClipPath}" -i "${audioPath}" -filter_complex "${filterGraph}" -map "[outv]" -map 6:a:0 -c:v libx264 -preset fast -crf 23 -c:a aac -shortest -t ${totalAudioSecs} "${outPath}"`;
        execSync(cmd);
        console.log('✅ Video Stitched.');
    } catch (e) {
        console.error('❌ FFmpeg Filter crash:', e.message);
        process.exit(1);
    }

    console.log('Uploading to Cloudinary...');
    cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });
    cloudinary.uploader.upload(outPath, 
      { resource_type: "video", public_id: "aegis12_main_pitch_professional", overwrite: true, invalidate: true },
      (error, result) => {
          if (error) console.error("Upload Error:", error);
          else console.log("\\n==================================\\n✅ FINAL_URL:", result.secure_url, "\\n==================================\\n");
      });
}

execute().catch(console.error);
