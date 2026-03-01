import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import { getShipStats } from "./src/utils/shipStats";

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
  const seedOwners = new Map(); // seed -> socket.id

  const getLeaderboard = () => {
    const lb = Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      shipsOwned: p.ownedSeeds.length,
    }));
    lb.sort((a, b) => b.shipsOwned - a.shipsOwned);
    return lb.slice(0, 10);
  };

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("join", (data) => {
      if (seedOwners.has(data.seed) && seedOwners.get(data.seed) !== socket.id) {
        socket.emit("join_error", "Seed already owned by another player!");
        return;
      }

      seedOwners.set(data.seed, socket.id);
      const stats = getShipStats(data.seed);

      const newPlayer = {
        id: socket.id,
        name: data.name || `Pilot-${socket.id.substring(0, 4)}`,
        activeSeed: data.seed,
        ownedSeeds: [data.seed],
        stats: stats,
        position: data.position || [0, 0, -2800],
        quaternion: data.quaternion || [0, 0, 0, 1],
        health: stats.maxHealth,
        isDead: false,
      };
      players.set(socket.id, newPlayer);
      
      socket.emit("join_success", newPlayer);
      socket.emit("init", Array.from(players.values()));
      socket.broadcast.emit("player:join", newPlayer);
      io.emit("leaderboard:update", getLeaderboard());
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
      io.emit("bullet:new", { ...data, ownerId: socket.id });
    });

    socket.on("damage", (data) => {
      const target = players.get(data.targetId);
      const attacker = players.get(data.attackerId);

      if (target && target.health > 0 && !target.isDead) {
        const damageAmount = data.amount * (attacker ? attacker.stats.damageMultiplier : 1);
        target.health -= damageAmount;
        
        io.emit("player:health", { id: target.id, health: target.health });
        io.emit("bullet:destroy", data.bulletId);

        if (target.health <= 0) {
          target.health = 0;
          target.isDead = true;
          
          // Transfer seeds
          if (attacker && attacker.id !== target.id) {
            target.ownedSeeds.forEach((seed: string) => {
              if (!attacker.ownedSeeds.includes(seed)) {
                attacker.ownedSeeds.push(seed);
                seedOwners.set(seed, attacker.id);
              }
            });
            target.ownedSeeds = [];
            io.emit("leaderboard:update", getLeaderboard());
          }

          io.emit("player:die", { id: target.id, attackerId: data.attackerId });
          
          // Respawn after 3 seconds
          setTimeout(() => {
            if (players.has(target.id)) {
              const p = players.get(target.id);
              
              // Generate new random seed for respawn
              const newSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
              seedOwners.set(newSeed, p.id);
              const newStats = getShipStats(newSeed);
              
              p.activeSeed = newSeed;
              p.ownedSeeds = [newSeed];
              p.stats = newStats;
              p.health = newStats.maxHealth;
              p.isDead = false;
              p.position = [(Math.random() - 0.5) * 500, 0, -2800 + (Math.random() - 0.5) * 500];
              
              io.emit("player:respawn", { 
                id: p.id, 
                position: p.position, 
                health: p.health,
                activeSeed: p.activeSeed,
                stats: p.stats
              });
              io.emit("leaderboard:update", getLeaderboard());
            }
          }, 3000);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      const player = players.get(socket.id);
      if (player) {
        // Free up seeds
        player.ownedSeeds.forEach((seed: string) => {
          seedOwners.delete(seed);
        });
        players.delete(socket.id);
        io.emit("player:leave", socket.id);
        io.emit("leaderboard:update", getLeaderboard());
      }
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
