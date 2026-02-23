import dotenv from "dotenv";
dotenv.config();

import https from "https";
import app from "./route/app";
import EnvConfig from "./utility/AppEnv";
import { Logger } from "./utility/Logger";
import fs from "fs";

const PORT = EnvConfig.port;

const sslOptions = {
  cert: fs.readFileSync("fullchain1.pem"),
  key: fs.readFileSync("privkey1.pem"),
};

// Create HTTP Server
const server = https.createServer(sslOptions, app);

setInterval(() => {
  Logger.info("Forcing Garbage Collection...");
  if (global.gc) {
    global.gc();
  }
}, 300000); // Every 5 minutes

// Start the server
server.listen(PORT, () => {
  Logger.info(`Integration Server is running on port ${PORT}...`);
});
