import { IGameConfig } from "../framework";

export const gameConfig: IGameConfig = {
  name: "321bang",
  gamePath: "/games/321bang",
  rules: {
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
  },
};
