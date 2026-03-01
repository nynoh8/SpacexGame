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
      const newPlayer = {
        id: socket.id,
        parts: data.parts,
        position: [0, 0, -2800], // Spawn near the center but a bit away
        quaternion: [0, 0, 0, 1],
        health: 100,
      };
      players.set(socket.id, newPlayer);
      // Send all existing players to the new player
      socket.emit("init", Array.from(players.values()));
      // Tell others about the new player
      socket.broadcast.emit("player:join", newPlayer);
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
      io.emit("bullet:new", { ...data, playerId: socket.id });
    });

    socket.on("damage", (data) => {
      const target = players.get(data.targetId);
      if (target && target.health > 0) {
        target.health -= data.amount;
        io.emit("player:health", { id: target.id, health: target.health });
        
        // Also broadcast bullet destroy so everyone removes it
        io.emit("bullet:destroy", data.bulletId);

        if (target.health <= 0) {
          io.emit("player:die", { id: target.id });
          
          // Respawn after 3 seconds
          setTimeout(() => {
            if (players.has(target.id)) {
              const p = players.get(target.id);
              p.health = 100;
              p.position = [(Math.random() - 0.5) * 500, 0, -2800 + (Math.random() - 0.5) * 500];
              io.emit("player:respawn", { id: target.id, position: p.position, health: p.health });
            }
          }, 3000);
        }
      }
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
