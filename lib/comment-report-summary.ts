import { db } from "@/lib/db";
import { CommentReportStatus } from "@/lib/prisma";

export type CommentReportSummary = {
  open: number;
  reviewed: number;
  dismissed: number;
  actioned: number;
  total: number;
};

export async function getCommentReportSummary(): Promise<CommentReportSummary> {
  const grouped = await db.commentReport.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  });

  const counts: CommentReportSummary = {
    open: 0,
    reviewed: 0,
    dismissed: 0,
    actioned: 0,
    total: 0,
  };

  for (const row of grouped) {
    const count = row._count._all;
    counts.total += count;

    if (row.status === CommentReportStatus.open) {
      counts.open = count;
    } else if (row.status === CommentReportStatus.reviewed) {
      counts.reviewed = count;
    } else if (row.status === CommentReportStatus.dismissed) {
      counts.dismissed = count;
    } else if (row.status === CommentReportStatus.actioned) {
      counts.actioned = count;
    }
  }

  return counts;
}
