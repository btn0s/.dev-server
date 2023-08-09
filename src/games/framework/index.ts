import { Server, Socket } from "socket.io";

const DEFAULT_RULES: IGameRules = {
  roundsToWinMatch: 3,
  scoreToWinRound: 1,
  maxPlayers: 2,
  minPlayers: 2,
  timerDurations: {
    default: 3000,
    lobby: 5000,
    round: {
      prePlay: 5000,
      play: 30000,
      postPlay: 5000,
    },
  },
};

enum EGameEvent {
  UPDATE_GAME_STATE = "UPDATE_GAME_STATE",
  PLAYER_READY = "PLAYER_READY",
  PLAYER_SCORED = "PLAYER_SCORED",
}

enum EMatchPhase {
  LOBBY = "LOBBY",
  PLAY = "PLAY",
  COMPLETE = "COMPLETE",
}

enum ERoundPhase {
  STARTING = "STARTING",
  PRE_PLAY = "PRE_PLAY",
  PLAY = "PLAY",
  POST_PLAY = "POST_PLAY",
  ENDING = "ENDING",
}

export interface IGameRules {
  roundsToWinMatch: number;
  scoreToWinRound: number;
  maxPlayers: number;
  minPlayers: number;
  timerDurations: {
    // time to wait before starting the match, after all players are ready in lobby
    lobby: number;
    round: {
      // time to wait before starting the round
      prePlay: number;
      // time to play the round
      play: number;
      // time to wait after the round has finished
      postPlay: number;
    };
    default: number;
  };
}

export interface IGameConfig {
  name: string;
  gamePath: string;
  rules: IGameRules;
}

class PlayerState {
  id: string;
  roundScore: number;
  roundsWon: number;
  isReady: boolean;

  constructor(id: string) {
    this.id = id;
    this.roundScore = 0;
    this.roundsWon = 0;
    this.isReady = false;
  }

  incrementRoundScore() {
    this.roundScore++;
  }
}

class GameState {
  rules: IGameRules;
  matchPhase: EMatchPhase;
  roundPhase: ERoundPhase;
  players: PlayerState[];
  currentTimerDuration: number;

  constructor(rules: IGameRules) {
    console.log("Creating game state...");

    this.rules = rules;
    this.matchPhase = EMatchPhase.LOBBY;
    this.roundPhase = ERoundPhase.STARTING;
    this.players = [];
    this.currentTimerDuration = 0;
  }

  /** State getters */
  setMatchPhase(phase: EMatchPhase) {
    this.matchPhase = phase;
  }

  setRoundPhase(phase: ERoundPhase) {
    this.roundPhase = phase;
  }

  getPlayers() {
    return this.players;
  }
}

export class GameMode {
  private readonly gameSession: GameSession;
  private readonly gameState: GameState;
  private currentTimer?: NodeJS.Timeout; // This will store the reference to the timer

  constructor(gameSession: GameSession, rules: IGameRules = DEFAULT_RULES) {
    console.log(`Starting game mode...`);

    this.gameSession = gameSession;
    this.gameState = new GameState(rules);

    const server = this.gameSession.io;

    // Listen to RPC requests from clients
    server.on("connection", (socket) => {
      socket.on(EGameEvent.PLAYER_READY, this.onPlayerReady.bind(this));
      socket.on(EGameEvent.PLAYER_SCORED, this.onPlayerScored.bind(this));
      // ... other event listeners as needed
    });
  }

  /** Game State */
  getGameState(): GameState {
    return this.gameState;
  }

  /** Players */
  addPlayer(player: PlayerState) {
    if (
      this.getGameState().getPlayers().length <
      this.getGameState().rules.maxPlayers
    ) {
      this.getGameState().getPlayers().push(player);
    } else {
      console.log("Too many players");
    }
  }
  removePlayer(player: PlayerState) {
    const index = this.getGameState().getPlayers().indexOf(player);
    if (index > -1) {
      this.getGameState().getPlayers().splice(index, 1);
    } else {
      console.log("Player not found");
    }
    if (this.getGameState().getPlayers().length < 1) {
      this.gameSession.endSession();
    }
  }

  /** Event Handlers */
  onPlayerReady(playerId: string) {
    const player = this.getGameState().players.find((ps) => ps.id === playerId);
    if (!player) {
      console.log("Player not found");
      return;
    }
    player.isReady = true;
    this.multiCastGameState();
    this.checkAllPlayersReady();
  }
  onPlayerScored(playerId: string) {
    const player = this.getGameState().players.find((ps) => ps.id === playerId);
    if (!player) {
      console.log("Player not found");
      return;
    }

    player.incrementRoundScore();

    const roundWinner = this.checkRoundWinConditions();
    if (roundWinner) {
      roundWinner.roundsWon++;
      this.setRoundPhase(ERoundPhase.POST_PLAY);
    }
  }

