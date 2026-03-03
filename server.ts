import express from "express";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import cookieParser from "cookie-parser";
import { OAuth2Client } from "google-auth-library";
import { getShipStats } from "./src/utils/shipStats";

async function startServer() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });
  const PORT = 3000;

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

  // Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
      redirect_uri: redirectUri,
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    
    try {
      const { tokens } = await client.getToken({
        code: code as string,
        redirect_uri: redirectUri,
      });
      client.setCredentials(tokens);

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (payload) {
        const userData = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        };

        res.cookie("session", JSON.stringify(userData), {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/me", (req, res) => {
    const session = req.cookies.session;
    if (session) {
      try {
        res.json(JSON.parse(session));
      } catch (e) {
        res.status(401).json({ error: "Invalid session" });
      }
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("session", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    res.json({ success: true });
  });

  class GameRoom {
    id: string;
    isTraining: boolean;
    players = new Map();
    seedOwners = new Map();
    npcs = new Map();
    matchTime = 120;
    matchActive = true;
    matchResults: any[] = [];
    matchTimeout: NodeJS.Timeout | null = null;

    constructor(id: string, isTraining: boolean) {
      this.id = id;
      this.isTraining = isTraining;
      if (this.isTraining) {
        for (let i = 0; i < 5; i++) {
          this.spawnNPC(`npc-${i}`);
        }
      }
    }

    resetMatchTime() {
      this.matchTime = 120;
      if (this.matchTimeout) {
        clearTimeout(this.matchTimeout);
        this.matchTimeout = null;
      }
      
      if (!this.matchActive) {
        this.matchActive = true;
        this.players.forEach(p => {
          p.matchKills = 0;
          p.ownedSeeds = [p.activeSeed];
          const stats = getShipStats(p.activeSeed);
          p.health = stats.maxHealth;
          p.isDead = false;
          p.position = [(Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 500, -3000 + (Math.random() - 0.5) * 2000];
          p.quaternion = [0, 0, 0, 1];
        });

        this.npcs.clear();
        if (this.isTraining) {
          for (let i = 0; i < 5; i++) {
            this.spawnNPC(`npc-${i}`);
          }
        }

        io.to(this.id).emit("init", [...Array.from(this.players.values()), ...Array.from(this.npcs.values())]);
        io.to(this.id).emit("leaderboard:update", this.getLeaderboard());
      }
      
      io.to(this.id).emit("match:timer", this.matchTime);
      io.to(this.id).emit("match:start");
    }

    spawnNPC(id: string) {
      const seed = Math.random().toString(36).substring(2, 10).toUpperCase();
      const stats = getShipStats(seed);
      const npc = {
        id,
        name: `Drone-${id.substring(0, 4)}`,
        activeSeed: seed,
        stats: stats,
        position: [(Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 500, -3000 + (Math.random() - 0.5) * 2000],
        quaternion: [0, 0, 0, 1],
        health: stats.maxHealth * 0.5,
        isDead: false,
        isNPC: true,
        lastShoot: 0,
        velocity: (Math.random() * 50) + 50,
        turnSpeed: (Math.random() * 0.5) + 0.2,
      };
      this.npcs.set(id, npc);
      io.to(this.id).emit("player:join", npc);
    }

    getLeaderboard() {
      const lb = Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        shipsOwned: p.ownedSeeds.length,
        kills: p.matchKills || 0,
      }));
      lb.sort((a, b) => b.shipsOwned - a.shipsOwned || b.kills - a.kills);
      return lb.slice(0, 10);
    }
    
    updateNPCs() {
      if (!this.matchActive) return;
      this.npcs.forEach((npc, id) => {
        if (npc.isDead) return;

        const speed = npc.velocity * 0.1;
        npc.position[0] += (Math.random() - 0.5) * speed;
        npc.position[1] += (Math.random() - 0.5) * speed;
        npc.position[2] += (Math.random() - 0.5) * speed;

        io.to(this.id).emit("player:move", {
          id: npc.id,
          position: npc.position,
          quaternion: npc.quaternion,
        });

        if (Date.now() - npc.lastShoot > 3000 + Math.random() * 5000) {
          npc.lastShoot = Date.now();
          const bulletId = `bullet-npc-${id}-${Date.now()}`;
          io.to(this.id).emit("bullet:new", {
            id: bulletId,
            ownerId: npc.id,
            position: npc.position,
            velocity: [0, 0, 200],
            type: "normal"
          });
        }
      });
    }

    updateTimer() {
      if (this.matchTime > 0) {
        this.matchTime--;
        io.to(this.id).emit("match:timer", this.matchTime);
      } else if (this.matchActive) {
        this.matchActive = false;
        this.matchResults = Array.from(this.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          shipsOwned: p.ownedSeeds.length,
          kills: p.matchKills || 0,
        })).sort((a, b) => b.shipsOwned - a.shipsOwned);

        io.to(this.id).emit("match:end", this.matchResults);

        this.matchTimeout = setTimeout(() => {
          this.matchTime = 120;
          this.matchActive = true;
          this.matchTimeout = null;
          
          this.players.forEach(p => {
            p.matchKills = 0;
            p.ownedSeeds = [p.activeSeed];
            const stats = getShipStats(p.activeSeed);
            p.health = stats.maxHealth;
            p.isDead = false;
            p.position = [(Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 500, -3000 + (Math.random() - 0.5) * 2000];
            p.quaternion = [0, 0, 0, 1];
          });

          this.npcs.clear();
          if (this.isTraining) {
            for (let i = 0; i < 5; i++) {
              this.spawnNPC(`npc-${i}`);
            }
          }

          io.to(this.id).emit("match:start");
          io.to(this.id).emit("init", [...Array.from(this.players.values()), ...Array.from(this.npcs.values())]);
          io.to(this.id).emit("leaderboard:update", this.getLeaderboard());
        }, 10000);
      }
    }
  }

  const rooms = new Map<string, GameRoom>();
  
  // Global Multiplayer Room
  rooms.set("global", new GameRoom("global", false));

  setInterval(() => {
    rooms.forEach(room => {
      room.updateNPCs();
    });
  }, 100);

  setInterval(() => {
    rooms.forEach(room => {
      room.updateTimer();
    });
  }, 1000);

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);
    let currentRoomId: string | null = null;

    socket.on("join", (data) => {
      const isTraining = data.mode === "training";
      const roomId = isTraining ? `training-${socket.id}` : "global";
      currentRoomId = roomId;
      
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new GameRoom(roomId, isTraining));
      }
      const room = rooms.get(roomId)!;
      room.resetMatchTime();

      if (room.seedOwners.has(data.seed) && room.seedOwners.get(data.seed) !== socket.id) {
        socket.emit("join_error", "Seed already owned by another player!");
        return;
      }

      room.seedOwners.set(data.seed, socket.id);
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
      room.players.set(socket.id, newPlayer);
      
      socket.emit("join_success", newPlayer);
      socket.emit("init", [...Array.from(room.players.values()), ...Array.from(room.npcs.values())]);
      socket.to(roomId).emit("player:join", newPlayer);
      io.to(roomId).emit("leaderboard:update", room.getLeaderboard());
      socket.emit("match:timer", room.matchTime);
    });

    socket.on("move", (data) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (room && room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        player.position = data.position;
        player.quaternion = data.quaternion;
        socket.to(currentRoomId).emit("player:move", {
          id: socket.id,
          position: data.position,
          quaternion: data.quaternion,
        });
      }
    });

    socket.on("shoot", (data) => {
      if (!currentRoomId) return;
      io.to(currentRoomId).emit("bullet:new", { ...data, ownerId: socket.id });
    });

    socket.on("damage", (data) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const target = room.players.get(data.targetId) || room.npcs.get(data.targetId);
      const attacker = room.players.get(data.attackerId) || room.npcs.get(data.attackerId);

      if (target && target.health > 0 && !target.isDead) {
        let damageAmount = data.amount;
        if (attacker && data.bulletId !== "planet" && data.bulletId !== "player_collision") {
          damageAmount *= attacker.stats.damageMultiplier;
        }
        target.health -= damageAmount;
        
        io.to(currentRoomId).emit("player:health", { id: target.id, health: target.health });
        if (data.bulletId !== "planet" && data.bulletId !== "player_collision") {
          io.to(currentRoomId).emit("bullet:destroy", data.bulletId);
        }

        if (target.health <= 0) {
          target.health = 0;
          target.isDead = true;
          
          if (attacker && !attacker.isNPC && attacker.id !== target.id) {
            attacker.matchKills = (attacker.matchKills || 0) + 1;
          }

          if (attacker && !attacker.isNPC && !target.isNPC && attacker.id !== target.id) {
            target.ownedSeeds.forEach((seed: string) => {
              if (!attacker.ownedSeeds.includes(seed)) {
                attacker.ownedSeeds.push(seed);
                room.seedOwners.set(seed, attacker.id);
              }
            });
            target.ownedSeeds = [];
            io.to(currentRoomId).emit("leaderboard:update", room.getLeaderboard());
          }

          io.to(currentRoomId).emit("player:die", { id: target.id, attackerId: data.attackerId });
          
          setTimeout(() => {
            if (target.isNPC) {
              room.npcs.delete(target.id);
              room.spawnNPC(target.id);
            } else if (room.players.has(target.id)) {
              if (room.isTraining) {
                io.to(target.id).emit("training:failed");
              } else {
                const p = room.players.get(target.id);
                
                const newSeed = Math.random().toString(36).substring(2, 10).toUpperCase();
                room.seedOwners.set(newSeed, p.id);
                const newStats = getShipStats(newSeed);
                
                p.activeSeed = newSeed;
                p.ownedSeeds = [newSeed];
                p.stats = newStats;
                p.health = newStats.maxHealth;
                p.isDead = false;
                p.position = [(Math.random() - 0.5) * 500, 0, -2800 + (Math.random() - 0.5) * 500];
                
                io.to(currentRoomId).emit("player:respawn", { 
                  id: p.id, 
                  position: p.position, 
                  health: p.health,
                  activeSeed: p.activeSeed,
                  stats: p.stats
                });
                io.to(currentRoomId).emit("leaderboard:update", room.getLeaderboard());
              }
            }
          }, 3000);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const player = room.players.get(socket.id);
          if (player) {
            player.ownedSeeds.forEach((seed: string) => {
              room.seedOwners.delete(seed);
            });
            room.players.delete(socket.id);
            io.to(currentRoomId).emit("player:leave", socket.id);
            io.to(currentRoomId).emit("leaderboard:update", room.getLeaderboard());
          }
          
          // Cleanup training room
          if (room.isTraining && room.players.size === 0) {
            rooms.delete(currentRoomId);
          }
        }
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
