import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });
  const PORT = 3000;

  const players = new Map();

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("join", (data) => {
      players.set(socket.id, {
        id: socket.id,
        parts: data.parts,
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
      });
      // Send all existing players to the new player
      socket.emit("init", Array.from(players.values()));
      // Tell others about the new player
      socket.broadcast.emit("player:join", players.get(socket.id));
    });

    socket.on("move", (data) => {
      if (players.has(socket.id)) {
        const player = players.get(socket.id);
        player.position = data.position;
        player.quaternion = data.quaternion;
        socket.broadcast.emit("player:move", {
          id: socket.id,
          position: data.position,
          quaternion: data.quaternion,
        });
      }
    });

    socket.on("shoot", (data) => {
      // Broadcast bullet to everyone including sender (or just others, let's do everyone for simplicity)
      io.emit("bullet:new", { ...data, playerId: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      players.delete(socket.id);
      io.emit("player:leave", socket.id);
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
