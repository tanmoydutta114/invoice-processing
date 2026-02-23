import { Storage } from "@google-cloud/storage";
import { Logger } from "../utility/Logger";
import EnvConfig from "../utility/AppEnv";
import serviceAccount from "../../retailerapp-3b0a8825463d.json";
import { ApiUtility } from "../utility/ApiUtility";
export class GoogleStorageController {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage({
      projectId: serviceAccount.project_id,
      keyFilename: "retailerapp-3b0a8825463d.json",
    });
    this.bucketName = EnvConfig.gcpBucket;
  }

  async uploadFile(localFilePath: string, destinationPath: string) {
    const filePath = `${localFilePath}/${destinationPath}`;
    const GCPBucketDestinationPath = `${ApiUtility.dateFormat()}/${destinationPath}`;
    const fileUploadRes = await this.storage
      .bucket(this.bucketName)
      .upload(filePath, {
        destination: GCPBucketDestinationPath,
      });
    // const res = await fileUploadRes[0].makePublic(); // TODO : Keep this for making the file public but for now we are not making it public
    // console.log(res);
    Logger.info(`File uploaded to Google Cloud: ${destinationPath}`);
    return `https://storage.googleapis.com/${this.bucketName}/${GCPBucketDestinationPath}`;
  }

  async fetchFileFromUrl(
    fileUrl: string,
  ): Promise<{ base64: string; mimeType: string }> {
    const response = await this.storage.bucket(this.bucketName).getFiles({
      prefix: fileUrl.split(
        `https://storage.googleapis.com/${this.bucketName}/`,
      )[1],
    });

    const arrayBuffer = response[0];
    //const buffer = Buffer.from(arrayBuffer);

    // return {
    //   base64: arrayBuffer //buffer.toString("base64"),
    //   mimeType: contentType,
    // };
  }
}
