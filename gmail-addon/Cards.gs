/**
 * Hive OS Gmail Add-on - Card Builders
 *
 * Functions for building CardService UI cards.
 */

// ============================================================================
// Lead Detection
// ============================================================================

/**
 * Notification sender domains - emails from these are likely automated
 */
var NOTIFICATION_DOMAINS = [
  'vercel.com',
  'github.com',
  'notifications.github.com',
  'noreply.github.com',
  'google.com',
  'googlemail.com',
  'facebookmail.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'slack.com',
  'notion.so',
  'atlassian.com',
  'jira.com',
  'trello.com',
  'asana.com',
  'monday.com',
  'stripe.com',
  'paypal.com',
  'intuit.com',
  'quickbooks.com',
  'mailchimp.com',
  'sendgrid.net',
  'amazonses.com',
  'postmarkapp.com',
  'calendly.com',
  'zoom.us',
  'dropbox.com',
  'docusign.com',
  'hubspot.com',
  'salesforce.com',
  'intercom.io',
  'zendesk.com',
  'freshdesk.com'
];

/**
 * Classify an email as lead vs notification
 * @param {Object} messageData - Email message data
 * @returns {Object} Classification result with isLikelyNotification, reasons, senderDomain
 */
function classifyEmail(messageData) {
  var reasons = [];
  var isLikelyNotification = false;

  var email = (messageData.from.email || '').toLowerCase();
  var name = (messageData.from.name || '').toLowerCase();

  // Extract domain from email
  var senderDomain = '';
  var atIndex = email.indexOf('@');
  if (atIndex !== -1) {
    senderDomain = email.substring(atIndex + 1);
  }

  // Extract local part (before @)
  var localPart = atIndex !== -1 ? email.substring(0, atIndex) : email;

  // Check 1: Known notification domains
  for (var i = 0; i < NOTIFICATION_DOMAINS.length; i++) {
    if (senderDomain === NOTIFICATION_DOMAINS[i] || senderDomain.endsWith('.' + NOTIFICATION_DOMAINS[i])) {
      reasons.push('Sender domain: ' + senderDomain);
      isLikelyNotification = true;
      break;
    }
  }

  // Check 2: Domain starts with noreply/no-reply
  if (senderDomain.indexOf('noreply') === 0 || senderDomain.indexOf('no-reply') === 0) {
    reasons.push('No-reply domain');
    isLikelyNotification = true;
  }

  // Check 3: From name contains "bot"
  if (name.indexOf('bot') !== -1) {
    reasons.push('Sender name contains "bot"');
    isLikelyNotification = true;
  }

  // Check 4: Local part contains noreply/no-reply
  if (localPart.indexOf('noreply') !== -1 || localPart.indexOf('no-reply') !== -1) {
    reasons.push('No-reply address');
    isLikelyNotification = true;
  }

  // Check 5: Common notification local parts
  var notificationLocalParts = ['notifications', 'notification', 'alerts', 'alert', 'mailer', 'donotreply', 'do-not-reply'];
  for (var j = 0; j < notificationLocalParts.length; j++) {
    if (localPart.indexOf(notificationLocalParts[j]) !== -1) {
      reasons.push('Automated sender address');
      isLikelyNotification = true;
      break;
    }
  }

  return {
    isLikelyNotification: isLikelyNotification,
    reasons: reasons.slice(0, 2), // Limit to 2 reasons
    senderDomain: senderDomain
  };
}

/**
 * Format ISO date string to readable local format
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date string (e.g., "Dec 18, 2025 3:10 PM")
 */
function formatReceivedDate(isoDate) {
  if (!isoDate) return '—';

  try {
    var date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;

    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[date.getMonth()];
    var day = date.getDate();
    var year = date.getFullYear();

    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    var minutesStr = minutes < 10 ? '0' + minutes : minutes;

    return month + ' ' + day + ', ' + year + ' ' + hours + ':' + minutesStr + ' ' + ampm;
  } catch (e) {
    return isoDate;
  }
}

// ============================================================================
// Card Builders
// ============================================================================

/**
 * Build the main message card with email details and action buttons
 * @param {Object} msg - Message data object
 * @returns {Card} Card with message details and appropriate CTAs
 */
