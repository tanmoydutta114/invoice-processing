import { Storage } from '@google-cloud/storage';
import path from 'path';
import { Logger } from '../utility/Logger.js';
import EnvConfig from '../utility/AppEnv.js';
import serviceAccount from '../../retailerapp-3b0a8825463d.json' with { type: 'json' };
import { ApiUtility } from '../utility/ApiUtility.js';
export class GoogleStorageController {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage({
      projectId: serviceAccount.project_id,
      keyFilename: 'retailerapp-3b0a8825463d.json',
    });

    this.bucketName = EnvConfig.gcpBucket;
  }

  async uploadFile(localFilePath: string, fileName: string): Promise<string> {
    try {
      const filePath = path.join(localFilePath, fileName);
      const gcpDestinationPath = `${ApiUtility.dateFormat()}/${fileName}`;

      await this.storage.bucket(this.bucketName).upload(filePath, {
        destination: gcpDestinationPath,
      });

      Logger.info(`File uploaded to Google Cloud: ${gcpDestinationPath}`);

      return `https://storage.googleapis.com/${this.bucketName}/${gcpDestinationPath}`;
    } catch (error) {
      Logger.error('GCP Upload Error', error);
      throw error;
    }
  }

  async fetchFileFromUrl(fileUrl: string): Promise<{ base64: string; mimeType: string }> {
    try {
      if (!fileUrl.includes(this.bucketName)) {
        throw new Error('Invalid GCP bucket URL');
      }

      const objectPath = fileUrl.split(`https://storage.googleapis.com/${this.bucketName}/`)[1];

      if (!objectPath) {
        throw new Error('Invalid file URL format');
      }

      const file = this.storage.bucket(this.bucketName).file(objectPath);

      const [buffer] = await file.download();

      const [metadata] = await file.getMetadata();

      return {
        base64: buffer.toString('base64'),
        mimeType: metadata.contentType || 'application/octet-stream',
      };
    } catch (error) {
      Logger.error('GCP Fetch Error', error);
      throw error;
    }
  }
}
