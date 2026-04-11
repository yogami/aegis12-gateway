import { v2 as cloudinary } from 'cloudinary';

const outPath = '/Users/user1000/gitprojects/aegis12-gateway/video-demo/aegis12_main_pitch_professional_extended.mp4';
cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });

console.log('Uploading appended video to Cloudinary...');
cloudinary.uploader.upload(outPath, 
  { resource_type: "video", public_id: "aegis12_main_pitch_professional", overwrite: true, invalidate: true },
  (error, result) => {
      if (error) console.error("Upload Error:", error);
      else console.log("\n==================================\n✅ FINAL_URL:", result.secure_url, "\n==================================\n");
      process.exit(error ? 1 : 0);
  });
