const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: 'djol0rpn5', 
  api_key: '888753318981763', 
  api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' 
});

cloudinary.uploader.upload('master_presentation_ultimate.mp4', 
  { resource_type: "video" },
  function(error, result) {
    if (error) {
      console.error(error);
    } else {
      console.log('CLOUDINARY_URL:', result.secure_url);
    }
  });