  /** State Transitions */
  checkAllPlayersReady() {
    const hasEnoughPlayers =
      this.getGameState().players.length ===
      this.getGameState().rules.minPlayers;
    const isAllPlayersReady = this.getGameState().players.every(
      (p) => p.isReady,
    );

    if (hasEnoughPlayers && isAllPlayersReady) {
      this.startCountdown(
        () => this.setMatchPhase(EMatchPhase.PLAY),
        this.getGameState().rules.timerDurations.lobby,
      );
    }
  }
  setMatchPhase(phase: EMatchPhase) {
    this.getGameState().setMatchPhase(phase);
    switch (phase) {
      case EMatchPhase.LOBBY:
        // Lobby logic, if any
        break;
      case EMatchPhase.PLAY:
        this.setRoundPhase(ERoundPhase.STARTING);
        break;
      case EMatchPhase.COMPLETE:
        // Match completion logic
        break;
    }
    this.multiCastGameState();
  }
  setRoundPhase(phase: ERoundPhase) {
    this.getGameState().setRoundPhase(phase);
    switch (phase) {
      case ERoundPhase.STARTING:
        // Reset game state and player scores for the new round
        this.getGameState()
          .getPlayers()
          .forEach((player) => {
            player.roundScore = 0;
          });
        this.startCountdown(() => this.setRoundPhase(ERoundPhase.PRE_PLAY), 1);
        break;
      case ERoundPhase.PRE_PLAY:
        // Start the countdown for actual gameplay
        this.startCountdown(
          () => this.setRoundPhase(ERoundPhase.PLAY),
          this.getGameState().rules.timerDurations.round.prePlay,
        );
        break;
      case ERoundPhase.PLAY:
        this.startCountdown(
          () => {},
          (Math.floor(Math.random() * 10) + 1) * 1000,
        );
        // Game logic will be handled elsewhere, e.g., onPlayerScored
        break;
      case ERoundPhase.POST_PLAY:
        // Show winner of the round and any relevant information (handled on client)
        this.startCountdown(
          () => this.setRoundPhase(ERoundPhase.ENDING),
          this.getGameState().rules.timerDurations.round.postPlay,
        );
        break;
      case ERoundPhase.ENDING:
        // Check if there's a match winner
        if (this.checkMatchWinConditions()) {
          this.setMatchPhase(EMatchPhase.COMPLETE);
        } else {
          // Start a new round if no match winner
          this.setRoundPhase(ERoundPhase.STARTING);
        }
        break;
    }
    this.multiCastGameState();
  }

  /** Timers & Utility */
  startCountdown(callback: () => void, duration?: number) {
    // Clear the existing timer if it exists
    if (this.currentTimer) {
      clearInterval(this.currentTimer);
    }

    const countdownDuration =
      duration || this.getGameState().rules.timerDurations.default;
    this.getGameState().currentTimerDuration = countdownDuration / 1000;

    this.currentTimer = setInterval(() => {
      this.getGameState().currentTimerDuration--;
      this.multiCastGameState();

      if (this.getGameState().currentTimerDuration <= 0) {
        clearInterval(this.currentTimer);
        callback();
      }
    }, 1000); // 1 second
  }

  checkRoundWinConditions(): PlayerState | undefined {
    return this.getGameState()
      .getPlayers()
      .find(
        (player) =>
          player.roundScore >= this.getGameState().rules.scoreToWinRound,
      );
  }
  checkMatchWinConditions(): boolean {
    return this.getGameState()
      .getPlayers()
      .some(
        (player) =>
          player.roundsWon >= this.getGameState().rules.roundsToWinMatch,
      );
  }
  multiCastGameState() {
    console.log("Sending game state to all players");
    this.gameSession
      .getRoom()
      .emit(EGameEvent.UPDATE_GAME_STATE, this.getGameState());
  }
}

export class GameSession {
  io: Server;
  room: string = "";
  gameMode: GameMode;
  sessionManager: GameSessionManager;

  constructor(
    server: Server,
    gameModeRules: IGameRules,
    manager: GameSessionManager,
  ) {
    console.log("Starting game session...");

    this.io = server;
    this.gameMode = new GameMode(this, gameModeRules);
    this.sessionManager = manager;

    // Handle socket connections
    this.io.on("connection", (socket: Socket) => this.handleConnection(socket));
  }

  /** Framework Object getters */
  getGameMode() {
    return this.gameMode;
  }

  getRoom() {
    return this.io.to(this.room);
  }

  /** Handle a new player connection */
  private handleConnection(socket: Socket) {
    console.log(`Player connected: ${socket.id}`);
    console.log(`Session ID: ${socket.handshake.query["sessionId"]}`);

    this.room = `gameSession-${socket.handshake.query["sessionId"]}`;

    if (!this.room) {
      console.log("No room specified");
      return;
    }

    socket.join(this.room);

    const player = new PlayerState(socket.id);
    this.gameMode.addPlayer(player);

    this.getGameMode().multiCastGameState();

    socket.on("disconnect", () => {
      console.log(`Player disconnected: ${socket.id}`);

      const player = this.getGameMode()
        .getGameState()
        .getPlayers()
        .find((p) => p.id === socket.id);

      if (player) {
        this.gameMode.removePlayer(player);
        this.getGameMode().multiCastGameState();
      }
    });
  }

  endSession() {
    this.sessionManager.endSession(this.room);
  }
}

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();

  createSession(server: Server, gameModeRules: IGameRules): string {
    const sessionId = this.generateSessionId();
    const session = new GameSession(server, gameModeRules, this);
    this.sessions.set(sessionId, session);
    console.log(`Created session ${sessionId}`);
    console.log(`Total sessions: ${this.sessions.size}`);
    return sessionId;
  }

  getSessions(): Map<string, GameSession> {
    return this.sessions;
  }

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  private generateSessionId(): string {
    // Generate a unique ID for the session. Use any method you prefer.
    return Math.random().toString(36).substr(2, 9);
  }

  endSession(sessionId: string) {
    const session = this.getSession(sessionId);
    if (session) {
      session.endSession();
      this.sessions.delete(sessionId);
    }
  }
}
