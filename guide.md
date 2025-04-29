Guide to Uploading Videos to Your Virtual Girlfriend App
This guide explains how to upload videos to your virtual girlfriend application so you can watch them together during your chat sessions.
Prerequisites
Make sure your server is running
Videos should be in common formats like MP4, WebM, OGG, MOV, or AVI
Maximum file size is 50MB (as configured in the app)
Method 1: Using the API Endpoint
Using cURL
```
curl -X POST http://your-server-url/upload \
-H "Content-Type: application/octet-stream" \
--data-binary "@path/to/your/video.mp4"
```

Using JavaScript/Fetch
```
async function uploadVideo(videoFile) {
  const response = await fetch('http://localhost:3000/upload-video', {
    method: 'POST',
    headers: {
      'Content-Type': videoFile.type
    },
    body: videoFile
  });
  
  const result = await response.json();
  console.log('Upload result:', result);
  return result;
}

// Use it with a file input
document.getElementById('videoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadVideo(file);
  }
});

Method 2: Manually Adding Videos
Create a videos directory in your project root if it doesn't exist already
Copy your video files directly into this directory
3. The server will automatically detect these files and make them available
Viewing Available Videos
To see a list of all uploaded videos, make a GET request to:
```
http://localhost:3000/self-hosted-videos
```

This will return a JSON array of all videos in the videos directory


Watching Videos in Chat
Once videos are uploaded, you can ask your virtual girlfriend to watch them with you. For example:
"Can we watch a video together?"
The AI will suggest videos from your collection, or you can specifically request one:
"
"Let's watch the video I just uploaded about our favorite vacation spot."

Troubleshooting
If you get an error about file size, try uploading a smaller video or increase the limit in the server code
If videos don't play, ensure they're in a web-compatible format (MP4 with H.264 codec works best)
Check the server console for any error messages during upload
Enjoy watching videos together with your virtual girlfriend!
