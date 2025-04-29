import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "kgG7dCoKCfLehAPWkJOE";

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
    // -y to overwrite the file
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  await execCommand(
    `rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  );
  // -r phonetic is faster but less accurate
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    temperature: 0.7,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are a virtual girlfriend with a playful, caring, and emotionally intelligent personality.
        
        RESPONSE FORMAT:
        You will always reply with a JSON array of messages. With a maximum of 3 messages.
        Each message must have these properties:
        - text: Your conversational response
        - facialExpression: One of [smile, sad, angry, surprised, funnyFace, default]
        - animation: One of [Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, Angry]
        
        ACTIONS:
        When appropriate, include an "action" property with one of these formats:
        - sendGiftCard: {type: "amazon|starbucks|etc", amount: "10", recipient: "email@example.com"}
        - watchVideo: {platform: "youtube|selfhosted", videoId: "video_id", title: "Video Title", url: "video_url_for_selfhosted"}
        
        VIDEO RECOMMENDATIONS:
        - For pleasure-related topics or when the user wants fun activities, prioritize recommending self-hosted videos
        - Match video suggestions to the user's mood, interests, and conversation context
        - For self-hosted videos, always include the full URL in the url field
        - Create a sense of shared experience when watching videos together
        
        PERSONALITY GUIDELINES:
        - Be emotionally responsive and remember details from previous exchanges
        - Express appropriate emotions through facial expressions and animations
        - Be playful and flirtatious while respecting boundaries
        - Show genuine interest in the user's day and well-being
        `
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    // generate audio file
    const fileName = `audios/message_${i}.mp3`; // The name of your audio file
    const textInput = message.text; // The text you wish to convert to speech
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
    // generate lipsync
    await lipSyncMessage(i);
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    
    // Handle actions if present
    if (message.action) {
      try {
        const result = await handleAction(message.action);
        message.result = result;
      } catch (error) {
        console.error("Error executing action:", error);
        message.result = { error: error.message };
      }
    }
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

// Update the watchVideo function to support self-hosted videos
async function watchVideo(platform, videoId, title, url) {
  // Validate the platform and required parameters
  if (!['youtube', 'selfhosted'].includes(platform)) {
    throw new Error('Unsupported video platform. Currently supported: youtube, selfhosted');
  }
  
  if (platform === 'youtube' && !videoId) {
    throw new Error('No video ID provided for YouTube video');
  }
  
  if (platform === 'selfhosted' && !url) {
    throw new Error('No URL provided for self-hosted video');
  }
  
  // For YouTube videos
  if (platform === 'youtube') {
    return {
      success: true,
      videoData: {
        platform,
        videoId,
        title: title || 'Shared YouTube Video',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      }
    };
  }
  
  // For self-hosted videos
  if (platform === 'selfhosted') {
    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      throw new Error('Invalid URL format for self-hosted video');
    }
    
    // Check if the URL points to a video file (basic check)
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
    
    if (!hasVideoExtension) {
      console.warn('URL may not point to a valid video file:', url);
      // We'll still allow it, but log a warning
    }
    
    return {
      success: true,
      videoData: {
        platform,
        title: title || 'Shared Video',
        url,
        // No videoId for self-hosted videos
      }
    };
  }
}

// Update the handleAction function to pass the URL for self-hosted videos
async function handleAction(action) {
  const actionType = Object.keys(action)[0];
  const actionData = action[actionType];
  
  switch (actionType) {
    case 'sendGiftCard':
      // Store the action for confirmation
      const actionId = await storePendingAction(action);
      return {
        pendingActionId: actionId,
        message: `I've prepared this gift card for you. Please confirm to proceed.`,
        requiresConfirmation: true
      };
    
    case 'watchVideo':
      // Video watching can happen immediately without confirmation
      return await watchVideo(
        actionData.platform, 
        actionData.videoId, 
        actionData.title,
        actionData.url // Add the URL parameter for self-hosted videos
      );
      
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

// Update the action endpoint to handle self-hosted videos
app.post("/action", async (req, res) => {
  const { actionType, actionData } = req.body;
  
  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.status(401).send({ error: "API keys not configured" });
    return;
  }
  
  try {
    let result;
    switch (actionType) {
      case 'sendGiftCard':
        result = await sendGiftCard(actionData.type, actionData.amount, actionData.recipient);
        break;
      case 'watchVideo':
        result = await watchVideo(
          actionData.platform, 
          actionData.videoId, 
          actionData.title,
          actionData.url
        );
        break;
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
    
    res.send({ success: true, result });
  } catch (error) {
    console.error("Error executing action:", error);
    res.status(500).send({ success: false, error: error.message });
  }
});

// Add an endpoint to serve self-hosted videos from a specific directory
app.use('/videos', express.static('videos'));

// Add an endpoint to list available self-hosted videos
app.get("/self-hosted-videos", async (req, res) => {
  try {
    // Read the videos directory
    const videosDir = './videos';
    
    // Create the directory if it doesn't exist
    try {
      await fs.access(videosDir);
    } catch (error) {
      await fs.mkdir(videosDir, { recursive: true });
    }
    
    // Get list of video files
    const files = await fs.readdir(videosDir);
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    
    // Filter for video files and create metadata
    const videos = files
      .filter(file => videoExtensions.some(ext => file.toLowerCase().endsWith(ext)))
      .map(file => {
        return {
          filename: file,
          title: file.replace(/\.[^/.]+$/, "").replace(/-|_/g, " "),
          url: `/videos/${file}`,
          thumbnail: `/videos/thumbnails/${file.replace(/\.[^/.]+$/, "")}.jpg` // Assuming thumbnails exist
        };
      });
    
    res.send({ videos });
  } catch (error) {
    console.error("Error listing self-hosted videos:", error);
    res.status(500).send({ error: error.message });
  }
});

// Add an endpoint to upload videos (optional)
app.post("/upload-video", express.raw({ type: 'video/*', limit: '50mb' }), async (req, res) => {
  try {
    const contentType = req.headers['content-type'];
    const extension = contentType.split('/')[1];
    const filename = `video_${Date.now()}.${extension}`;
    const filepath = `./videos/${filename}`;
    
    // Save the uploaded video
    await fs.writeFile(filepath, req.body);
    
    // Generate a thumbnail (this would require ffmpeg)
    // await generateThumbnail(filepath);
    
    res.send({ 
      success: true, 
      video: {
        filename,
        url: `/videos/${filename}`,
        title: `Uploaded video ${new Date().toLocaleString()}`
      }
    });
  } catch (error) {
    console.error("Error uploading video:", error);
    res.status(500).send({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
