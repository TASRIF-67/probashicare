/*
 * These thresholds are for project demonstration and informational screening.
 * They are not clinical diagnosis rules and must be reviewed by qualified
 * professionals before any real healthcare use.
 */
export const WELLNESS_ALERT_RULES = {
  recentReportLimit: 14,
  repeatedCount: 2,
  bloodPressure: {
    highSystolic: 140,
    highDiastolic: 90,
    lowSystolic: 90,
    lowDiastolic: 60,
  },
  bloodSugarMgDl: {
    high: 180,
    low: 70,
  },
  weightChangePercent: 5,
};
