/**
 * Hive OS Gmail Add-on
 *
 * Main entry points for the Gmail Add-on.
 * Creates opportunities from emails with deduplication and thread tracking.
 * Supports lead vs notification detection with log-only mode.
 */

/**
 * Main entry point - builds the add-on card when an email is opened
 * @param {Object} e - Gmail event object
 * @returns {Card} The add-on card
 */
function buildAddOn(e) {
  // Check if configuration is set
  var config = getConfig();
  if (!config.apiUrl || !config.secret) {
    return buildConfigMissingCard();
  }

  // Get the currently viewed message
  var accessToken = e.gmail.accessToken;
  var messageId = e.gmail.messageId;

  GmailApp.setCurrentMessageAccessToken(accessToken);

  try {
    var message = GmailApp.getMessageById(messageId);
    var thread = message.getThread();

    var messageData = {
      gmailMessageId: messageId,
      gmailThreadId: thread.getId(),
      from: parseFromHeader(message.getFrom()),
      to: parseAddresses(message.getTo()),
      cc: parseAddresses(message.getCc()),
      subject: message.getSubject(),
      snippet: thread.getFirstMessageSubject(),
      bodyText: message.getPlainBody(),
      receivedAt: message.getDate().toISOString(),
      gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/' + thread.getId()
    };

    return buildMessageCard(messageData);
  } catch (error) {
    Logger.log('Error building add-on: ' + error.message);
    return buildErrorCard('Failed to read email: ' + error.message);
  }
}

/**
 * Handle the "Create Opportunity" button click
 * @param {Object} e - Action event object
 * @returns {Card} Result card
 */
function onCreateOpportunity(e) {
  try {
    // Parse the message data from the action parameters
    var messageData = JSON.parse(e.parameters.messageData);

    // Call the Hive API (default mode - creates opportunity)
    var result = callHiveApi(messageData);

    if (result.status === 'duplicate') {
      return buildDuplicateCard(result);
    } else if (result.status === 'attached') {
      return buildAttachedCard(result);
    } else if (result.status === 'success') {
      return buildSuccessCard(result);
    } else if (result.status === 'logged') {
      // Handle logged status (in case API returns it)
      return buildLogSuccessCard(result);
    } else if (result.status === 'personal_email') {
      // Personal email - offer to log as activity instead
      return buildPersonalEmailCard(messageData);
    } else {
      return buildErrorCard(result.message || 'Unknown error');
    }
  } catch (error) {
    Logger.log('Error creating opportunity: ' + error.message);
    return buildErrorCard('Failed to create opportunity: ' + error.message);
  }
}

/**
 * Handle the "Log Activity Only" button click
 * Logs the email as an activity without creating a new opportunity
 * @param {Object} e - Action event object
 * @returns {Card} Result card
 */
function onLogActivityOnly(e) {
  try {
    // Parse the message data from the action parameters
    var messageData = JSON.parse(e.parameters.messageData);

    // Add mode flag to indicate log-only
    messageData.mode = 'log_only';

    // Call the Hive API with log_only mode
    var result = callHiveApi(messageData);

    if (result.status === 'duplicate') {
      return buildDuplicateCard(result);
    } else if (result.status === 'attached') {
      // Successfully attached to existing thread's opportunity
      return buildAttachedCard(result);
    } else if (result.status === 'logged') {
      // Successfully logged without creating opportunity
      return buildLogSuccessCard(result);
    } else if (result.status === 'success') {
      // Fallback - show log success card
      return buildLogSuccessCard(result);
    } else {
      return buildErrorCard(result.message || 'Unknown error');
    }
  } catch (error) {
    Logger.log('Error logging activity: ' + error.message);
    return buildErrorCard('Failed to log activity: ' + error.message);
  }
}

/**
 * Handle the "Create Company Only" button click
 * Creates a company without creating an opportunity
 * @param {Object} e - Action event object
 * @returns {Card} Result card
 */
