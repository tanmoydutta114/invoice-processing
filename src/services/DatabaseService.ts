import mysql, { PoolConnection } from "mysql2/promise";
import { Logger } from "../utility/Logger";
import EnvConfig from "../utility/AppEnv";
import { SalesData } from "../types/types";
import _ from "lodash";
import fs from "fs";
import { GoogleStorageController } from "../controllers/GoogleStorageController";
import ObjectsToCsv from "objects-to-csv";

export class DatabaseService {
  public pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: EnvConfig.dbHost,
      user: EnvConfig.dbUser,
      password: EnvConfig.dbPassword,
      database: EnvConfig.dbDatabase,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async refreshData(connection: PoolConnection, data: SalesData[], date: Date) {
    const targetMonth = this.getTargetMonth(date);
    await this.deleteSalesData(connection, targetMonth);
    await this.insertSalesData(connection, data);
    Logger.info(`Database refreshed for ${targetMonth}`);
  }

  async insertSalesData(
    connection: PoolConnection,
    data: SalesData[],
    chunkSize: number = 1000
  ) {
    try {
      const chunks = _.chunk(data, chunkSize);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const columns = Object.keys(chunk[0]).join(", ");
        const values = chunk.map((row) => Object.values(row));
        const placeholders = chunk
          .map(
            (row) =>
              `(${Object.values(row)
                .map(() => "?")
                .join(", ")})`
          )
          .join(", ");
        const sql = `INSERT INTO panel_sales_data (${columns}) VALUES ${placeholders}`;

        try {
          await connection.query(sql, values.flat());
          Logger.info(
            `Inserted chunk ${i + 1}/${chunks.length} with ${
              chunk.length
            } records`
          );
        } catch (error) {
          Logger.error(`Error inserting chunk ${i + 1}: ${error.message}`);
          Logger.error(`Failed data: ${JSON.stringify(chunk, null, 2)}`);
          throw new Error("Failed to insert data");
        }
      }
    } catch (error) {
      Logger.error(`Transaction failed: ${error.message}`);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  async deleteSalesData(connection: PoolConnection, targetMonth: string) {
    try {
      let deleteQuery = "";
      let deleteParams: any[] = [];

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // getMonth() returns 0-11, so add 1

      if (targetMonth === "LAST_MONTH") {
        // Delete last month's data
        const lastMonth = month === 1 ? 12 : month - 1;
        const lastYear = month === 1 ? year - 1 : year;
        deleteQuery = `DELETE FROM panel_sales_data WHERE YEAR(inv_date) = ? AND MONTH(inv_date) = ?`;
        deleteParams = [lastYear, lastMonth];
      } else {
        deleteQuery = `DELETE FROM panel_sales_data 
               WHERE YEAR(inv_date) = ? 
               AND MONTH(inv_date) = ? 
               AND DAY(inv_date) <= ?`;
        deleteParams = [year, month, currentDate.getDate()];
      }

      await connection.execute(deleteQuery, deleteParams);
      console.log(deleteQuery, deleteParams);
      Logger.info(
        `Deleted sales data for ${targetMonth} (inv_date condition applied)`,
        { deleteQuery, deleteParams }
      );
    } catch (error) {
      Logger.error(`Failed to delete sales data for ${targetMonth}`, error);
      throw new Error("Deletion failed");
    }
  }

  private getTargetMonth(date: Date): string {
    const day = date.getDate();
    return day === 1 || day === 6 ? "LAST_MONTH" : "CURRENT_MONTH";
  }

  async logProcessStart(
    connection: PoolConnection,
    filepath: string,
    fileName: string
  ): Promise<number | null> {
    const [result]: any = await connection.execute(
      `INSERT INTO panel_sales_data_import_log 
         (filepath, filename, process_start_time, process_status, insertdatetime) 
         VALUES (?, ?, NOW(), ?, NOW())`,
      [filepath, fileName, "IN_PROGRESS"]
    );

    const insertId = result.insertId;
    Logger.info(`Log entry created with ID: ${insertId}`);
    return insertId;
  }

  async logProcessEnd(
    connection: PoolConnection,
    logId: number,
    status: "SUCCESS" | "FAILED"
  ) {
    await connection.execute(
      `UPDATE panel_sales_data_import_log 
         SET process_end_time = NOW(), process_status = ? 
         WHERE id = ?`,
      [status, logId]
    );
    Logger.info(`Log entry ${logId} updated with status: ${status}`);
  }

  async postImportJob(connection: PoolConnection) {
    await connection.execute(
      `
      UPDATE panel_sales_data psd
      INNER JOIN architectdb.sap_product_master spm ON
        psd.material=spm.material_code
      SET
        psd.pg1=spm.pg1,
        psd.pg2=spm.pg2,
        psd.pg3=spm.pg3,
        psd.pg4=spm.pg4
      WHERE ifnull(psd.pg1,'')=''
      `
    );
    Logger.info(`Post import job executed!`);
  }

  async   callStoredProcedureAndSaveCSV(
    connection: PoolConnection,
    localFilePath: string,
    logId: number | null
  ) {
    const gcpController = new GoogleStorageController();
    const dbService = new DatabaseService();
    const spConnection = await dbService.pool.getConnection();
    const [rows] = await spConnection.query(`CALL ${EnvConfig.reportSPName}`);

    if (!Array.isArray(rows) || rows.length === 0) {
      Logger.info("Stored procedure returned no data");
      return null;
    }

    const fileName = `red_analysis_${Date.now()}.csv`;

    const csvContent = await new ObjectsToCsv(rows[0] as any).toString();

    fs.writeFileSync(`${localFilePath}/${fileName}`, csvContent, "utf-8");

    Logger.info(`CSV file created: ${localFilePath}`);

    // Upload to Google Cloud Storage
    const reportLink = await gcpController.uploadFile(localFilePath, fileName);

    Logger.info(`Report uploaded to GCS: ${reportLink}`);

    // Update log table with report link

    if (logId) {
      await connection.execute(
        `UPDATE panel_sales_data_import_log SET report_link = ? WHERE id = ?`,
        [reportLink, logId]
      );
    } else {
      Logger.info(
        `No existing report found for today: ${new Date().toDateString()}`
      );
      await connection.execute(
        `INSERT INTO panel_sales_data_import_log (report_link)
        VALUES (?)`,
        [reportLink]
      );
    }

    Logger.info(`Updated log entry ${logId} with report link`);

    return reportLink;
  }

  async getLastInsertedLogId(
    connection: PoolConnection
  ): Promise<number> | null {
    let lastLogId: number | null = null;
    const [rows] = await connection.query(
      `SELECT id FROM panel_sales_data_import_log WHERE DATE(insertdatetime) = CURDATE() ORDER BY id DESC LIMIT 1`
    );
    if (Array.isArray(rows) && rows.length === 0) {
      Logger.info(`No log entry found for today: ${new Date().toDateString()}`);
      lastLogId = null;
      return lastLogId;
    }
    rows[0] as { id: number };
    lastLogId = rows[0].id;
    Logger.info(`Last log ID for today: ${lastLogId}`);
    return lastLogId;
  }
}
