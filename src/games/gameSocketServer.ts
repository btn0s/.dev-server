import { Server } from "socket.io";
import http from "http";
import { IGameConfig } from "../games/framework";

export class GameSocketServer {
  io: Server;

  constructor(httpServer: http.Server, gameConfig: IGameConfig) {
    console.log(`Starting ${gameConfig.name} socket server...`);
    this.io = new Server(httpServer, {
      path: `${gameConfig.gamePath}/play`,
    });
  }

  // Any additional methods for this game's socket server
}
