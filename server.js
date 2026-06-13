const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ROOMS = ["lounge", "dev", "music", "random"];
const HISTORY_LIMIT = 50;
const MAX_NAME = 24;
const MAX_TEXT = 500;

const history = new Map(ROOMS.map((room) => [room, []]));
const users = new Map();

app.use(express.static(path.join(__dirname, "public")));

function roomUsers(room) {
  return [...users.values()]
    .filter((u) => u.room === room)
    .map((u) => u.name);
}

function pushHistory(room, message) {
  const list = history.get(room);
  list.push(message);
  if (list.length > HISTORY_LIMIT) list.shift();
}

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

io.on("connection", (socket) => {
  let lastMessageAt = 0;

  socket.on("join", ({ name, room }, ack) => {
    name = clean(name, MAX_NAME);
    if (!name) return ack?.({ error: "Pick a name first." });
    if (!ROOMS.includes(room)) room = ROOMS[0];

    const taken = [...users.values()].some(
      (u) => u.name.toLowerCase() === name.toLowerCase()
    );
    if (taken) return ack?.({ error: "That name is already in the room." });

    users.set(socket.id, { name, room });
    socket.join(room);

    ack?.({ rooms: ROOMS, room, history: history.get(room) });
    socket.to(room).emit("system", `${name} joined`);
    io.to(room).emit("presence", roomUsers(room));
  });

  socket.on("switch-room", (room, ack) => {
    const user = users.get(socket.id);
    if (!user || !ROOMS.includes(room) || room === user.room) return;

    const oldRoom = user.room;
    socket.leave(oldRoom);
    socket.to(oldRoom).emit("system", `${user.name} left`);
    io.to(oldRoom).emit("presence", roomUsers(oldRoom));

    user.room = room;
    socket.join(room);
    ack?.({ room, history: history.get(room) });
    socket.to(room).emit("system", `${user.name} joined`);
    io.to(room).emit("presence", roomUsers(room));
  });

  socket.on("message", (text) => {
    const user = users.get(socket.id);
    if (!user) return;

    const now = Date.now();
    if (now - lastMessageAt < 400) return;
    lastMessageAt = now;

    text = clean(text, MAX_TEXT);
    if (!text) return;

    const message = { user: user.name, text, time: now };
    pushHistory(user.room, message);
    io.to(user.room).emit("message", message);
  });

  socket.on("typing", (isTyping) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.to(user.room).emit("typing", { name: user.name, isTyping });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (!user) return;
    users.delete(socket.id);
    socket.to(user.room).emit("system", `${user.name} left`);
    io.to(user.room).emit("presence", roomUsers(user.room));
  });
});

server.listen(PORT, () => {
  console.log(`ember-chat running on http://localhost:${PORT}`);
});
