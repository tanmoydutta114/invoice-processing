import winston from "winston";
import "winston-daily-rotate-file";
import fs from "fs";
import path from "path";

// Log directory
const LOG_DIR = path.join(__dirname, "../../logs");
const MESSAGE_LOG_DIR = path.join(LOG_DIR, "messages"); // Separate directory for messages

// Ensure log directories exist
const ensureLogDirExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Safe function to stringify complex objects
const safeStringify = (obj: any, space: number = 2) => {
  const seen = new WeakMap();

  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value))
          return `[Circular reference to ${seen.get(value)}]`;
        seen.set(value, key || "root");
      }
      return value;
    },
    space
  );
};

// Custom log format (handles circular references)
const logFormat = winston.format.printf(
  ({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? safeStringify(meta) : "";
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
  }
);

// Define Winston Logger
export class Logger {
  private static createLogger(type: string, logLevel: string) {
    ensureLogDirExists(path.join(LOG_DIR, type));

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        logFormat
      ),
      transports: [
        // ✅ Console Logging with Proper Formatting
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            logFormat
          ),
        }),

        // ✅ File Logging (Daily Rotation)
        new winston.transports.DailyRotateFile({
          filename: path.join(LOG_DIR, type, "%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          maxSize: "10m",
          maxFiles: "30d",
          zippedArchive: true,
        }),
      ],
    });
  }

  private static infoLogger = Logger.createLogger("info", "info");
  private static errorLogger = Logger.createLogger("error", "error");

  // ✅ Log informational messages (console + file)
  static info(message: string, meta: any = {}) {
    Logger.infoLogger.info(message, meta);
  }

  // ✅ Log errors (console + file)
  static error(message: string, meta: any = {}) {
    Logger.errorLogger.error(message, meta);
  }

  // ✅ Custom Logger for Messages
  static logMessage(roomId: string, sender: string, text: string) {
    ensureLogDirExists(MESSAGE_LOG_DIR); // Ensure messages folder exists

    const logFilePath = path.join(
      MESSAGE_LOG_DIR,
      `${new Date().toISOString().split("T")[0]}.log`
    );
    const logEntry = `${new Date().toISOString()} | Room: ${roomId} | Sender: ${sender} | Message: ${text}\n`;

    // Append the log entry to the file
    fs.appendFile(logFilePath, logEntry, (err) => {
      if (err) {
        Logger.error("Failed to write message log", { error: err.message });
      }
    });
  }
}