function buildMessageCard(msg) {
  var card = CardService.newCardBuilder();

  // Header
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Hive OS')
      .setSubtitle('Add to pipeline')
  );

  // =========================================================================
  // Section 1: Email Preview
  // =========================================================================
  var previewSection = CardService.newCardSection()
    .setHeader('Email Preview');

  // From Name
  previewSection.addWidget(
    CardService.newKeyValue()
      .setTopLabel('From Name')
      .setContent(msg.from.name || '—')
  );

  // From Email
  previewSection.addWidget(
    CardService.newKeyValue()
      .setTopLabel('From Email')
      .setContent(msg.from.email || '—')
  );

  // Subject
  previewSection.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Subject')
      .setContent(msg.subject || '(No subject)')
      .setMultiline(true)
  );

  // Received At
  previewSection.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Received')
      .setContent(formatReceivedDate(msg.receivedAt))
  );

  // Snippet
  if (msg.snippet) {
    var snippetText = msg.snippet;
    if (snippetText.length > 250) {
      snippetText = snippetText.substring(0, 247) + '...';
    }
    previewSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Preview')
        .setContent(snippetText)
        .setMultiline(true)
    );
  }

  card.addSection(previewSection);

  // =========================================================================
  // Section 2: Lead Detection
  // =========================================================================
  var classification = classifyEmail(msg);

  if (classification.isLikelyNotification) {
    var warningSection = CardService.newCardSection()
      .setHeader('Lead Detection');

    // Warning message
    warningSection.addWidget(
      CardService.newTextParagraph()
        .setText('⚠️ This looks like an automated notification, not a lead.')
    );

    // Show reasons (up to 2)
    if (classification.reasons.length > 0) {
      var reasonsText = classification.reasons.map(function(r) {
        return '• ' + r;
      }).join('\n');

      warningSection.addWidget(
        CardService.newTextParagraph()
          .setText(reasonsText)
      );
    }

    card.addSection(warningSection);
  }

  // =========================================================================
  // Section 3: Actions
  // =========================================================================
  var actionSection = CardService.newCardSection();

  var messageDataJson = JSON.stringify(msg);

  if (classification.isLikelyNotification) {
    // Notification detected: Log Only as primary, Create as secondary

    // Primary: Log Activity Only
    var logOnlyAction = CardService.newAction()
      .setFunctionName('onLogActivityOnly')
      .setParameters({ messageData: messageDataJson });

    actionSection.addWidget(
      CardService.newTextButton()
        .setText('Log Activity Only')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(logOnlyAction)
    );

    // Secondary: Create Opportunity Anyway
    var createAnywayAction = CardService.newAction()
      .setFunctionName('onCreateOpportunity')
      .setParameters({ messageData: messageDataJson });

    actionSection.addWidget(
      CardService.newTextButton()
        .setText('Create Opportunity Anyway')
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
        .setOnClickAction(createAnywayAction)
    );
  } else {
    // Normal lead: Create Opportunity as primary

    var createAction = CardService.newAction()
      .setFunctionName('onCreateOpportunity')
      .setParameters({ messageData: messageDataJson });

    actionSection.addWidget(
      CardService.newTextButton()
        .setText('Create Opportunity')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(createAction)
    );
  }

  card.addSection(actionSection);

  return card.build();
}

/**
 * Build success card showing the created opportunity
 * @param {Object} result - API response with opportunity data
 * @returns {Card} Success card
 */
function buildSuccessCard(result) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('✅ Opportunity Created')
      .setSubtitle('Successfully added to Hive OS')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Opportunity')
      .setContent(result.opportunity.name)
      .setMultiline(true)
  );

  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Company')
      .setContent(result.company.name + (result.company.isNew ? ' (New)' : ''))
  );

  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Stage')
      .setContent(result.opportunity.stage)
  );

  card.addSection(section);

  // Link section
  var linkSection = CardService.newCardSection();

  linkSection.addWidget(
    CardService.newTextButton()
      .setText('Open in Hive OS')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOpenLink(
        CardService.newOpenLink()
          .setUrl(result.opportunity.url)
          .setOpenAs(CardService.OpenAs.FULL_SIZE)
      )
  );

  card.addSection(linkSection);

  return card.build();
}

/**
 * Build success card for log-only mode
 * @param {Object} result - API response with activity data
 * @returns {Card} Log success card
 */
