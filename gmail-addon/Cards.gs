/**
 * Hive OS – Gmail Add-on (Cards.gs)
 * UI rendering + lead/notification detection
 */

function buildMessageCard(messageData) {
  var fromName = (messageData.from && messageData.from.name) ? messageData.from.name : '—';
  var fromEmail = (messageData.from && messageData.from.email) ? messageData.from.email : '—';
  var subject = messageData.subject || '(No subject)';
  var snippet = truncateText_(messageData.snippet || '', 260);
  var received = formatDateTime_(messageData.receivedAt);

  var classification = classifyEmail_(messageData);

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'));

  // Email preview section
  var preview = CardService.newCardSection()
    .addWidget(CardService.newKeyValue().setTopLabel('From Name').setContent(fromName))
    .addWidget(CardService.newKeyValue().setTopLabel('From Email').setContent(fromEmail))
    .addWidget(CardService.newKeyValue().setTopLabel('Subject').setContent(subject))
    .addWidget(CardService.newKeyValue().setTopLabel('Received').setContent(received))
    .addWidget(CardService.newTextParagraph().setText('<i>' + escapeHtml_(snippet) + '</i>'));

  card.addSection(preview);

  // Warning section for notifications/bots
  if (classification.isLikelyNotification) {
    var warn = CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText('⚠️ This looks like an automated notification, not a lead.'));
    var reasons = classification.reasons || [];
    if (reasons.length) {
      warn.addWidget(CardService.newTextParagraph().setText('Why: ' + escapeHtml_(reasons.slice(0, 2).join(' • '))));
    }
    card.addSection(warn);
  }

  // Actions section
  var actions = CardService.newCardSection();

  if (classification.isLikelyNotification) {
    actions.addWidget(
      CardService.newTextButton()
        .setText('Log Activity Only')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('onLogActivityOnly')
            .setParameters({ messageData: JSON.stringify(messageData) })
        )
    );

    actions.addWidget(
      CardService.newTextButton()
        .setText('Create Opportunity Anyway')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('onCreateOpportunity')
            .setParameters({ messageData: JSON.stringify(messageData) })
        )
    );
  } else {
    actions.addWidget(
      CardService.newTextButton()
        .setText('Create Opportunity')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('onCreateOpportunity')
            .setParameters({ messageData: JSON.stringify(messageData) })
        )
    );

    actions.addWidget(
      CardService.newTextButton()
        .setText('Add Company Only')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('onCreateCompanyOnly')
            .setParameters({ messageData: JSON.stringify(messageData) })
        )
    );

    actions.addWidget(
      CardService.newTextButton()
        .setText('Log Activity Only')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('onLogActivityOnly')
            .setParameters({ messageData: JSON.stringify(messageData) })
        )
    );
  }

  card.addSection(actions);
  return card.build();
}

/* ------------------------------------------------------------------ */
/* Result Cards                                                       */
/* ------------------------------------------------------------------ */

