const express = require('express');
const { createClient } = require('redis');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Serve static files from ../public
app.use(express.static('../client'));

// Redis setup
const redisClient = createClient();
redisClient.connect().catch(console.error);

// Use Redis Pub/Sub
const redisSubscriber = redisClient.duplicate();
redisSubscriber.connect().catch(console.error);

// Listen for messages published to 'chat' channel
redisSubscriber.subscribe('chat', (message) => {
  const parsedMessage = JSON.parse(message);
  io.emit('chat message', parsedMessage);
});

io.on('connection', (socket) => {
  console.log('New user connected');

  socket.on('chat message', async (msg) => {
    // msg should be { username, message }
    const messageData = {
      username: msg.username || "Anonymous",
      message: msg.message,
      timestamp: new Date()
    };

    // Save recent messages (optional)
    await redisClient.lPush('recentMessages', JSON.stringify(messageData));
    await redisClient.lTrim('recentMessages', 0, 49); // Keep last 50 messages

    // Publish message to Redis
    await redisClient.publish('chat', JSON.stringify(messageData));
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Endpoint to fetch recent messages
app.get('/recent', async (req, res) => {
  const messages = await redisClient.lRange('recentMessages', 0, -1);
  const parsedMessages = messages.map(msg => JSON.parse(msg));
  res.json(parsedMessages);
});

const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
