const cloudinary = require('cloudinary').v2;
cloudinary.config({ 
    cloud_name: 'djol0rpn5', 
    api_key: '888753318981763', 
    api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' 
});
cloudinary.uploader.upload('public/aegis12_master_pitch.mp4', { resource_type: "video" })
  .then(res => console.log("CLOUDINARY_URL: " + res.secure_url))
  .catch(err => console.error(err));
