import { NextResponse } from "next/server";
import { reportService } from "@/services/report.service";

export async function GET() {
  return NextResponse.json({ reports: reportService.list() });
}
