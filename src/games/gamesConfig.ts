import fs from "fs";
import path from "path";

const gamesFolderPath = path.join(__dirname);

const gameFolders = fs.readdirSync(gamesFolderPath).filter((folderName) => {
  return (
    fs.statSync(path.join(gamesFolderPath, folderName)).isDirectory() &&
    folderName !== "framework"
  );
});

console.log("gameFolders", gameFolders);

export const gameConfigs = gameFolders.map((folderName) => {
  const game = require(path.join(gamesFolderPath, folderName));
  return game.gameConfig;
});
