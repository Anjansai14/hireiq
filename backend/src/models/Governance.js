/**
 * Governance Rule & Compliance Model
 * Enforces institutional guidelines RR-H01 to RR-H07
 */
const db = require('../db');

class GovernanceModel {
  static async getRules() {
    return db.query('SELECT * FROM governance_rules ORDER BY rule_id');
  }

  static async getFlagsForCourse(courseId) {
    return db.query('SELECT * FROM governance_flags WHERE course_id = ?', [courseId]);
  }

  static async evaluateChecklist(course, campaign, sources = []) {
    const checks = [];

    // RR-H01 District relevance
    const districtIssues = sources.filter(s => s.catchment && (!s.markets || !s.markets[course.target_district] || s.markets[course.target_district] < 20));
    checks.push({
      rule: 'RR-H01',
      name: 'District Verification',
      status: districtIssues.length ? 'Warning' : 'Pass',
      detail: districtIssues.length ? `${districtIssues.length} sources lack required catchment threshold` : 'All shortlisted sources meet catchment criteria'
    });

    // RR-H04 Paid disclosure check
    const paidWithoutAd = sources.filter(s => s.rate > 0 && s.terms && !s.terms.includes('#ad'));
    checks.push({
      rule: 'RR-H04',
      name: 'Paid Ad Disclosure',
      status: paidWithoutAd.length ? 'Failed' : 'Pass',
      detail: paidWithoutAd.length ? 'Paid deliverables must specify #ad disclosure' : 'Mandatory disclosures verified'
    });

    // RR-H05 Cost ceiling
    const ceiling = course.cost_ceiling || 4500;
    const estCost = campaign.target_enrolments ? (campaign.budget / campaign.target_enrolments) : 0;
    checks.push({
      rule: 'RR-H05',
      name: 'Cost Per Enrolment Ceiling',
      status: estCost > ceiling ? 'Failed' : 'Pass',
      detail: `Projected cost ₹${Math.round(estCost)} vs ceiling ₹${ceiling}`
    });

    // RR-H06 Institutional consent
    const instSources = sources.filter(s => s.type === 'College network' || s.type === 'Placement cell');
    const missingConsent = instSources.filter(s => s.consent !== 'Recorded');
    checks.push({
      rule: 'RR-H06',
      name: 'Institutional Consent',
      status: missingConsent.length ? 'Failed' : 'Pass',
      detail: missingConsent.length ? `${missingConsent.length} institutional partners require signed consent` : 'All institutional consents on record'
    });

    return checks;
  }
}

module.exports = GovernanceModel;
