import { getMasterCv } from "@/lib/cvStore";
import { sendApplicationEmail, verifySmtp } from "@/lib/email";
import { getOrCreateSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { settings } = await getOrCreateSettings();
    const user = await verifySmtp(settings);
    const cv = getMasterCv();
    await sendApplicationEmail({
      to: settings.applicantEmail || user,
      subject: "Job Match SMTP test",
      body: `Gmail SMTP is working.\n\nThis test was sent from Job Match using ${user}. Qualifying job applications will use this same Gmail account and attach your CV.\n\nWaqas Rafique`,
      settings,
      attachment: cv ? { filename: cv.fileName, path: cv.filePath } : undefined,
    });
    return NextResponse.json({ ok: true, sentTo: settings.applicantEmail || user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SMTP test failed" },
      { status: 400 },
    );
  }
}
