import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: 'djol0rpn5', 
  api_key: '888753318981763', 
  api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' 
});

const videoPath = "/Users/user1000/gitprojects/aegis12-gateway/video-demo/pitch_assets/Aegis-12-Final-Submission.mp4";

console.log(`📤 Uploading ${videoPath} to Cloudinary...`);
cloudinary.uploader.upload(videoPath, 
  { resource_type: "video", public_id: "aegis12_colosseum_demo", overwrite: true, invalidate: true },
  function(error, result) {
      if (error) {
          console.error("❌ Upload Error:", error);
      } else {
          console.log("\n==================================");
          console.log("✅ CLOUDINARY_URL:", result.secure_url);
          console.log("📎 Use this URL in your Colosseum Eternal submission.");
          console.log("==================================\n");
      }
  });