function onCreateCompanyOnly(e) {
  try {
    // Parse the message data from the action parameters
    var messageData = JSON.parse(e.parameters.messageData);

    // Call the Hive API company endpoint
    var result = callHiveCompanyApi(messageData);

    if (result.status === 'created') {
      return buildCompanyCreatedCard(result);
    } else if (result.status === 'existing') {
      return buildCompanyExistsCard(result);
    } else if (result.status === 'personal_email') {
      return buildPersonalEmailCard(messageData);
    } else {
      return buildErrorCard(result.message || 'Unknown error');
    }
  } catch (error) {
    Logger.log('Error creating company: ' + error.message);
    return buildErrorCard('Failed to create company: ' + error.message);
  }
}

/**
 * Parse the From header into name and email
 * @param {string} from - From header string
 * @returns {Object} Object with email and name properties
 */
function parseFromHeader(from) {
  // Handle formats like:
  // "John Doe <john@example.com>"
  // "<john@example.com>"
  // "john@example.com"

  var emailMatch = from.match(/<([^>]+)>/);
  var email = emailMatch ? emailMatch[1] : from.trim();

  var name = null;
  if (emailMatch) {
    name = from.replace(/<[^>]+>/, '').trim();
    // Remove quotes if present
    name = name.replace(/^["']|["']$/g, '').trim();
  }

  return {
    email: email.toLowerCase(),
    name: name || null
  };
}

/**
 * Parse a comma-separated list of email addresses
 * @param {string} addresses - Comma-separated email addresses
 * @returns {string[]} Array of email addresses
 */
function parseAddresses(addresses) {
  if (!addresses) return [];

  return addresses.split(',')
    .map(function(addr) {
      var match = addr.match(/<([^>]+)>/);
      return match ? match[1].toLowerCase().trim() : addr.toLowerCase().trim();
    })
    .filter(function(addr) {
      return addr.length > 0;
    });
}

/**
 * Handle the "Review Only" button click (for personal emails)
 * Creates an inbox item and summarizes without creating an opportunity.
 * @param {Object} e - Action event object
 * @returns {Card} Result card
 */
function onSendToInboxReview(e) {
  try {
    var messageData = JSON.parse(e.parameters.messageData);

    // ROUTING: "Summarize + Tasks" button → /api/os/inbound/gmail-inbox-review
    Logger.log('[GMAIL_ADDON] onSendToInboxReview → callHiveInboxReviewApi → /gmail-inbox-review');

    // Call the inbox review API
    var result = callHiveInboxReviewApi(messageData);

    if (result.ok) {
      return buildInboxReviewSuccessCard(result);
    } else {
      return buildErrorCard(result.error || 'Unknown error');
    }
  } catch (error) {
    Logger.log('Error sending to inbox review: ' + error.message);
    return buildErrorCard('Failed to send to inbox: ' + error.message);
  }
}

/**
 * Handle the "Review + Create Opportunity" button click (for business emails)
 * Creates an inbox item, summarizes, and creates/attaches to an opportunity.
 * @param {Object} e - Action event object
 * @returns {Card} Result card
 */
function onReviewAndCreateOpportunity(e) {
  try {
    var messageData = JSON.parse(e.parameters.messageData);

    // ROUTING: "Summarize + Tasks + Opp" button → /api/os/inbound/gmail-inbox-review-opportunity
    Logger.log('[GMAIL_ADDON] onReviewAndCreateOpportunity → callHiveReviewOpportunityApi → /gmail-inbox-review-opportunity');

    // Call the review + opportunity API
    var result = callHiveReviewOpportunityApi(messageData);

    if (!result.ok && result.status === 'partial') {
      // Inbox succeeded but opportunity failed
      return buildInboxReviewSuccessCard(result);
    }

    if (result.ok && result.skippedOpportunity) {
      // Inbox succeeded but opportunity was skipped (personal domain, etc.)
      return buildReviewOpportunitySkippedCard(result);
    }

    if (result.ok && result.promoted) {
      // Full success - opportunity created or attached
      return buildReviewOpportunitySuccessCard(result);
    }

    if (result.ok) {
      // Fallback for ok=true but unexpected shape
      return buildInboxReviewSuccessCard(result);
    }

    return buildErrorCard(result.error || 'Unknown error');
  } catch (error) {
    Logger.log('Error in review + opportunity: ' + error.message);
    return buildErrorCard('Failed to process email: ' + error.message);
  }
}
