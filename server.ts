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
  const npcs = new Map();

  // Match State
  let matchTime = 120; // 2 minutes
  let matchActive = true;
  let matchResults: any[] = [];

  const getLeaderboard = () => {
    const lb = Array.from(players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      shipsOwned: p.ownedSeeds.length,
      kills: p.matchKills || 0,
    }));
    lb.sort((a, b) => b.shipsOwned - a.shipsOwned || b.kills - a.kills);
    return lb.slice(0, 10);
  };

  // NPC Logic
  const spawnNPC = (id: string) => {
    const seed = Math.random().toString(36).substring(2, 10).toUpperCase();
    const stats = getShipStats(seed);
    const npc = {
      id,
      name: `Drone-${id.substring(0, 4)}`,
      activeSeed: seed,
      stats: stats,
      position: [(Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 500, -3000 + (Math.random() - 0.5) * 2000],
      quaternion: [0, 0, 0, 1],
      health: stats.maxHealth * 0.5, // NPCs are weaker
      isDead: false,
      isNPC: true,
      lastShoot: 0,
      velocity: (Math.random() * 50) + 50,
      turnSpeed: (Math.random() * 0.5) + 0.2,
    };
    npcs.set(id, npc);
    io.emit("player:join", npc);
  };

  // Initial NPCs
  for (let i = 0; i < 5; i++) {
    spawnNPC(`npc-${i}`);
  }

  // NPC Update Loop
  setInterval(() => {
    if (!matchActive) return;
    npcs.forEach((npc, id) => {
      if (npc.isDead) return;

      // Simple AI: Move forward and rotate slowly
      // In a real server, we'd do full 3D math, but for now we'll just simulate movement
      // and broadcast it.
      const speed = npc.velocity * 0.1;
      // Just drift them for now
      npc.position[0] += (Math.random() - 0.5) * speed;
      npc.position[1] += (Math.random() - 0.5) * speed;
      npc.position[2] += (Math.random() - 0.5) * speed;

      io.emit("player:move", {
        id: npc.id,
        position: npc.position,
        quaternion: npc.quaternion,
      });

      // Occasional shooting
      if (Date.now() - npc.lastShoot > 3000 + Math.random() * 5000) {
        npc.lastShoot = Date.now();
        const bulletId = `bullet-npc-${id}-${Date.now()}`;
        // Shoot forward (simplified)
        io.emit("bullet:new", {
          id: bulletId,
          ownerId: npc.id,
          position: npc.position,
          velocity: [0, 0, 200], // Simplified velocity
          type: "normal"
        });
      }
    });
  }, 100);

  // Match Timer Loop
  setInterval(() => {
    if (matchTime > 0) {
      matchTime--;
      io.emit("match:timer", matchTime);
    } else if (matchActive) {
      matchActive = false;
      // Match End
      matchResults = Array.from(players.values()).map(p => ({
        id: p.id,
        name: p.name,
        shipsOwned: p.ownedSeeds.length,
        kills: p.matchKills || 0,
      })).sort((a, b) => b.shipsOwned - a.shipsOwned);

      io.emit("match:end", matchResults);

      // Restart after 10 seconds
      setTimeout(() => {
        matchTime = 120;
        matchActive = true;
        
        // Reset players
        players.forEach(p => {
          p.matchKills = 0;
          p.ownedSeeds = [p.activeSeed];
          const stats = getShipStats(p.activeSeed);
          p.health = stats.maxHealth;
          p.isDead = false;
          p.position = [(Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 500, -3000 + (Math.random() - 0.5) * 2000];
          p.quaternion = [0, 0, 0, 1];
        });

        // Reset NPCs
        npcs.clear();
        for (let i = 0; i < 5; i++) {
          spawnNPC(`npc-${i}`);
        }

        io.emit("match:start");
        io.emit("init", [...Array.from(players.values()), ...Array.from(npcs.values())]);
        io.emit("leaderboard:update", getLeaderboard());
      }, 10000);
    }
  }, 1000);

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
        matchKills: 0,
      };
      players.set(socket.id, newPlayer);
      
      socket.emit("join_success", newPlayer);
      socket.emit("init", [...Array.from(players.values()), ...Array.from(npcs.values())]);
      socket.broadcast.emit("player:join", newPlayer);
      io.emit("leaderboard:update", getLeaderboard());
      socket.emit("match:timer", matchTime);
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
      const target = players.get(data.targetId) || npcs.get(data.targetId);
      const attacker = players.get(data.attackerId) || npcs.get(data.attackerId);

      if (target && target.health > 0 && !target.isDead) {
        let damageAmount = data.amount;
        if (attacker && data.bulletId !== "planet" && data.bulletId !== "player_collision") {
          damageAmount *= attacker.stats.damageMultiplier;
        }
        target.health -= damageAmount;
        
        io.emit("player:health", { id: target.id, health: target.health });
        if (data.bulletId !== "planet" && data.bulletId !== "player_collision") {
          io.emit("bullet:destroy", data.bulletId);
        }

        if (target.health <= 0) {
          target.health = 0;
          target.isDead = true;
          
          // Track kills
          if (attacker && !attacker.isNPC && attacker.id !== target.id) {
            attacker.matchKills = (attacker.matchKills || 0) + 1;
          }

          // Transfer seeds (only between real players)
          if (attacker && !attacker.isNPC && !target.isNPC && attacker.id !== target.id) {
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
          
          // Respawn logic
          setTimeout(() => {
            if (target.isNPC) {
              // NPC respawn
              npcs.delete(target.id);
              spawnNPC(target.id);
            } else if (players.has(target.id)) {
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
