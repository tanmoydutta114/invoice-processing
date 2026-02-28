import axios from 'axios';
import { Logger } from '../utility/Logger.js';
// import { SendEmailParams } from "../types/types.js";

export class MailController {
  static async sendMail(emailData: any[]) {
    for (const emailInfo of emailData) {
      const formData = new FormData();

      formData.append(`first_name`, emailInfo.firstName);
      formData.append(`last_name`, emailInfo.lastName);
      formData.append(`mailto`, emailInfo.mailto);
      formData.append(`subject`, emailInfo.subject);
      formData.append(`message`, emailInfo.message);
      formData.append(`send_smtp_mail`, '1'); // Mandatory field
      await axios.post('https://cmp.centuryply.com/leadflow/smtpapi/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Logger.info(`SMTP Mail sent successfully to: ${emailInfo.mailto}`);
    }
  }
}
