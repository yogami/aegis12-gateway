const cloudinary = require('cloudinary').v2;
cloudinary.config({ cloud_name: 'djol0rpn5', api_key: '888753318981763', api_secret: 'HqTbA8IE_o6CHbenhKb_iiKXOwo' });
cloudinary.uploader.upload('/Users/user1000/gitprojects/aegis12-gateway/aegis12_live_demo_addendum.mp4', {
  resource_type: "video", public_id: "aegis12_live_demo_addendum", chunk_size: 6000000
}).then(r => console.log("URL:", r.secure_url)).catch(e => console.error(e));
