const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.resolve(__dirname, '../../data');
const RUNTIME_FILE = path.join(DATA_DIR, 'runtime_db.json');
const ROOT_SEED = path.resolve(__dirname, '../../../database/seed');

const JSON_COLS = new Set([
  'meta', 'setting_value', 'form', 'form_src', 'items', 'langs', 'markets', 'content_types', 'formats', 'topics',
  'skills', 'contact', 'skill_bg', 'languages', 'hashtags', 'pred_frozen', 'band_now', 'diagnosis', 'lessons',
  'wizard', 'pred_views', 'pred_enrols', 'beats', 'tags', 'checks', 'sources', 'proposal', 'output', 'answers',
  'cohort', 'questions', 'proposals', 'district_changes', 'outside', 'size'
]);

function deepClone(obj) {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

class RelationalStore {
  constructor() {
    this.tables = {};
    this.saveTimer = null;
    this.init();
  }

  init() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(RUNTIME_FILE)) {
      try {
        const raw = fs.readFileSync(RUNTIME_FILE, 'utf8');
        this.tables = JSON.parse(raw);
        return;
      } catch (e) {
        console.warn('Failed to load runtime_db.json, re-seeding:', e.message);
      }
    }
    this.seed();
  }

  seed() {
    this.tables = {
      lookup_values: [],
      channel_priors: [],
      governance_rules: [],
      app_settings: [],
      users: [],
      courses: [],
      brief_fields: [],
      course_claims: [],
      governance_flags: [],
      course_reads: [],
      watch_handles: [],
      activity_log: [],
      sources: [],
      source_history: [],
      source_recent_posts: [],
      source_snapshots: [],
      source_activity: [],
      campaigns: [],
      campaign_narratives: [],
      campaign_channels: [],
      campaign_sources: [],
      cc_log: [],
      content_items: [],
      posts: [],
      comments: [],
      checkpoints: [],
      campaign_alerts: [],
      moves: [],
      plan_versions: [],
      files: [],
      rate_tiers: [],
      rate_observations: [],
      connectors: [],
      copilot_threads: [],
      copilot_messages: [],
      agent_runs: [],
      fairness_escalations: []
    };

    const cfgPath = path.join(ROOT_SEED, 'config_seed.json');
    const protoPath = path.join(ROOT_SEED, 'prototype_seed.json');
    if (!fs.existsSync(cfgPath) || !fs.existsSync(protoPath)) {
      return;
    }

    const CFG = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const P = JSON.parse(fs.readFileSync(protoPath, 'utf8'));

    let n = 0;
    const genId = (p) => `${p}${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const D = (s) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
    const DT = (s) => (s ? s.replace('T', ' ').slice(0, 16) + ':00' : null);

    // Lookups
    for (const [cat, items] of Object.entries(CFG.lookups || {})) {
      let i = 0;
      for (const it of items) {
        const o = typeof it === 'string' ? { code: it } : it;
        this.tables.lookup_values.push({
          id: this.tables.lookup_values.length + 1,
          category: cat,
          code: o.code,
          label: o.label || o.code,
          sort_order: i++,
          meta: o.meta || null,
          active: 1
        });
      }
    }

    // Channel priors
    if (CFG.channel_priors) {
      for (const [obj, row] of Object.entries(CFG.channel_priors.priors || {})) {
        for (const [ch, prior] of Object.entries(row)) {
          const m = CFG.channel_priors.channels[ch] || {};
          this.tables.channel_priors.push({
            objective: obj,
            channel: ch,
            prior: Number(prior),
            measurability: m.meas != null ? Number(m.meas) : 1,
            meas_label: m.meas_label || '',
            role: m.role || '',
            formats: m.formats || '',
            iti_behaviour: m.iti != null ? Number(m.iti) : 1.0
          });
        }
      }
    }

    // Governance rules
    for (const r of CFG.governance_rules || []) {
      this.tables.governance_rules.push({ ...r });
    }

    // Settings
    for (const [k, v] of Object.entries(CFG.settings || {})) {
      this.tables.app_settings.push({
        setting_key: k,
        setting_value: v.value !== undefined ? v.value : v,
        description: v.description || ''
      });
    }

    // Users
    const hash = bcrypt.hashSync('Hireiq@123', 10);
    let ui = 0;
    for (const t of P.team || []) {
      this.tables.users.push({
        id: `u${++ui}`,
        name: t.name,
        email: (t.email || '').toLowerCase().trim(),
        password_hash: hash,
        role: t.role,
        title: t.title
      });
    }

    // Courses
    for (const f of P.courses || []) {
      const { src, ...form } = f.form || {};
      this.tables.courses.push({
        id: f.id,
        title: f.title,
        batch: f.batch,
        language: f.language,
        batch_start: D(f.release),
        provider: f.studio,
        target: f.target || null,
        ceiling: f.ceiling || null,
        context: f.context || '',
        form,
        form_src: src || {},
        created_by: 'u1'
      });
      let so = 0;
      for (const b of f.brief || []) {
        this.tables.brief_fields.push({
          id: this.tables.brief_fields.length + 1,
          course_id: f.id,
          field_key: b.key,
          label: b.label,
          tier: b.tier,
          value: b.value || null,
          source: b.source || null,
          status: b.status || 'Missing',
          updated_at: D(b.date),
          sort_order: so++
        });
      }
      for (const c of f.claims || []) {
        this.tables.course_claims.push({
          id: genId('cl'),
          course_id: f.id,
          text: c.text,
          source: c.src,
          status: c.status,
          evidence_file_id: null
        });
      }
      for (const g of f.flags || []) {
        this.tables.governance_flags.push({
          id: genId('gf'),
          course_id: f.id,
          type: g.type,
          status: g.status,
          note: g.note
        });
      }
      for (const r of f.reads || []) {
        this.tables.course_reads.push({
          id: genId('rd'),
          course_id: f.id,
          read_key: r.key,
          title: r.title,
          status: r.status,
          stale_note: r.staleNote || null,
          read_date: D(r.date),
          items: r.items || []
        });
      }
      for (const w of f.watch || []) {
        this.tables.watch_handles.push({
          id: w.id + f.id,
          course_id: f.id,
          handle: w.handle,
          platform: w.platform,
          kind: w.kind,
          state: w.state
        });
      }
      for (const a of f.activity || []) {
        this.tables.activity_log.push({
          id: this.tables.activity_log.length + 1,
          course_id: f.id,
          ts: DT(a.t),
          kind: a.kind,
          text: a.text
        });
      }
    }

    // Sources (Creator Bank)
    for (const c of P.creators || []) {
      this.tables.sources.push({
        id: c.id,
        name: c.name,
        handle: c.handle,
        platform: c.platform,
        type: c.type,
        tier: c.tier,
        followers: c.followers,
        median_views: c.mv,
        er: c.er,
        langs: c.langs || {},
        markets: c.markets || {},
        content_types: c.content || [],
        tone: c.tone,
        formats: c.formats || [],
        topics: c.topics || {},
        rate: c.rate,
        rate_src: c.rateSrc,
        verif: c.verif,
        acct: c.acct,
        status: c.status,
        status_note: c.partialNote || c.failNote || null,
        updated_on: D(c.updated),
        next_refresh: c.next,
        last_post: D(c.lastPost),
        data_source: c.source,
        connected: c.connected ? 1 : 0,
        affiliation: c.affiliation || null,
        consent: c.consent,
        consent_date: D(c.consentDate),
        consent_basis: c.consentBasis || null,
        catchment: c.catchment,
        district: c.district,
        cohort: c.cohort || null,
        skills: c.skills || [],
        attributed: c.attributed || 0,
        growth: c.growth,
        contact: c.contact || {}
      });
      for (const h of c.history || []) {
        this.tables.source_history.push({
          id: this.tables.source_history.length + 1,
          source_id: c.id,
          course: h.film,
          campaign: h.campaign,
          date: h.date,
          status: h.status,
          fee: h.fee ?? null,
          rating: h.rating ?? null,
          views: h.views ?? null,
          enrols: h.enrols ?? null,
          note: h.note || null
        });
      }
      for (const r of c.recent || []) {
        this.tables.source_recent_posts.push({
          id: this.tables.source_recent_posts.length + 1,
          source_id: c.id,
          title: r.title,
          date: D(r.date),
          views: r.views,
          clicks: r.clicks,
          format: r.format,
          er: r.er
        });
      }
      for (const s of c.snapshots || []) {
        this.tables.source_snapshots.push({
          id: this.tables.source_snapshots.length + 1,
          source_id: c.id,
          month: s.m,
          followers: s.f
        });
      }
      for (const a of c.activity || []) {
        this.tables.source_activity.push({
          id: this.tables.source_activity.length + 1,
          source_id: c.id,
          date: D(a.date) || '2026-07-04',
          text: a.text
        });
      }
    }

    // Campaigns
    for (const k of P.campaigns || []) {
      const band = (k.band || '').split(' · ');
      const skill = Array.isArray(k.skillBg) ? k.skillBg : (k.skillBg || '').split(',').map((s) => s.trim()).filter(Boolean);
      this.tables.campaigns.push({
        id: k.id,
        course_id: k.filmId,
        name: k.name,
        asset: k.asset,
        cohort: k.cohort || null,
        qual: k.qual,
        skill_bg: skill,
        age_band: k.ageBand || band[0] || null,
        exp_band: k.expBand || band[1] || null,
        objective: k.objective,
        kpi: k.kpi,
        target: k.target,
        ceiling: k.ceiling,
        markets: k.markets || [],
        languages: k.languages || [],
        start_date: D(k.start),
        end_date: D(k.end),
        budget: k.budget,
        status: k.status,
        version: k.version,
        owner: k.owner,
        hashtags: k.hashtags || [],
        free_text: k.freeText || null,
        unattributed: k.unattributed || 0,
        cohort_size: k.status === 'Draft' ? null : 3200,
        pred_frozen: k.pred || null,
        band_now: k.bandNow || null,
        diagnosis: k.diagnosis || null,
        lessons: k.lessons || null,
        wizard: k.wiz || null,
        created_at: D(k.created)
      });
      for (const nr of k.narratives || []) {
        this.tables.campaign_narratives.push({
          id: nr.id,
          campaign_id: k.id,
          cls: nr.cls,
          title: nr.title,
          who: nr.who,
          why: nr.why,
          risk: nr.risk,
          tone: nr.tone,
          hook: nr.hook,
          score: nr.score,
          role: nr.role,
          held: (nr.risk || '').startsWith('High') ? 1 : 0
        });
      }
      for (const ch of k.channels || []) {
        this.tables.campaign_channels.push({
          id: this.tables.campaign_channels.length + 1,
          campaign_id: k.id,
          name: ch.name,
          role: ch.role,
          share: Number(ch.share),
          reason: ch.reason,
          meas: Number(ch.meas)
        });
      }
      for (const x of k.ccs || []) {
        const d = x.deal || {};
        this.tables.campaign_sources.push({
          id: x.id,
          campaign_id: k.id,
          source_id: x.creatorId,
          narrative_id: x.narrative,
          channel: x.channel,
          status: x.status,
          deal_type: d.type || null,
          rate: d.rate ?? null,
          posts: d.posts ?? null,
          deliverables: d.del || null,
          deal_start: D(d.start),
          deal_end: D(d.end),
          terms: d.terms || null,
          hashtag: (k.hashtags || [])[0] || null,
          tracking_tag: `hq-${k.id}-${x.creatorId}`,
          pred_views: x.predViews || null,
          pred_enrols: x.predEnrols || null,
          late: x.late ? 1 : 0,
          reason: x.reason || null,
          rating: x.rating || null
        });
        for (const l of x.log || []) {
          this.tables.cc_log.push({
            id: this.tables.cc_log.length + 1,
            cc_id: x.id,
            date: D(l.date),
            text: l.text
          });
        }
        for (const ci of x.content || []) {
          this.tables.content_items.push({
            id: ci.id,
            cc_id: x.id,
            title: ci.title,
            format: ci.format,
            lang: ci.lang,
            hook: ci.hook,
            beats: ci.beats || [],
            caption: ci.caption,
            tags: ci.tags || [],
            cta: ci.cta,
            link: ci.link,
            disclosure: ci.disclosure ? 1 : 0,
            status: ci.status,
            due: D(ci.due),
            checks: ci.checks || []
          });
        }
        for (const p of x.posts || []) {
          this.tables.posts.push({
            id: p.id,
            cc_id: x.id,
            title: p.title,
            format: p.format,
            url: p.url,
            posted_on: D(p.date),
            views: p.views || 0,
            likes: p.likes || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            saves: p.saves || 0,
            sent_pos: p.sent ? p.sent[0] : null,
            sent_neu: p.sent ? p.sent[1] : null,
            sent_neg: p.sent ? p.sent[2] : null,
            intent: p.intent || 0,
            clicks: p.clicks || 0,
            regs: p.regs || 0,
            enrols: p.enrols || 0,
            manual: p.manual ? 1 : 0,
            last_fetch: DT(p.lastFetch),
            fetch_status: p.fetch || 'OK'
          });
        }
      }
      for (const cm of k.comments || []) {
        this.tables.comments.push({
          id: this.tables.comments.length + 1,
          campaign_id: k.id,
          source_id: cm.cr,
          text: cm.text,
          lang: cm.lang,
          translation: cm.tr || null,
          sentiment: cm.sent,
          theme: cm.theme,
          intent: cm.intent ? 1 : 0
        });
      }
      for (const cp of k.checkpoints || []) {
        this.tables.checkpoints.push({
          id: this.tables.checkpoints.length + 1,
          campaign_id: k.id,
          label: cp.label,
          date: cp.date,
          verdict: cp.verdict,
          note: cp.note || null
        });
      }
      for (const a of k.alerts || []) {
        this.tables.campaign_alerts.push({
          id: this.tables.campaign_alerts.length + 1,
          campaign_id: k.id,
          kind: a.kind,
          rule_code: a.rule,
          text: a.text,
          level: a.level,
          dismissed: 0
        });
      }
      for (const m of k.moves || []) {
        this.tables.moves.push({
          id: m.id,
          campaign_id: k.id,
          type: m.type,
          title: m.title,
          impact: m.impact,
          cost: m.cost,
          cost_label: m.costLabel,
          why: m.why,
          status: m.status
        });
      }
      for (const v of k.versions || []) {
        this.tables.plan_versions.push({
          id: this.tables.plan_versions.length + 1,
          campaign_id: k.id,
          v: v.v,
          date: v.date,
          by_user: v.by,
          note: v.note
        });
      }
    }

    // Files, rate tiers, observations, connectors, threads
    for (const f of P.files || []) {
      this.tables.files.push({
        id: f.id,
        course_id: f.filmId,
        name: f.name,
        size_label: f.size,
        lane: f.lane,
        date: f.date,
        by_user: f.by,
        status: f.status,
        prompt: f.prompt || null,
        storage_path: null
      });
    }
    let ti = 0;
    for (const t of P.rateTiers || []) {
      this.tables.rate_tiers.push({
        id: t.id,
        tier: t.tier,
        range_label: t.range,
        lo: t.lo,
        hi: t.hi,
        prov: t.prov,
        bookings: t.bookings,
        courses: t.films,
        sort_order: ti++
      });
    }
    for (const r of P.rateObs || []) {
      this.tables.rate_observations.push({
        id: this.tables.rate_observations.length + 1,
        date: r.date,
        source_id: r.creator,
        course: r.film,
        rate: r.rate,
        posts: r.posts,
        tier: r.tier
      });
    }
    for (const c of P.connectors || []) {
      this.tables.connectors.push({
        id: c.id,
        name: c.name,
        kind: c.kind,
        status: c.status,
        detail: c.detail,
        last_sync: DT(c.last),
        quota: c.quota ?? null,
        secret_enc: null
      });
    }
    for (const t of P.threads || []) {
      const camp = (P.campaigns || []).find((k) => k.name === t.scope);
      this.tables.copilot_threads.push({
        id: t.id,
        course_id: 'f1',
        user_id: 'u1',
        title: t.title,
        scope: t.scope,
        scope_type: camp ? 'campaign' : 'course',
        scope_id: camp ? camp.id : 'f1',
        date: t.date
      });
      for (const m of t.messages || []) {
        this.tables.copilot_messages.push({
          id: this.tables.copilot_messages.length + 1,
          thread_id: t.id,
          role: m.role,
          text: m.text,
          sources: m.sources || null,
          proposal: null
        });
      }
    }

    this.saveImmediate();
  }

  save() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveImmediate(), 500);
  }

  saveImmediate() {
    try {
      fs.writeFileSync(RUNTIME_FILE, JSON.stringify(this.tables, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write runtime_db.json:', e);
    }
  }

  getTable(name) {
    const n = name.trim().replace(/`/g, '');
    if (!this.tables[n]) {
      this.tables[n] = [];
    }
    return this.tables[n];
  }

  /**
   * Primary SQL execution engine.
   */
  async execute(sql, params = []) {
    let cleanSql = sql.trim().replace(/;$/, '');

    // Substitute placeholders
    let paramIndex = 0;
    // Keep raw params for exact matching
    const p = params ? [...params] : [];

    // Detect operation
    const upper = cleanSql.toUpperCase();

    if (upper.startsWith('SELECT 1')) {
      return [{ '1': 1 }];
    }

    if (upper.startsWith('INSERT INTO')) {
      return this.handleInsert(cleanSql, p);
    }

    if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(cleanSql, p);
    }

    if (upper.startsWith('DELETE FROM')) {
      return this.handleDelete(cleanSql, p);
    }

    if (upper.startsWith('SELECT')) {
      return this.handleSelect(cleanSql, p);
    }

    return [];
  }

  handleInsert(sql, params) {
    // INSERT INTO table (col1, col2) VALUES (?, ?)
    const m = sql.match(/INSERT\s+INTO\s+([`\w]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (!m) return { affectedRows: 0 };
    const table = m[1].replace(/`/g, '');
    const cols = m[2].split(',').map((c) => c.trim().replace(/`/g, ''));
    const rows = this.getTable(table);

    const newRow = {};
    cols.forEach((col, idx) => {
      let val = params[idx];
      if (typeof val === 'string' && JSON_COLS.has(col)) {
        try { val = JSON.parse(val); } catch {}
      }
      newRow[col] = val !== undefined ? val : null;
    });

    // Handle source_snapshots unique key (source_id, month)
    if (table === 'source_snapshots' && newRow.source_id && newRow.month) {
      const existingIdx = rows.findIndex(r => r.source_id === newRow.source_id && r.month === newRow.month);
      if (existingIdx >= 0) {
        rows[existingIdx] = { ...rows[existingIdx], ...newRow };
        this.save();
        return { affectedRows: 1, insertId: rows[existingIdx].id || 1 };
      }
    }

    if (!newRow.id) {
      // auto-increment or id assignment
      const maxId = rows.reduce((max, r) => (typeof r.id === 'number' && r.id > max ? r.id : max), 0);
      if (maxId > 0 || rows.length === 0) {
        newRow.id = maxId + 1;
      }
    }

    rows.push(newRow);
    this.save();
    return { affectedRows: 1, insertId: newRow.id };
  }

  handleUpdate(sql, params) {
    // UPDATE table SET col1 = ?, col2 = ? WHERE ...
    const m = sql.match(/UPDATE\s+([`\w]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
    if (!m) return { affectedRows: 0 };
    const table = m[1].replace(/`/g, '');
    const setClause = m[2];
    const whereClause = m[3] || '';

    const rows = this.getTable(table);

    // Count SET placeholders
    const setPieces = setClause.split(',').map(s => s.trim());
    const setCols = [];
    let setParamCount = 0;
    for (const piece of setPieces) {
      const parts = piece.split('=').map(p => p.trim());
      const col = parts[0].replace(/`/g, '');
      setCols.push(col);
      if (parts[1] && parts[1].includes('?')) {
        setParamCount++;
      }
    }

    const setParams = params.slice(0, setParamCount);
    const whereParams = params.slice(setParamCount);

    let updated = 0;
    const filterFn = this.buildWhereFilter(whereClause, whereParams);

    for (let i = 0; i < rows.length; i++) {
      if (filterFn(rows[i])) {
        setCols.forEach((col, idx) => {
          let val = setParams[idx];
          if (typeof val === 'string' && JSON_COLS.has(col)) {
            try { val = JSON.parse(val); } catch {}
          }
          rows[i][col] = val !== undefined ? val : rows[i][col];
        });
        updated++;
      }
    }

    if (updated > 0) this.save();
    return { affectedRows: updated };
  }

  handleDelete(sql, params) {
    // DELETE FROM table WHERE ...
    const m = sql.match(/DELETE\s+FROM\s+([`\w]+)(?:\s+WHERE\s+(.+))?$/i);
    if (!m) return { affectedRows: 0 };
    const table = m[1].replace(/`/g, '');
    const whereClause = m[2] || '';
    const rows = this.getTable(table);

    const filterFn = this.buildWhereFilter(whereClause, params);
    const initLen = rows.length;
    this.tables[table] = rows.filter(r => !filterFn(r));
    const deleted = initLen - this.tables[table].length;
    if (deleted > 0) this.save();
    return { affectedRows: deleted };
  }

  handleSelect(sql, params) {
    // Parse SELECT
    // Check if JOIN is present
    const isJoin = /\bJOIN\b/i.test(sql);
    if (isJoin) {
      return this.handleSelectJoin(sql, params);
    }

    // Single table SELECT
    const m = sql.match(/SELECT\s+(.+?)\s+FROM\s+([`\w]+)(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?)?$/i);
    if (!m) {
      // Simple fallback
      return [];
    }

    const selectFields = m[1].trim();
    const table = m[2].trim().replace(/`/g, '');
    const whereClause = m[3] ? m[3].trim() : '';
    const groupBy = m[4] ? m[4].trim() : '';
    const orderBy = m[5] ? m[5].trim() : '';
    const limit = m[6] ? parseInt(m[6], 10) : null;
    const offset = m[7] ? parseInt(m[7], 10) : 0;

    let rows = deepClone(this.getTable(table));

    // WHERE
    if (whereClause) {
      const filterFn = this.buildWhereFilter(whereClause, params);
      rows = rows.filter(filterFn);
    }

    // Aggregates without group by
    if (!groupBy) {
      if (selectFields.toUpperCase() === 'COUNT(*) N' || selectFields.toUpperCase() === 'COUNT(*) AS N') {
        return [{ n: rows.length }];
      }
      if (selectFields.toUpperCase() === 'COUNT(*) COUNT' || selectFields.toUpperCase() === 'COUNT(*)') {
        return [{ count: rows.length, 'COUNT(*)': rows.length }];
      }
      const sumMatch = selectFields.match(/SUM\(([`\w]+)\)(?:\s+AS)?\s*([`\w]+)/i);
      if (sumMatch) {
        const col = sumMatch[1].replace(/`/g, '');
        const alias = sumMatch[2].replace(/`/g, '');
        const total = rows.reduce((s, r) => s + (Number(r[col]) || 0), 0);
        return [{ [alias]: total }];
      }
    } else {
      // GROUP BY
      const grpCol = groupBy.split(',')[0].trim().replace(/`/g, '');
      const groups = {};
      for (const r of rows) {
        const key = r[grpCol] || '__null__';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      }
      const aggRows = [];
      for (const [k, grp] of Object.entries(groups)) {
        const first = grp[0];
        const resObj = { [grpCol]: first[grpCol] };
        if (/COUNT\(\*\)\s+([`\w]+)/i.test(selectFields)) {
          const alias = selectFields.match(/COUNT\(\*\)\s+([`\w]+)/i)[1].replace(/`/g, '');
          resObj[alias] = grp.length;
        }
        if (/SUM\(([`\w]+)\)\s+([`\w]+)/i.test(selectFields)) {
          const sm = selectFields.match(/SUM\(([`\w]+)\)\s+([`\w]+)/i);
          resObj[sm[2].replace(/`/g, '')] = grp.reduce((acc, row) => acc + (Number(row[sm[1].replace(/`/g, '')]) || 0), 0);
        }
        aggRows.push(resObj);
      }
      rows = aggRows;
    }

    // ORDER BY
    if (orderBy) {
      rows = this.applyOrderBy(rows, orderBy);
    }

    // OFFSET / LIMIT
    if (offset) {
      rows = rows.slice(offset);
    }
    if (limit !== null) {
      rows = rows.slice(0, limit);
    }

    // Select projection
    if (selectFields !== '*') {
      const cols = selectFields.split(',').map(c => {
        const parts = c.trim().split(/\s+AS\s+|\s+/i);
        return {
          col: parts[0].replace(/`/g, '').trim(),
          alias: (parts[1] || parts[0]).replace(/`/g, '').trim()
        };
      });
      rows = rows.map(r => {
        const projected = {};
        for (const c of cols) {
          projected[c.alias] = r[c.col] !== undefined ? r[c.col] : null;
        }
        return projected;
      });
    }

    return rows;
  }

  handleSelectJoin(sql, params) {
    // Specialized JOIN handler for the repo queries
    // 1. SELECT cs.*, s.name, s.handle, s.platform, s.type, s.tier, s.followers, s.markets, s.consent, s.langs
    //    FROM campaign_sources cs JOIN sources s ON s.id = cs.source_id WHERE cs.campaign_id = ?
    if (/campaign_sources\s+cs\s+JOIN\s+sources\s+s\s+ON\s+s\.id\s*=\s*cs\.source_id/i.test(sql)) {
      const campId = params[0];
      const csRows = this.getTable('campaign_sources').filter(cs => cs.campaign_id === campId);
      const sourcesMap = new Map(this.getTable('sources').map(s => [s.id, s]));
      return csRows.map(cs => {
        const s = sourcesMap.get(cs.source_id) || {};
        return {
          ...cs,
          name: s.name,
          handle: s.handle,
          platform: s.platform,
          type: s.type,
          tier: s.tier,
          followers: s.followers,
          markets: s.markets,
          consent: s.consent,
          langs: s.langs
        };
      });
    }

    // 2. SELECT cs.*, s.type, s.consent, s.name FROM campaign_sources cs JOIN sources s ON s.id = cs.source_id WHERE cs.id = ? AND cs.campaign_id = ?
    if (/campaign_sources\s+cs\s+JOIN\s+sources\s+s\s+ON\s+s\.id\s*=\s*cs\.source_id\s+WHERE\s+cs\.id\s*=\s*\?\s+AND\s+cs\.campaign_id\s*=\s*\?/i.test(sql)) {
      const [ccId, campId] = params;
      const cs = this.getTable('campaign_sources').find(r => r.id === ccId && r.campaign_id === campId);
      if (!cs) return [];
      const s = this.getTable('sources').find(r => r.id === cs.source_id) || {};
      return [{ ...cs, type: s.type, consent: s.consent, name: s.name }];
    }

    // 3. SELECT ci.*, cs.rate FROM content_items ci JOIN campaign_sources cs ON cs.id = ci.cc_id WHERE ci.id = ? AND ci.cc_id = ?
    if (/content_items\s+ci\s+JOIN\s+campaign_sources\s+cs\s+ON\s+cs\.id\s*=\s*ci\.cc_id\s+WHERE\s+ci\.id\s*=\s*\?\s+AND\s+ci\.cc_id\s*=\s*\?/i.test(sql)) {
      const [ciId, ccId] = params;
      const ci = this.getTable('content_items').find(r => r.id === ciId && r.cc_id === ccId);
      if (!ci) return [];
      const cs = this.getTable('campaign_sources').find(r => r.id === ccId);
      return [{ ...ci, rate: cs?.rate || 0 }];
    }

    // 4. Rate observations LEFT JOIN sources
    if (/rate_observations\s+ro\s+LEFT\s+JOIN\s+sources\s+s\s+ON\s+s\.id\s*=\s*ro\.source_id/i.test(sql)) {
      let roRows = deepClone(this.getTable('rate_observations'));
      const sMap = new Map(this.getTable('sources').map(s => [s.id, s]));
      roRows = this.applyOrderBy(roRows, 'date DESC').slice(0, 50);
      return roRows.map(ro => ({
        ...ro,
        source: sMap.get(ro.source_id)?.name || null
      }));
    }

    // 5. SELECT k.title FROM courses k JOIN campaigns c ON c.course_id = k.id WHERE c.id = ?
    if (/courses\s+k\s+JOIN\s+campaigns\s+c\s+ON\s+c\.course_id\s*=\s*k\.id\s+WHERE\s+c\.id\s*=\s*\?/i.test(sql)) {
      const campId = params[0];
      const camp = this.getTable('campaigns').find(c => c.id === campId);
      if (!camp) return [];
      const course = this.getTable('courses').find(k => k.id === camp.course_id);
      return [{ title: course?.title || '' }];
    }

    // 6. Subquery bookings in loadSource
    if (/campaign_sources.*JOIN\s+campaigns/i.test(sql)) {
      const sourceId = params[0];
      const csRows = this.getTable('campaign_sources').filter(cs => cs.source_id === sourceId);
      const campMap = new Map(this.getTable('campaigns').map(c => [c.id, c]));
      return csRows.map(cs => {
        const c = campMap.get(cs.campaign_id) || {};
        return {
          id: cs.id,
          status: cs.status,
          rate: cs.rate,
          deal_posts: cs.posts,
          campaign_id: c.id,
          campaign: c.name,
          campaign_status: c.status
        };
      });
    }

    // 7. General fallback for comments / past campaigns join
    if (/campaigns\s+c\s+JOIN\s+campaign_sources\s+cs.*JOIN\s+posts\s+p/i.test(sql)) {
      const courseId = params[0];
      const camps = this.getTable('campaigns').filter(c => c.course_id === courseId && c.status === 'Closed');
      const csMap = new Map(this.getTable('campaign_sources').map(cs => [cs.id, cs]));
      const posts = this.getTable('posts');
      const out = [];
      for (const c of camps) {
        const csList = this.getTable('campaign_sources').filter(cs => cs.campaign_id === c.id);
        let totalEnrols = 0;
        for (const cs of csList) {
          const cPosts = posts.filter(p => p.cc_id === cs.id);
          totalEnrols += cPosts.reduce((acc, p) => acc + (Number(p.enrols) || 0), 0);
        }
        out.push({ name: c.name, enrols: totalEnrols });
      }
      return out;
    }

    // 8. comments join campaigns
    if (/comments\s+cm\s+JOIN\s+campaigns\s+k\s+ON\s+k\.id\s*=\s*cm\.campaign_id\s+WHERE\s+k\.course_id\s*=\s*\?/i.test(sql)) {
      const courseId = params[0];
      const camps = new Set(this.getTable('campaigns').filter(c => c.course_id === courseId).map(c => c.id));
      const cmRows = this.getTable('comments').filter(cm => camps.has(cm.campaign_id));
      const themes = {};
      for (const cm of cmRows) {
        if (!cm.theme) continue;
        themes[cm.theme] = (themes[cm.theme] || 0) + 1;
      }
      const out = Object.entries(themes).map(([theme, n]) => ({ theme, n }));
      out.sort((a, b) => b.n - a.n);
      return out;
    }

    return [];
  }

  buildWhereFilter(whereClause, params) {
    if (!whereClause || !whereClause.trim()) {
      return () => true;
    }

    // Special case for sources duplicate lookup queries
    if (/affiliation.*handle.*channelId/i.test(whereClause) || /LOWER\(handle\).*affiliation/i.test(whereClause)) {
      return (row) => {
        if (/platform\s*=\s*'YouTube'/i.test(whereClause) && row.platform !== 'YouTube') return false;
        if (/affiliation\s*=\s*\?\s*OR\s*handle\s*=\s*\?/i.test(whereClause)) {
          const [affil, handle, chId] = params;
          const contactObj = typeof row.contact === 'string' ? JSON.parse(row.contact || '{}') : (row.contact || {});
          const rowChId = contactObj.channelId;
          const matchTarget = (row.affiliation && row.affiliation === affil) ||
            (row.handle && row.handle.toLowerCase() === handle.toLowerCase()) ||
            (rowChId && rowChId === chId);
          return matchTarget;
        }
        if (/platform\s*=\s*\?\s*AND/i.test(whereClause)) {
          const [platform, handle, affilOrUrl] = params;
          if (row.platform !== platform) return false;
          if (row.handle && row.handle.toLowerCase() === handle.toLowerCase()) return true;
          if (affilOrUrl && row.affiliation && row.affiliation === affilOrUrl) return true;
          return false;
        }
        return true;
      };
    }

    let pIdx = 0;
    // Replace ? in whereClause with token placeholders
    // Parse conjunctions (AND / OR)
    const clauses = whereClause.split(/\s+AND\s+/i);

    return (row) => {
      let paramCursor = 0;
      for (const clause of clauses) {
        const c = clause.trim();

        // 1. col IN (?, ?, ...)
        const inMatch = c.match(/([`\w.]+)\s+IN\s*\(([^)]+)\)/i);
        if (inMatch) {
          const col = inMatch[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const inner = inMatch[2];
          const innerPlaceholders = (inner.match(/\?/g) || []).length;
          let allowedValues = [];
          if (innerPlaceholders > 0) {
            allowedValues = params.slice(paramCursor, paramCursor + innerPlaceholders);
            paramCursor += innerPlaceholders;
          } else {
            allowedValues = inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
          }
          if (!allowedValues.includes(row[col])) return false;
          continue;
        }

        // 2. col = ?
        const eqMatch = c.match(/([`\w.]+)\s*=\s*\?/);
        if (eqMatch) {
          const col = eqMatch[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const expected = params[paramCursor++];
          if (row[col] != expected) return false;
          continue;
        }

        // 3. col = 'literal' or col = 0
        const eqLitMatch = c.match(/([`\w.]+)\s*=\s*['"]?([^'"]+)['"]?/);
        if (eqLitMatch && !c.includes('?')) {
          const col = eqLitMatch[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const val = eqLitMatch[2].trim();
          if (String(row[col]) !== val) return false;
          continue;
        }

        // 4. col <> 'literal' or col != 'literal'
        const neqLitMatch = c.match(/([`\w.]+)\s*(?:<>|!=)\s*['"]?([^'"]+)['"]?/);
        if (neqLitMatch) {
          const col = neqLitMatch[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const val = neqLitMatch[2].trim();
          if (String(row[col]) === val) return false;
          continue;
        }

        // 5. col IS NULL
        if (/([`\w.]+)\s+IS\s+NULL/i.test(c)) {
          const col = c.match(/([`\w.]+)\s+IS\s+NULL/i)[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          if (row[col] !== null && row[col] !== undefined) return false;
          continue;
        }

        // 6. col IS NOT NULL
        if (/([`\w.]+)\s+IS\s+NOT\s+NULL/i.test(c)) {
          const col = c.match(/([`\w.]+)\s+IS\s+NOT\s+NULL/i)[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          if (row[col] === null || row[col] === undefined) return false;
          continue;
        }
      }
      return true;
    };
  }

  applyOrderBy(rows, orderBy) {
    const parts = orderBy.split(',').map(s => s.trim());
    return rows.sort((a, b) => {
      for (const part of parts) {
        // FIELD(status, "Live", "Draft", "Closed")
        const fieldMatch = part.match(/FIELD\(\s*([`\w.]+)\s*,\s*(.+?)\s*\)(?:\s+(ASC|DESC))?/i);
        if (fieldMatch) {
          const col = fieldMatch[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const values = fieldMatch[2].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
          const desc = (fieldMatch[3] || '').toUpperCase() === 'DESC';
          let idxA = values.indexOf(String(a[col]));
          let idxB = values.indexOf(String(b[col]));
          if (idxA === -1) idxA = 999;
          if (idxB === -1) idxB = 999;
          const diff = idxA - idxB;
          if (diff !== 0) return desc ? -diff : diff;
          continue;
        }

        // role = "Primary" DESC
        const boolMatch = part.match(/([`\w.]+)\s*=\s*['"]([^'"]+)['"](?:\s+(ASC|DESC))?/i);
        if (boolMatch) {
          const col = boolMatch[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const val = boolMatch[2];
          const desc = (boolMatch[3] || '').toUpperCase() === 'DESC';
          const matchA = a[col] === val ? 1 : 0;
          const matchB = b[col] === val ? 1 : 0;
          const diff = matchA - matchB;
          if (diff !== 0) return desc ? -diff : diff;
          continue;
        }

        // Standard col ASC / DESC
        const m = part.match(/([`\w.]+)(?:\s+(ASC|DESC))?/i);
        if (m) {
          const col = m[1].replace(/[`\w.]+\./, '').replace(/`/g, '');
          const desc = (m[2] || '').toUpperCase() === 'DESC';
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) continue;
          if (valA === null || valA === undefined) return desc ? 1 : -1;
          if (valB === null || valB === undefined) return desc ? -1 : 1;
          if (typeof valA === 'number' && typeof valB === 'number') {
            return desc ? valB - valA : valA - valB;
          }
          const strDiff = String(valA).localeCompare(String(valB));
          if (strDiff !== 0) return desc ? -strDiff : strDiff;
        }
      }
      return 0;
    });
  }
}

const storeInstance = new RelationalStore();
module.exports = storeInstance;
