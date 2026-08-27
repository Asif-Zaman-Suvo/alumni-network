import ExcelJS from "exceljs";
import type { PersonalDataExport } from "@/app/actions/profile";

function addRecordSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  record: Record<string, unknown> | null,
) {
  const sheet = workbook.addWorksheet(name);
  const data = record ?? { note: "none" };
  const keys = Object.keys(data);
  sheet.columns = keys.map((key) => ({ header: key, key, width: 28 }));
  sheet.addRow(data);
}

export async function personalDataToXlsxBuffer(data: PersonalDataExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Alumni Network";
  workbook.created = new Date(data.exportedAt);

  addRecordSheet(workbook, "account", {
    exportedAt: data.exportedAt,
    ...data.account,
  });
  addRecordSheet(
    workbook,
    "profile",
    data.profile ? { ...data.profile } : null,
  );

  const requests = workbook.addWorksheet("verificationRequests");
  const requestKeys = [
    "sscRoll",
    "sscRegistration",
    "passingYear",
    "fullNameOnCert",
    "status",
    "reviewNote",
    "createdAt",
    "reviewedAt",
  ] as const;
  requests.columns = requestKeys.map((key) => ({ header: key, key, width: 24 }));
  if (data.verificationRequests.length === 0) {
    requests.addRow({ sscRoll: "none" });
  } else {
    for (const row of data.verificationRequests) {
      requests.addRow(row);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
