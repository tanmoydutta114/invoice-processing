export default class EnvConfig {
  static get validKey() {
    return process.env.VALID_KEY ?? '';
  }

  static get port() {
    return process.env.PORT ?? 3000;
  }

  static get env() {
    return process.env.ENV === 'dev';
  }

  static get gcpBucket() {
    return process.env.GOOGLE_CLOUD_BUCKET ?? '';
  }

  static get geminiApiKey() {
    return process.env.GEMINI_API_KEY ?? '';
  }
  static get geminiModel() {
    return process.env.GEMINI_MODEL ?? '';
  }
}
