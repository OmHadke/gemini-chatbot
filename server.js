const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// In-memory chat store: { chatId: { messages: [], documentText: null, imageData: null, imageMimeType: null } }
const chats = {};

function getOrCreateChat(chatId) {
  if (!chats[chatId]) {
    chats[chatId] = { messages: [], documentText: null, imageData: null, imageMimeType: null };
  }
  return chats[chatId];
}

// POST /api/chat/new — create a new chat session
app.post("/api/chat/new", (req, res) => {
  const chatId = uuidv4();
  chats[chatId] = { messages: [], documentText: null, imageData: null, imageMimeType: null };
  res.json({ chatId });
});

// POST /api/chat/:chatId/upload/document — upload PDF or TXT
app.post("/api/chat/:chatId/upload/document", upload.single("file"), async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = getOrCreateChat(chatId);

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { mimetype, buffer, originalname } = req.file;
    let text = "";

    if (mimetype === "application/pdf") {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (mimetype === "text/plain") {
      text = buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Only PDF and TXT files are supported" });
    }

    chat.documentText = text;
    res.json({ success: true, filename: originalname, characterCount: text.length });
  } catch (err) {
    console.error("Document upload error:", err);
    res.status(500).json({ error: "Failed to process document" });
  }
});

// POST /api/chat/:chatId/upload/image — upload PNG or JPG
app.post("/api/chat/:chatId/upload/image", upload.single("file"), async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = getOrCreateChat(chatId);

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { mimetype, buffer, originalname } = req.file;
    if (!["image/png", "image/jpeg"].includes(mimetype)) {
      return res.status(400).json({ error: "Only PNG and JPG images are supported" });
    }

    chat.imageData = buffer.toString("base64");
    chat.imageMimeType = mimetype;

    // Return a data URL for preview
    const dataUrl = `data:${mimetype};base64,${chat.imageData}`;
    res.json({ success: true, filename: originalname, previewUrl: dataUrl });
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: "Failed to process image" });
  }
});

// POST /api/chat/:chatId/message — send a message
app.post("/api/chat/:chatId/message", async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message, apiKey } = req.body;

    if (!message || !message.trim()) return res.status(400).json({ error: "Message is required" });
    if (!apiKey) return res.status(400).json({ error: "Gemini API key is required" });

    const chat = getOrCreateChat(chatId);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build the parts for the current user message
    const userParts = [];

    // If there's document text, prepend it as context on first message or if not yet included
    let contextPrefix = "";
    if (chat.documentText && chat.messages.length === 0) {
      contextPrefix = `[Uploaded Document Content]:\n${chat.documentText.slice(0, 15000)}\n\n[User Message]: `;
    }

    userParts.push({ text: contextPrefix + message });

    // If there's an image, include it
    if (chat.imageData) {
      userParts.push({
        inlineData: {
          mimeType: chat.imageMimeType,
          data: chat.imageData,
        },
      });
    }

    // Build conversation history for Gemini
    const history = chat.messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // If doc exists and there are prior messages, inject doc as system context in history
    let geminiHistory = history;
    if (chat.documentText && chat.messages.length > 0) {
      // Inject doc context into the very first user message if not already there
      if (geminiHistory.length > 0 && !geminiHistory[0].parts[0].text.startsWith("[Uploaded Document")) {
        geminiHistory = [
          {
            role: "user",
            parts: [{ text: `[Uploaded Document Content]:\n${chat.documentText.slice(0, 15000)}\n\n[User Message]: ${geminiHistory[0].parts[0].text}` }],
          },
          ...geminiHistory.slice(1),
        ];
      }
    }

    const chatSession = model.startChat({ history: geminiHistory });
    const result = await chatSession.sendMessage(userParts);
    const botResponse = result.response.text();

    // Store messages
    chat.messages.push({ role: "user", content: message });
    chat.messages.push({ role: "assistant", content: botResponse });

    res.json({ response: botResponse, chatId });
  } catch (err) {
    console.error("Message error:", err);
    const msg = err.message || "Failed to get response from Gemini";
    res.status(500).json({ error: msg });
  }
});

// GET /api/chat/:chatId — get chat history
app.get("/api/chat/:chatId", (req, res) => {
  const { chatId } = req.params;
  const chat = chats[chatId];
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({
    messages: chat.messages,
    hasDocument: !!chat.documentText,
    hasImage: !!chat.imageData,
  });
});

// GET /api/chats — list all chat IDs (for bonus multi-chat UI)
app.get("/api/chats", (req, res) => {
  const chatList = Object.entries(chats).map(([id, chat]) => ({
    id,
    messageCount: chat.messages.length,
    hasDocument: !!chat.documentText,
    hasImage: !!chat.imageData,
    preview: chat.messages.length > 0 ? chat.messages[0].content.slice(0, 60) : "New Chat",
  }));
  res.json(chatList);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Gemini Chatbot backend running on port ${PORT}`));
