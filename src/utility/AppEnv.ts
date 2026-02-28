export default class EnvConfig {
  static get validKey() {
    return process.env.VALID_KEY ?? '';
  }

  static get validSecret() {
    return process.env.VALID_SECRET ?? '';
  }

  static get port() {
    return process.env.PORT ?? 3000;
  }

  static get env() {
    return process.env.ENV === 'dev';
  }

  static get ftpHost() {
    return process.env.FTP_HOST ?? '';
  }

  static get ftpUser() {
    return process.env.FTP_USER ?? '';
  }

  static get ftpPass() {
    return process.env.FTP_PASS ?? '';
  }

  static get gcpBucket() {
    return process.env.GOOGLE_CLOUD_BUCKET ?? '';
  }

  static get dbConnectionUrl() {
    return process.env.DB_URL ?? '';
  }
  static get ftpFilePath() {
    return process.env.FTP_FILE_PATH ?? '';
  }
  static get dbHost() {
    return process.env.DB_HOST ?? '';
  }
  static get dbPassword() {
    return process.env.DB_PASS ?? '';
  }
  static get dbUser() {
    return process.env.DB_USER ?? '';
  }
  static get dbDatabase() {
    return process.env.DB_DATABASE ?? '';
  }
  static get fileSource() {
    return process.env.FILE_SOURCE ?? '';
  }
  static get ftpPort() {
    return Number(process.env.FTP_PORT) ?? 22;
  }

  static get reportSPName() {
    return process.env.REPORT_SP_NAME ?? '';
  }

  static get emailReceiverInfo() {
    const emailIds = process.env.STATUS_EMAIL_RECEIVER_EMAILID?.split(';') ?? [];
    return {
      emailIds,
      firstName: process.env.STATUS_EMAIL_RECEIVER_FNAME ?? '',
      lastName: process.env.STATUS_EMAIL_RECEIVER_LNAME ?? '',
    };
  }

  static get reportEmaiLReceiverInfo() {
    const emailIds = process.env.REPORT_RECEIVER_EMAILIDs?.split(';') ?? [];
    return {
      emailIds,
      firstName: process.env.REPORT_RECEIVER_FNAME ?? '',
      lastName: process.env.REPORT_RECEIVER_LNAME ?? '',
    };
  }

  static get geminiApiKey() {
    return process.env.GEMINI_API_KEY ?? '';
  }
  static get geminiModel() {
    return process.env.GEMINI_MODEL ?? '';
  }
}
