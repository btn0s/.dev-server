import express, { Express, Request, Response } from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import { IGameConfig, GameSessionManager } from "./games/framework";
import { GameSocketServer } from "./games/gameSocketServer";
import { gameConfigs } from "./games/gamesConfig";

dotenv.config();

const port = process.env.PORT || 8080;

export const app: Express = express();
const httpServer = http.createServer(app);

app.use(cors());

const gameServers: { [key: string]: GameSocketServer } = {};

// Dynamically set up game servers and endpoints
gameConfigs.forEach((gameConfig: IGameConfig) => {
  const gameServer = new GameSocketServer(httpServer, gameConfig);
  gameServers[gameConfig.name] = gameServer;

  const gameSessionManager = new GameSessionManager();

  app.get(gameConfig.gamePath, (req: Request, res: Response) => {
    res.send(gameConfig.name);
  });

  app.post(`${gameConfig.gamePath}/sessions`, (req, res) => {
    const sessionId = gameSessionManager.createSession(
      gameServer.io,
      gameConfig.rules,
    );
    res.json({ sessionId });
  });

  // get sessions
  app.get(`${gameConfig.gamePath}/sessions`, (req, res) => {
    const sessions = gameSessionManager.getSessions();
    res.json({ sessions: Array.from(sessions.keys()) });
  });

  // get session
  app.get(`${gameConfig.gamePath}/sessions/:sessionId`, (req, res) => {
    const sessionId = req.params.sessionId;
    const session = gameSessionManager.getSession(sessionId);
    if (session) {
      res.json({ session: session.getGameMode().getGameState() });
    } else {
      res.status(404).send(`Session ${sessionId} not found`);
    }
  });
});

// Any additional global routes
app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

httpServer.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
