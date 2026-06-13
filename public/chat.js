const socket = io();

const loginScreen = document.getElementById("login");
const loginForm = document.getElementById("login-form");
const loginName = document.getElementById("login-name");
const loginError = document.getElementById("login-error");
const roomPick = document.getElementById("room-pick");
const appScreen = document.getElementById("app");
const roomsNav = document.getElementById("rooms");
const roomTitle = document.getElementById("room-title");
const messagesBox = document.getElementById("messages");
const composer = document.getElementById("composer");
const composerInput = document.getElementById("composer-input");
const typingLabel = document.getElementById("typing");
const onlineCount = document.getElementById("online-count");
const onlineList = document.getElementById("online-list");

const DEFAULT_ROOMS = ["lounge", "dev", "music", "random"];
let me = null;
let currentRoom = "lounge";
let typingTimer = null;
const typers = new Set();

function renderRoomPick() {
  roomPick.innerHTML = "";
  DEFAULT_ROOMS.forEach((room, i) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="room" value="${room}" ${i === 0 ? "checked" : ""}><span>#${room}</span>`;
    roomPick.appendChild(label);
  });
}

function renderRooms(rooms) {
  roomsNav.innerHTML = "";
  rooms.forEach((room) => {
    const btn = document.createElement("button");
    btn.textContent = `#${room}`;
    btn.className = room === currentRoom ? "active" : "";
    btn.addEventListener("click", () => switchRoom(room));
    roomsNav.appendChild(btn);
  });
}

function renderPresence(names) {
  onlineCount.textContent = names.length;
  onlineList.innerHTML = "";
  names.forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    if (name === me) li.classList.add("me");
    onlineList.appendChild(li);
  });
}

function timeLabel(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMessage({ user, text, time }) {
  const row = document.createElement("div");
  row.className = "msg" + (user === me ? " own" : "");

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${user} · ${timeLabel(time)}`;

  const body = document.createElement("p");
  body.textContent = text;

  bubble.append(meta, body);
  row.appendChild(bubble);
  messagesBox.appendChild(row);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function addSystem(text) {
  const row = document.createElement("div");
  row.className = "sys";
  row.textContent = text;
  messagesBox.appendChild(row);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function loadHistory(history) {
  messagesBox.innerHTML = "";
  history.forEach(addMessage);
}

function switchRoom(room) {
  socket.emit("switch-room", room, (res) => {
    if (!res) return;
    currentRoom = res.room;
    roomTitle.textContent = `#${currentRoom}`;
    typers.clear();
    updateTyping();
    loadHistory(res.history);
    renderRooms(DEFAULT_ROOMS);
  });
}

function updateTyping() {
  const names = [...typers];
  if (!names.length) {
    typingLabel.textContent = "";
  } else if (names.length === 1) {
    typingLabel.textContent = `${names[0]} is typing…`;
  } else {
    typingLabel.textContent = `${names.length} people are typing…`;
  }
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = loginName.value.trim();
  const room = loginForm.room.value;
  if (!name) return;

  socket.emit("join", { name, room }, (res) => {
    if (res.error) {
      loginError.textContent = res.error;
      return;
    }
    me = name;
    currentRoom = res.room;
    roomTitle.textContent = `#${currentRoom}`;
    loadHistory(res.history);
    renderRooms(res.rooms);
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    composerInput.focus();
  });
});

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = composerInput.value.trim();
  if (!text) return;
  socket.emit("message", text);
  composerInput.value = "";
  socket.emit("typing", false);
});

composerInput.addEventListener("input", () => {
  socket.emit("typing", true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit("typing", false), 1200);
});

socket.on("message", addMessage);
socket.on("system", addSystem);
socket.on("presence", renderPresence);

socket.on("typing", ({ name, isTyping }) => {
  if (isTyping) typers.add(name);
  else typers.delete(name);
  updateTyping();
});

socket.on("disconnect", () => addSystem("Connection lost — retrying…"));
socket.on("connect", () => {
  if (me) addSystem("Reconnected. You may need to rejoin.");
});

renderRoomPick();
