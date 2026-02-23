import { SFTPController } from "../controllers/SFTPController";
import { GoogleStorageController } from "../controllers/GoogleStorageController";
import { FileProcessor } from "../controllers/FileProcessor";
import { DatabaseService } from "./DatabaseService";
import { Logger } from "../utility/Logger";
import path from "path";
import { Request, Response } from "express";
import { HttpStatusCode } from "../utility/HttpStatusCode";
import EnvConfig from "../utility/AppEnv";
import { FTPController } from "../controllers/FTPController";
import { MailController } from "../controllers/MailController";
import { SendEmailParams } from "../types/types";

export class PrimarySalesService {
  static async processPrimarySales(req: Request, res: Response) {
    const sftpController = new SFTPController();
    const ftpController = new FTPController();
    const dbService = new DatabaseService();
    const connection = await dbService.pool.getConnection();
    let localFilePath: string;
    let logId: number | null;
    const tempDownloadFolderPath = path.join(__dirname, `../../downloads`);
    const fileSource = EnvConfig.fileSource;
    const emailInfo = EnvConfig.emailReceiverInfo;

    const currentDate = new Date();
    let fileName: string;

    const emailDataList: SendEmailParams[] = [];
    let emailMessage: string;
    emailInfo.emailIds.forEach((emailId) => {
      emailDataList.push({
        firstName: emailInfo.firstName,
        lastName: emailInfo.lastName,
        mailto: emailId,
        message: emailMessage, // Update later in the process
        subject: ``, // Update later in the process
      });
    });

    try {
      const gcsController = new GoogleStorageController();
      const ftpFilePath = EnvConfig.ftpFilePath;
      if (fileSource === "FTP") {
        await ftpController.connect();
        fileName = await ftpController.getLatestFileFromRoot();

        if (!fileName) {
          Logger.info("No sales data file found, exiting process");
          return res.status(HttpStatusCode.NOT_FOUND).send({
            success: false,
            message: "No sales data file found, exiting process",
          });
        }
        localFilePath = path.join(__dirname, `../../downloads/`);
        await ftpController.downloadFile(ftpFilePath, localFilePath, fileName);
      } else {
        await sftpController.connect();
        fileName = await sftpController.getLatestFileFromRoot();
        if (!fileName) {
          Logger.info("No sales data file found, exiting process");
          return res.status(HttpStatusCode.NOT_FOUND).send({
            success: false,
            message: "No sales data file found, exiting process",
          });
        }
        localFilePath = path.join(__dirname, `../../downloads/`);
        await sftpController.downloadFile(ftpFilePath, localFilePath, fileName);
      }
      const data = await FileProcessor.readCsvFile(
        `${localFilePath}/${fileName}`
      );

      Logger.info("Primary sales data processing started");
      Logger.info(`Processing ${data.length} records`);
      Logger.info(`Processing file: ${fileName}`);
      Logger.info(`Processing file path: ${localFilePath}`);
      Logger.info(`Processing file size: ${data.length} bytes`);
      Logger.info(`Processing file type: ${path.extname(fileName)}`);

      const gcsUrl = await gcsController.uploadFile(localFilePath, fileName);
      logId = await dbService.logProcessStart(connection, gcsUrl, fileName);

      await connection.beginTransaction();

      await dbService.refreshData(connection, data, currentDate);

      Logger.info(`Running post import job!`);
      await dbService.postImportJob(connection);

      Logger.info(`Calling stored procedure: ${EnvConfig.reportSPName}`);

      emailMessage = `
        <html>
          <body>
            <p>Hello,</p>
            <p>The following files have been processed:</p>
            <ul>
              ${`
                <li>
                  <strong>File Name:</strong> ${fileName} <br/>
                </li>
                <li>
                  <strong>Rows:</strong> ${data.length} <br/>
                </li>
                <li>
                  <strong>Processing file size:</strong> ${data.length} bytes <br/>
                </li>
              `}
            </ul>
            <p>Best regards,<br/>Automation System</p>
          </body>
        </html>
      `;

      emailDataList.forEach((email) => {
        email.message = emailMessage;
        email.subject = `Primary Sales Processing Completed for ${fileName} at ${currentDate.toDateString()}`;
      });

      if (fileSource === "FTP") {
        // MOVING THE FILE FROM ROOT FOLDER TO ARCHIVE FOLDER
        Logger.info("Moving the file from root folder to archive folder");
        await ftpController.moveFile(
          `${ftpFilePath}/${fileName}`,
          `${ftpFilePath}/Archive/${fileName}`
        );
      } else {
        await sftpController.moveFile(
          `${ftpFilePath}/${fileName}`,
          `${ftpFilePath}/Archive/${fileName}`
        );
      }
      Logger.info("Primary sales processing completed");
      await connection.commit();
      await dbService.logProcessEnd(connection, logId, "SUCCESS");

      await MailController.sendMail(emailDataList);

      return res.status(HttpStatusCode.OK).send({
        success: true,
        message: `Primary sales processing completed. File stored at: ${gcsUrl}`,
      });
    } catch (error) {
      await connection.rollback();
      Logger.error("Primary sales processing failed", error);
      await dbService.logProcessEnd(connection, logId, "FAILED");

      emailInfo.emailIds.forEach((emailId) => {
        emailDataList.push({
          firstName: emailInfo.firstName,
          lastName: emailInfo.lastName,
          mailto: emailId,
          message: `Process failed for file name : ${fileName}. <br> ${error}`,
          subject: `[FAILED] Primary Sales Processing Completed for ${fileName} at ${currentDate.toDateString()}`,
        });
      });

      await MailController.sendMail(emailDataList);

      return res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).send({
        success: false,
        message: "Primary sales processing failed",
      });
    } finally {
      connection.release();
      sftpController.close();
      FileProcessor.deleteDownloadedFiles(tempDownloadFolderPath);
    }
  }

  static async reportGenerationAndEmail(req: Request, res: Response) {
    const dbService = new DatabaseService();
    const connection = await dbService.pool.getConnection();
    const reportEmailInfo = EnvConfig.reportEmaiLReceiverInfo;
    const localFilePath = path.join(__dirname, `../../downloads/`);
    const currentDate = new Date();
    const logId: number | null = await dbService.getLastInsertedLogId(
      connection
    );

    const reportFileLocation = await dbService.callStoredProcedureAndSaveCSV(
      connection,
      localFilePath,
      logId
    );

    const reportEmailMessage = `
        <html>
          <body>
            <p>Hello,</p>
            <p>Please find Red dealer analysis report as on ${currentDate.toDateString()}</p>
            <p>Click link to download ${reportFileLocation}</p>
            <p>Best regards,<br/>Automation System</p>
          </body>
        </html>
      `;

    const reportEmailDataList: SendEmailParams[] = [];
    reportEmailInfo.emailIds.forEach((emailId) => {
      reportEmailDataList.push({
        firstName: reportEmailInfo.firstName,
        lastName: reportEmailInfo.lastName,
        mailto: emailId,
        message: reportEmailMessage,
        subject: `Red dealer analysis report`,
      });
    });

    if (reportFileLocation) {
      await MailController.sendMail(reportEmailDataList);
    }

    Logger.info(
      `Report email sent successfully, report location: ${reportFileLocation}`
    );

    connection.release();
    FileProcessor.deleteDownloadedFiles(localFilePath);

    return res.status(HttpStatusCode.OK).send({
      success: true,
      message: "Report email sent successfully!",
      reportFileLocation,
    });
  }
}