function buildSuccessCard(result) {
  var opp = result.opportunity || {};
  var company = result.company || {};
  var url = (opp.url || '').trim();

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('✅ Opportunity created'))
    .addWidget(kv_('Company', company.name || '—'))
    .addWidget(kv_('Opportunity', opp.name || '—'))
    .addWidget(kv_('Stage', opp.stage || 'qualification'))
    .addWidget(kv_('Activity', (result.activity && result.activity.id) ? 'Logged' : '—'));

  if (url) {
    sec.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setOpenLink(CardService.newOpenLink().setUrl(url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

function buildDuplicateCard(result) {
  var opp = result.opportunity || {};
  var url = (opp.url || '').trim();

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('🔁 Already logged (duplicate message)'))
    .addWidget(kv_('Opportunity', opp.name || '—'))
    .addWidget(kv_('Stage', opp.stage || '—'));

  if (url) {
    sec.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setOpenLink(CardService.newOpenLink().setUrl(url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

function buildAttachedCard(result) {
  var opp = result.opportunity || {};
  var url = (opp.url || '').trim();

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('📎 Activity attached to existing Opportunity (thread match)'))
    .addWidget(kv_('Opportunity', opp.name || '—'))
    .addWidget(kv_('Stage', opp.stage || '—'))
    .addWidget(kv_('Activity', (result.activity && result.activity.id) ? 'Logged' : '—'));

  if (url) {
    sec.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setOpenLink(CardService.newOpenLink().setUrl(url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

// Alias for backwards compatibility with Code.gs
function buildLogSuccessCard(result) {
  return buildLogOnlySuccessCard(result);
}

function buildLogOnlySuccessCard(result) {
  var opp = result.opportunity || {};
  var url = (opp.url || '').trim();

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('✅ Activity logged (no new Opportunity)'))
    .addWidget(kv_('Opportunity', opp.name || '—'))
    .addWidget(kv_('Activity', (result.activity && result.activity.id) ? 'Logged' : '—'));

  if (url) {
    sec.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setOpenLink(CardService.newOpenLink().setUrl(url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

function buildCompanyCreatedCard(result) {
  var company = result.company || {};
  var url = (company.url || '').trim();

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('✅ Company added'))
    .addWidget(kv_('Company', company.name || '—'))
    .addWidget(kv_('Domain', company.domain || '—'))
    .addWidget(CardService.newTextParagraph().setText('No opportunity created. You can add deals later.'));

  if (url) {
    sec.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setOpenLink(CardService.newOpenLink().setUrl(url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

function buildCompanyExistsCard(result) {
  var company = result.company || {};
  var url = (company.url || '').trim();

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('ℹ️ Company already exists'))
    .addWidget(kv_('Company', company.name || '—'))
    .addWidget(kv_('Domain', company.domain || '—'));

  if (url) {
    sec.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setOpenLink(CardService.newOpenLink().setUrl(url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

function buildHiveDebugCard(result) {
  var status = result && result.status ? String(result.status) : 'missing';
  var msg = result && result.message ? String(result.message) : '';
  var http = result && result._debug && result._debug.httpCode ? String(result._debug.httpCode) : '—';
  var body = result && result._debug && result._debug.body300 ? String(result._debug.body300) : '';
  var url = result && result._debug && result._debug.url ? String(result._debug.url) : '';

  var keys = [];
  try { keys = Object.keys(result || {}); } catch (e) { keys = []; }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('⚠️ Hive API response did not match expected contract.'))
        .addWidget(kv_('status', status))
        .addWidget(kv_('http', http))
        .addWidget(kv_('url', url || '—'))
        .addWidget(kv_('keys', keys.join(', ') || '—'))
        .addWidget(CardService.newTextParagraph().setText('<b>message</b><br/>' + escapeHtml_(msg || '—')))
        .addWidget(CardService.newTextParagraph().setText('<b>body (first 300)</b><br/><i>' + escapeHtml_(body || '—') + '</i>'))
    )
    .build();
}

function buildErrorCard(message) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('❌ ' + escapeHtml_(message || 'Error')))
    )
    .build();
}

function buildPersonalEmailCard(messageData) {
  var fromEmail = (messageData.from && messageData.from.email) ? messageData.from.email : '—';
  var domain = getEmailDomain_(fromEmail);

  var sec = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText('⚠️ Personal email domain detected'))
    .addWidget(kv_('From', fromEmail))
    .addWidget(kv_('Domain', domain || '—'))
    .addWidget(CardService.newTextParagraph().setText(
      'Opportunities should be created from business email addresses, not personal ones like Gmail, Yahoo, etc.'
    ));

  // Offer to log as activity anyway
  sec.addWidget(
    CardService.newTextButton()
      .setText('Log Activity Only')
      .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName('onLogActivityOnly')
          .setParameters({ messageData: JSON.stringify(messageData) })
      )
  );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(sec)
    .build();
}

function buildConfigMissingCard() {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Hive OS'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(
          '⚠️ Missing configuration.\n\nSet Script Properties:\n- HIVE_API_URL (e.g. https://os.hiveadagency.com)\n- HIVE_INBOUND_EMAIL_SECRET'
        ))
    )
    .build();
}

/* ------------------------------------------------------------------ */
/* Lead/Notification Detection                                         */
/* ------------------------------------------------------------------ */

function classifyEmail_(messageData) {
  var fromEmail = (messageData.from && messageData.from.email) ? messageData.from.email : '';
  var fromName = (messageData.from && messageData.from.name) ? messageData.from.name : '';
  var domain = getEmailDomain_(fromEmail);

  var reasons = [];

  var blockedDomains = [
    'vercel.com',
    'github.com',
    'notifications.github.com',
    'google.com'
  ];

  if (domain && blockedDomains.indexOf(domain) >= 0) {
    reasons.push('sender domain ' + domain);
  }

  var localPart = fromEmail.split('@')[0] || '';
  if (/no-?reply/i.test(localPart) || /noreply/i.test(fromEmail)) {
    reasons.push('from is noreply');
  }

  if (/bot/i.test(fromName)) {
    reasons.push('from name contains "bot"');
  }

  return {
    isLikelyNotification: reasons.length > 0,
    reasons: reasons,
    senderDomain: domain
  };
}

function getEmailDomain_(email) {
  if (!email) return '';
  var parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase().trim() : '';
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                         */
/* ------------------------------------------------------------------ */

function truncateText_(s, maxLen) {
  s = s || '';
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

function formatDateTime_(iso) {
  try {
    if (!iso) return '—';
    var d = new Date(iso);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
  } catch (e) {
    return '—';
  }
}

function escapeHtml_(str) {
  str = str || '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function kv_(label, value) {
  return CardService.newKeyValue().setTopLabel(label).setContent(value || '—');
}
