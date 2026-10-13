-- =====================================================================
--  Hire IQ — MySQL 8 schema
--  Module of Influence IQ: skilling & hiring cohort micro-campaigns.
--
--  Design rules
--  * Nothing hard-coded in the app: every dropdown / option / threshold
--    lives in lookup_values, channel_priors, governance_rules or
--    app_settings and is served by GET /api/lookups.
--  * Every metric carries a provenance stamp: Observed | Inferred | Predicted.
--  * Predictions are frozen at campaign creation (campaigns.pred_frozen)
--    and never overwritten; later plan versions are kept in plan_versions.
--  * Cohorts are aggregate only (RR-H01/H02): there is no table that
--    stores an individual learner. Enrolments arrive as counts per
--    tracking tag from Resolence.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS hireiq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hireiq;

-- ---------------------------------------------------------------------
-- 1. Configuration (DB-driven options, rules, thresholds)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS lookup_values;
CREATE TABLE lookup_values (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category    VARCHAR(48)  NOT NULL,   -- district, source_type, skill_domain, platform, objective, kpi ...
  code        VARCHAR(96)  NOT NULL,
  label       VARCHAR(160) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  meta        JSON         NULL,       -- e.g. {"institutional":true}, {"tone":"success"}
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_lookup (category, code),
  KEY ix_lookup_cat (category, sort_order)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS channel_priors;
CREATE TABLE channel_priors (           -- Agent A6 prior matrix
  objective      VARCHAR(64) NOT NULL,
  channel        VARCHAR(64) NOT NULL,
  prior          DECIMAL(5,2) NOT NULL,
  measurability  DECIMAL(3,2) NOT NULL,  -- 1.0 measured, 0.8 tracked link, 0.6 manual
  meas_label     VARCHAR(48) NOT NULL,
  role           VARCHAR(32) NOT NULL,   -- Anchor | Amplifier | Conversion | Community
  formats        VARCHAR(160) NOT NULL,
  iti_behaviour  DECIMAL(3,2) NOT NULL DEFAULT 1.0, -- multiplier when cohort is ITI/Diploma
  PRIMARY KEY (objective, channel)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS governance_rules;
CREATE TABLE governance_rules (
  code         VARCHAR(16) PRIMARY KEY,   -- RR-H01..RR-H07, RM-xx
  title        VARCHAR(160) NOT NULL,
  description  TEXT NOT NULL,
  enforcement  VARCHAR(32) NOT NULL,      -- Refuse | Block | Hold | Warn | Info
  owner_role   VARCHAR(48) NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS app_settings;
CREATE TABLE app_settings (
  setting_key   VARCHAR(80) PRIMARY KEY,
  setting_value JSON NOT NULL,
  description   VARCHAR(255) NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Users & access
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(40)  NOT NULL,     -- Admin | Manager | Fairness reviewer | Viewer
  title         VARCHAR(120) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Courses (the "film" equivalent) and their brief
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS courses;
CREATE TABLE courses (
  id            VARCHAR(40) PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  batch         VARCHAR(60)  NULL,
  language      VARCHAR(40)  NULL,
  batch_start   DATE NULL,
  provider      VARCHAR(160) NULL,
  target        INT NULL,
  ceiling       INT NULL,
  form          JSON NOT NULL,              -- raw brief form values (title, link, domain, level ...)
  form_src      JSON NULL,                  -- {field: "brochure.pdf"} = value came from a file, awaiting confirm
  context       TEXT NULL,                  -- "anything else the agents should know"
  created_by    VARCHAR(40) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

DROP TABLE IF EXISTS brief_fields;
CREATE TABLE brief_fields (                  -- readiness checklist (req / strong / opt)
  course_id   VARCHAR(40) NOT NULL,
  field_key   VARCHAR(40) NOT NULL,
  label       VARCHAR(120) NOT NULL,
  tier        ENUM('req','strong','opt') NOT NULL,
  value       TEXT NULL,
  source      VARCHAR(160) NULL,             -- Entered | Edited | brochure.pdf · p.2 | AI-inferred
  status      VARCHAR(32) NOT NULL DEFAULT 'Missing', -- Confirmed | Unconfirmed | Missing
  updated_at  DATE NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, field_key),
  CONSTRAINT fk_bf_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS course_claims;
CREATE TABLE course_claims (                 -- RR-H03 outcome claims awaiting evidence
  id           VARCHAR(40) PRIMARY KEY,
  course_id    VARCHAR(40) NOT NULL,
  text         VARCHAR(400) NOT NULL,
  source       VARCHAR(160) NULL,
  status       VARCHAR(40) NOT NULL DEFAULT 'Awaiting evidence', -- Awaiting evidence | Evidenced | Withdrawn
  evidence_file_id VARCHAR(40) NULL,
  CONSTRAINT fk_cl_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS governance_flags;
CREATE TABLE governance_flags (
  id          VARCHAR(40) PRIMARY KEY,
  course_id   VARCHAR(40) NOT NULL,
  type        VARCHAR(80) NOT NULL,          -- Outcome claims | Institution endorsement | Paid promotion
  status      VARCHAR(32) NOT NULL,          -- Cleared | Under review | Refused
  note        TEXT NULL,
  CONSTRAINT fk_gf_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS course_reads;
CREATE TABLE course_reads (                  -- Agent A2 background research
  id          VARCHAR(40) PRIMARY KEY,
  course_id   VARCHAR(40) NOT NULL,
  read_key    VARCHAR(40) NOT NULL,          -- public | audience | risk
  title       VARCHAR(160) NOT NULL,
  status      VARCHAR(32) NOT NULL,          -- Waiting | Running | Ready | Stale
  stale_note  VARCHAR(255) NULL,
  read_date   DATE NULL,
  items       JSON NOT NULL,                 -- [{t, stamp, src}]
  CONSTRAINT fk_cr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS watch_handles;
CREATE TABLE watch_handles (
  id         VARCHAR(40) PRIMARY KEY,
  course_id  VARCHAR(40) NOT NULL,
  handle     VARCHAR(160) NOT NULL,
  platform   VARCHAR(40) NOT NULL,
  kind       VARCHAR(60) NOT NULL,
  state      VARCHAR(32) NOT NULL,
  CONSTRAINT fk_wh_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Creator Bank (influence sources)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sources;
CREATE TABLE sources (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  handle        VARCHAR(200) NOT NULL,
  platform      VARCHAR(40) NOT NULL,
  type          VARCHAR(60) NOT NULL,        -- lookup source_type
  tier          VARCHAR(20) NOT NULL,        -- Nano | Micro | Mid | Macro | Mega
  followers     INT NOT NULL DEFAULT 0,
  median_views  INT NULL,
  er            DECIMAL(5,2) NULL,
  langs         JSON NOT NULL,               -- {"Telugu":82,"English":18}
  markets       JSON NOT NULL,               -- {"Hyderabad":34,"Warangal":18}
  content_types JSON NOT NULL,
  tone          VARCHAR(60) NULL,
  formats       JSON NOT NULL,
  topics        JSON NOT NULL,               -- {"AI/ML":0.86} skill-domain authority
  rate          INT NOT NULL DEFAULT 0,      -- fee per post (INR)
  rate_src      VARCHAR(32) NOT NULL DEFAULT 'Illustrative',
  verif         VARCHAR(32) NOT NULL DEFAULT 'Unknown',
  acct          VARCHAR(32) NULL,            -- Creator | Institution | Group | Business
  collab        VARCHAR(32) NULL,            -- Paid | Unpaid
  account_type  VARCHAR(32) NULL,            -- Individual | Institutional
  status        VARCHAR(32) NOT NULL DEFAULT 'Queued', -- Enriched | Partial | Failed | Queued
  status_note   VARCHAR(255) NULL,
  updated_on    DATE NULL,
  next_refresh  VARCHAR(20) NULL,
  last_post     DATE NULL,
  data_source   VARCHAR(32) NOT NULL DEFAULT 'Fetched', -- Fetched | Uploaded
  connected     TINYINT(1) NOT NULL DEFAULT 0,
  affiliation   VARCHAR(200) NULL,
  consent       VARCHAR(32) NOT NULL DEFAULT 'Not required', -- Recorded | Missing | Not required
  consent_date  DATE NULL,
  consent_basis VARCHAR(255) NULL,
  catchment     INT NULL,                    -- institutional reach (uploaded)
  district      VARCHAR(60) NULL,
  cohort        VARCHAR(160) NULL,
  skills        JSON NULL,
  attributed    INT NOT NULL DEFAULT 0,      -- enrolments attributed in past batches (Observed)
  growth        DECIMAL(5,2) NULL,
  contact       JSON NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_src_platform (platform),
  KEY ix_src_type (type)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS source_history;
CREATE TABLE source_history (                -- outcome of each past booking (reliability gate)
  id          INT AUTO_INCREMENT PRIMARY KEY,
  source_id   VARCHAR(40) NOT NULL,
  course      VARCHAR(160) NOT NULL,
  campaign    VARCHAR(160) NULL,
  date        DATE NOT NULL,
  status      VARCHAR(32) NOT NULL,          -- Delivered | Backed out | Declined
  fee         INT NULL,
  rating      DECIMAL(3,1) NULL,
  views       INT NULL,
  enrols      INT NULL,
  note        VARCHAR(255) NULL,
  CONSTRAINT fk_sh_src FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS source_recent_posts;
CREATE TABLE source_recent_posts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  source_id  VARCHAR(40) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  date       DATE NULL,
  views      INT NULL,
  clicks     INT NULL,
  format     VARCHAR(60) NULL,
  er         DECIMAL(5,2) NULL,
  CONSTRAINT fk_srp_src FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS source_snapshots;
CREATE TABLE source_snapshots (              -- monthly follower snapshots
  source_id  VARCHAR(40) NOT NULL,
  month      VARCHAR(10) NOT NULL,
  followers  INT NOT NULL,
  PRIMARY KEY (source_id, month),
  CONSTRAINT fk_ss_src FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS source_activity;
CREATE TABLE source_activity (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  source_id  VARCHAR(40) NOT NULL,
  date       DATE NOT NULL,
  text       VARCHAR(400) NOT NULL,
  CONSTRAINT fk_sa_src FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Campaigns (one cohort, one geography, one batch)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS campaigns;
CREATE TABLE campaigns (
  id            VARCHAR(40) PRIMARY KEY,
  course_id     VARCHAR(40) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  asset         VARCHAR(200) NULL,           -- short cohort label
  cohort        VARCHAR(255) NULL,
  qual          VARCHAR(80) NULL,
  skill_bg      JSON NULL,
  age_band      VARCHAR(40) NULL,
  exp_band      VARCHAR(60) NULL,
  objective     VARCHAR(60) NOT NULL,
  kpi           VARCHAR(60) NOT NULL,
  target        INT NULL,
  ceiling       INT NULL,
  markets       JSON NOT NULL,
  languages     JSON NOT NULL,
  start_date    DATE NULL,
  end_date      DATE NULL,
  budget        INT NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'Draft', -- Draft | Live | Closed
  version       INT NOT NULL DEFAULT 0,
  owner         VARCHAR(120) NULL,
  hashtags      JSON NULL,
  free_text     TEXT NULL,
  unattributed  INT NOT NULL DEFAULT 0,
  cohort_size   INT NULL,
  pred_frozen   JSON NULL,                   -- Agent A9 prediction frozen at create (v1)
  band_now      JSON NULL,
  diagnosis     JSON NULL,                   -- Agent A12 latest diagnosis
  summary       TEXT NULL,                   -- Agent A11 comment summary
  lessons       JSON NULL,
  wizard        JSON NULL,                   -- draft wizard state (step, answers, narrs, channels, shortlist, content)
  created_at    DATE NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY ix_camp_course (course_id, status),
  CONSTRAINT fk_camp_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS campaign_narratives;
CREATE TABLE campaign_narratives (
  id           VARCHAR(40) PRIMARY KEY,
  campaign_id  VARCHAR(40) NOT NULL,
  cls          VARCHAR(60) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  who          VARCHAR(255) NULL,
  why          TEXT NULL,
  risk         VARCHAR(255) NULL,
  tone         VARCHAR(80) NULL,
  hook         VARCHAR(255) NULL,
  score        INT NULL,
  role         VARCHAR(20) NULL,             -- Primary | Supporting
  held         TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cn_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS campaign_channels;
CREATE TABLE campaign_channels (
  campaign_id  VARCHAR(40) NOT NULL,
  name         VARCHAR(60) NOT NULL,
  role         VARCHAR(32) NOT NULL,
  share        INT NOT NULL,
  reason       VARCHAR(400) NULL,
  meas         VARCHAR(48) NULL,
  PRIMARY KEY (campaign_id, name),
  CONSTRAINT fk_cch_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS campaign_sources;
CREATE TABLE campaign_sources (              -- "cc": a source booked on a campaign
  id            VARCHAR(40) PRIMARY KEY,
  campaign_id   VARCHAR(40) NOT NULL,
  source_id     VARCHAR(40) NOT NULL,
  narrative_id  VARCHAR(40) NULL,
  channel       VARCHAR(40) NOT NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'Identified',
  deal_type     VARCHAR(40) NULL,            -- Paid | Barter | Partnership | Affiliate ...
  rate          INT NULL,
  posts         INT NULL,
  deliverables  VARCHAR(255) NULL,
  deal_start    DATE NULL,
  deal_end      DATE NULL,
  terms         VARCHAR(400) NULL,
  hashtag       VARCHAR(80) NULL,
  tracking_tag  VARCHAR(80) NULL,            -- hq-{campaign}-{source}
  pred_views    JSON NULL,
  pred_enrols   JSON NULL,
  late          TINYINT(1) NOT NULL DEFAULT 0,
  reason        VARCHAR(255) NULL,
  rating        DECIMAL(3,1) NULL,
  KEY ix_cc_camp (campaign_id),
  CONSTRAINT fk_cc_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_src  FOREIGN KEY (source_id)  REFERENCES sources(id)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS cc_log;
CREATE TABLE cc_log (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  cc_id  VARCHAR(40) NOT NULL,
  date   DATE NOT NULL,
  text   VARCHAR(400) NOT NULL,
  CONSTRAINT fk_ccl_cc FOREIGN KEY (cc_id) REFERENCES campaign_sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS content_items;
CREATE TABLE content_items (                 -- Agent A8 drafts, one per post in the deal
  id          VARCHAR(40) PRIMARY KEY,
  cc_id       VARCHAR(40) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  format      VARCHAR(60) NULL,
  lang        VARCHAR(40) NULL,
  hook        VARCHAR(400) NULL,
  beats       JSON NULL,
  caption     TEXT NULL,
  tags        JSON NULL,
  cta         VARCHAR(120) NULL,
  link        VARCHAR(255) NULL,
  disclosure  TINYINT(1) NOT NULL DEFAULT 0,
  status      VARCHAR(32) NOT NULL DEFAULT 'Draft', -- Draft | In review | Approved
  due         DATE NULL,
  checks      JSON NULL,                     -- {spoiler, claims, disclosure, link}
  CONSTRAINT fk_ci_cc FOREIGN KEY (cc_id) REFERENCES campaign_sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS posts;
CREATE TABLE posts (                         -- live posts + metrics (Observed)
  id           VARCHAR(40) PRIMARY KEY,
  cc_id        VARCHAR(40) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  format       VARCHAR(60) NULL,
  url          VARCHAR(400) NULL,
  posted_on    DATE NOT NULL,
  views        INT NULL,
  likes        INT NULL,
  comments     INT NULL,
  shares       INT NULL,
  saves        INT NULL,
  sent_pos     INT NULL,
  sent_neu     INT NULL,
  sent_neg     INT NULL,
  intent       INT NOT NULL DEFAULT 0,
  clicks       INT NOT NULL DEFAULT 0,
  regs         INT NOT NULL DEFAULT 0,
  enrols       INT NOT NULL DEFAULT 0,
  manual       TINYINT(1) NOT NULL DEFAULT 0,
  last_fetch   DATETIME NULL,
  fetch_status VARCHAR(20) NOT NULL DEFAULT 'OK',
  KEY ix_post_cc (cc_id),
  CONSTRAINT fk_post_cc FOREIGN KEY (cc_id) REFERENCES campaign_sources(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS enrolment_events;
CREATE TABLE enrolment_events (              -- Resolence counts per tracking tag (aggregate only)
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tracking_tag VARCHAR(80) NOT NULL,
  event_date   DATE NOT NULL,
  clicks       INT NOT NULL DEFAULT 0,
  regs         INT NOT NULL DEFAULT 0,
  enrols       INT NOT NULL DEFAULT 0,
  source_file  VARCHAR(160) NULL,
  received_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag_day (tracking_tag, event_date)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS comments;
CREATE TABLE comments (                      -- Agent A11 listening
  id           INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id  VARCHAR(40) NOT NULL,
  source_id    VARCHAR(40) NULL,
  text         TEXT NOT NULL,
  lang         VARCHAR(40) NULL,
  translation  TEXT NULL,
  sentiment    VARCHAR(16) NULL,
  theme        VARCHAR(60) NULL,
  intent       TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_cm_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS checkpoints;
CREATE TABLE checkpoints (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id  VARCHAR(40) NOT NULL,
  label        VARCHAR(40) NOT NULL,         -- 72 hours | Day 7 | Day 14 | Close
  date         DATE NOT NULL,
  verdict      VARCHAR(20) NULL,             -- Ahead | On track | Behind
  note         VARCHAR(255) NULL,
  CONSTRAINT fk_cp_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS campaign_alerts;
CREATE TABLE campaign_alerts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id  VARCHAR(40) NOT NULL,
  kind         VARCHAR(60) NOT NULL,
  rule_code    VARCHAR(16) NULL,
  text         TEXT NOT NULL,
  level        VARCHAR(16) NOT NULL DEFAULT 'warning',
  dismissed    TINYINT(1) NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ca_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS moves;
CREATE TABLE moves (                         -- Agent A12 recommended next moves
  id           VARCHAR(40) PRIMARY KEY,
  campaign_id  VARCHAR(40) NOT NULL,
  type         VARCHAR(60) NOT NULL,
  title        VARCHAR(400) NOT NULL,
  impact       VARCHAR(160) NULL,
  cost         INT NOT NULL DEFAULT 0,
  cost_label   VARCHAR(80) NULL,
  why          TEXT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'Open', -- Open | Accepted | Dismissed
  CONSTRAINT fk_mv_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS plan_versions;
CREATE TABLE plan_versions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id  VARCHAR(40) NOT NULL,
  v            INT NOT NULL,
  date         DATE NOT NULL,
  by_user      VARCHAR(120) NULL,
  note         VARCHAR(400) NULL,
  CONSTRAINT fk_pv_camp FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Files / artifacts, rate card, connectors, activity, copilot, audit
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS files;
CREATE TABLE files (
  id           VARCHAR(40) PRIMARY KEY,
  course_id    VARCHAR(40) NULL,
  name         VARCHAR(255) NOT NULL,
  size_label   VARCHAR(20) NULL,
  lane         VARCHAR(60) NOT NULL,         -- Brief material | Brand assets | Metrics exports | Exports
  date         DATE NOT NULL,
  by_user      VARCHAR(120) NULL,
  status       VARCHAR(32) NOT NULL,         -- Extracted | Generated | Imported | Stored
  prompt       TEXT NULL,
  storage_path VARCHAR(400) NULL,
  CONSTRAINT fk_file_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS rate_tiers;
CREATE TABLE rate_tiers (
  id        VARCHAR(20) PRIMARY KEY,
  tier      VARCHAR(40) NOT NULL,
  range_label VARCHAR(80) NOT NULL,
  lo        INT NOT NULL,
  hi        INT NOT NULL,
  prov      VARCHAR(20) NOT NULL,            -- Observed | Illustrative
  bookings  INT NOT NULL DEFAULT 0,
  courses   INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

DROP TABLE IF EXISTS rate_observations;
CREATE TABLE rate_observations (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  date      DATE NOT NULL,
  source_id VARCHAR(40) NOT NULL,
  course    VARCHAR(200) NOT NULL,
  rate      INT NOT NULL,
  posts     INT NOT NULL,
  tier      VARCHAR(40) NOT NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS connectors;
CREATE TABLE connectors (
  id        VARCHAR(20) PRIMARY KEY,
  name      VARCHAR(120) NOT NULL,
  kind      VARCHAR(40) NOT NULL,
  status    VARCHAR(32) NOT NULL,            -- Connected | Expiring | Upload only | Unsupported | Disconnected
  detail    VARCHAR(400) NULL,
  last_sync DATETIME NULL,
  quota     INT NULL,
  secret_enc TEXT NULL                       -- encrypted token (AES-256-GCM, see backend/src/utils/crypto.js)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS activity_log;
CREATE TABLE activity_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  course_id  VARCHAR(40) NULL,
  campaign_id VARCHAR(40) NULL,
  ts         DATETIME NOT NULL,
  kind       VARCHAR(20) NOT NULL,           -- fetch | alert | post | deal | agent
  text       VARCHAR(500) NOT NULL,
  KEY ix_act_course (course_id, ts)
) ENGINE=InnoDB;

DROP TABLE IF EXISTS copilot_threads;
CREATE TABLE copilot_threads (
  id         VARCHAR(40) PRIMARY KEY,
  course_id  VARCHAR(40) NULL,
  user_id    VARCHAR(40) NULL,
  title      VARCHAR(255) NOT NULL,
  scope      VARCHAR(200) NOT NULL,
  scope_type VARCHAR(20) NOT NULL DEFAULT 'course', -- course | campaign
  scope_id   VARCHAR(40) NULL,
  date       DATE NOT NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS copilot_messages;
CREATE TABLE copilot_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  thread_id  VARCHAR(40) NOT NULL,
  role       VARCHAR(10) NOT NULL,           -- user | ai
  text       TEXT NOT NULL,
  sources    JSON NULL,
  proposal   JSON NULL,                      -- {title, detail, action, status}
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_thread FOREIGN KEY (thread_id) REFERENCES copilot_threads(id) ON DELETE CASCADE
) ENGINE=InnoDB;

DROP TABLE IF EXISTS fairness_escalations;
CREATE TABLE fairness_escalations (          -- RR-H01 / RR-H02 refusals are logged and routed
  id          INT AUTO_INCREMENT PRIMARY KEY,
  rule_code   VARCHAR(16) NOT NULL,
  user_id     VARCHAR(40) NULL,
  context     VARCHAR(80) NOT NULL,          -- copilot | brief.eligibility | wizard.cohort
  request     TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'Open',
  reviewer    VARCHAR(120) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

DROP TABLE IF EXISTS agent_runs;
CREATE TABLE agent_runs (                    -- observability for every agent call
  id           INT AUTO_INCREMENT PRIMARY KEY,
  agent        VARCHAR(8) NOT NULL,          -- A1..A12, COP
  entity_type  VARCHAR(20) NULL,
  entity_id    VARCHAR(40) NULL,
  status       VARCHAR(16) NOT NULL,         -- ok | error
  duration_ms  INT NULL,
  llm_used     TINYINT(1) NOT NULL DEFAULT 0,
  output       JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_ar_entity (entity_type, entity_id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