function buildLogSuccessCard(result) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('✅ Logged Email Activity')
      .setSubtitle('Email recorded in Hive OS')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph()
      .setText('This email has been logged as an activity.')
  );

  // If attached to an opportunity, show it
  if (result.opportunity) {
    section.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Attached to')
        .setContent(result.opportunity.name)
        .setMultiline(true)
    );

    section.addWidget(
      CardService.newTextButton()
        .setText('Open in Hive OS')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOpenLink(
          CardService.newOpenLink()
            .setUrl(result.opportunity.url)
            .setOpenAs(CardService.OpenAs.FULL_SIZE)
        )
    );
  } else {
    section.addWidget(
      CardService.newTextParagraph()
        .setText('No opportunity was created (logged as standalone activity).')
    );
  }

  card.addSection(section);

  return card.build();
}

/**
 * Build duplicate card when email was already added
 * @param {Object} result - API response with existing opportunity data
 * @returns {Card} Duplicate notification card
 */
function buildDuplicateCard(result) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Already Added')
      .setSubtitle('This email is already in Hive OS')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph()
      .setText('This email has already been added to an opportunity.')
  );

  if (result.opportunity) {
    section.addWidget(
      CardService.newKeyValue()
        .setTopLabel('Existing Opportunity')
        .setContent(result.opportunity.name)
        .setMultiline(true)
    );

    section.addWidget(
      CardService.newTextButton()
        .setText('Open Opportunity')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOpenLink(
          CardService.newOpenLink()
            .setUrl(result.opportunity.url)
            .setOpenAs(CardService.OpenAs.FULL_SIZE)
        )
    );
  }

  card.addSection(section);

  return card.build();
}

/**
 * Build attached card when email was added to existing thread's opportunity
 * @param {Object} result - API response with opportunity data
 * @returns {Card} Thread attachment notification card
 */
function buildAttachedCard(result) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('✅ Added to Thread')
      .setSubtitle('Email added to existing conversation')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph()
      .setText('This email was added to an existing opportunity from this email thread.')
  );

  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Opportunity')
      .setContent(result.opportunity.name)
      .setMultiline(true)
  );

  section.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Company')
      .setContent(result.company.name)
  );

  section.addWidget(
    CardService.newTextButton()
      .setText('Open in Hive OS')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOpenLink(
        CardService.newOpenLink()
          .setUrl(result.opportunity.url)
          .setOpenAs(CardService.OpenAs.FULL_SIZE)
      )
  );

  card.addSection(section);

  return card.build();
}

/**
 * Build personal email card when sender is from a personal domain
 * @param {Object} msg - Message data for retry with log_only
 * @returns {Card} Personal email notification card
 */
function buildPersonalEmailCard(msg) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Personal Email Detected')
      .setSubtitle('Cannot create opportunity')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph()
      .setText('This email is from a personal email address (e.g., gmail.com). Opportunities can only be created from business email addresses.')
  );

  section.addWidget(
    CardService.newTextParagraph()
      .setText('You can still log this email as an activity without creating an opportunity.')
  );

  // Offer to log as activity instead
  if (msg) {
    var messageDataJson = JSON.stringify(msg);
    var logOnlyAction = CardService.newAction()
      .setFunctionName('onLogActivityOnly')
      .setParameters({ messageData: messageDataJson });

    section.addWidget(
      CardService.newTextButton()
        .setText('Log Activity Only')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(logOnlyAction)
    );
  }

  card.addSection(section);

  return card.build();
}

/**
 * Build error card
 * @param {string} message - Error message to display
 * @returns {Card} Error card
 */
function buildErrorCard(message) {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('❌ Error')
      .setSubtitle('Something went wrong')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph()
      .setText(message)
  );

  card.addSection(section);

  return card.build();
}

/**
 * Build configuration missing card
 * @returns {Card} Setup instructions card
 */
function buildConfigMissingCard() {
  var card = CardService.newCardBuilder();

  card.setHeader(
    CardService.newCardHeader()
      .setTitle('Setup Required')
      .setSubtitle('Hive OS add-on needs configuration')
  );

  var section = CardService.newCardSection();

  section.addWidget(
    CardService.newTextParagraph()
      .setText('The Hive OS add-on needs to be configured before use.')
  );

  section.addWidget(
    CardService.newTextParagraph()
      .setText('Please set the following Script Properties:\n\n' +
        '• HIVE_API_URL - Your Hive OS URL (e.g., https://hive-os.vercel.app)\n' +
        '• HIVE_INBOUND_EMAIL_SECRET - Your API secret key')
  );

  section.addWidget(
    CardService.newTextParagraph()
      .setText('Go to Extensions > Apps Script > Project Settings > Script Properties to configure.')
  );

  card.addSection(section);

  return card.build();
}
