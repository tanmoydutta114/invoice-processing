import { Storage } from '@google-cloud/storage';
import path from 'path';
import { Logger } from '../utility/Logger.js';
import EnvConfig from '../utility/AppEnv.js';
import serviceAccount from '../../retailerapp-3b0a8825463d.json' with { type: 'json' };
import { ApiUtility } from '../utility/ApiUtility.js';
import { fileTypeFromBuffer } from 'file-type';
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
  async downloadFileAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    Logger.info(`Downloading file from URL: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download file. Status: ${response.status} ${response.statusText}`);
    }

    // Get mime type from headers
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Convert response to buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine MIME type from buffer
    const fileType = await fileTypeFromBuffer(buffer);
    const mimeType = fileType?.mime || 'image/jpeg';

    return {
      base64: buffer.toString('base64'),
      mimeType: mimeType || 'image/jpeg',
    };
  }
}
