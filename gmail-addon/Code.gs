/**
 * Hive OS Gmail Add-on (Code.gs)
 * Entry point + message parsing + button handlers + task extraction
 *
 * Script Properties required:
 *   HIVE_API_URL
 *   HIVE_INBOUND_SECRET   (preferred; legacy fallback: HIVE_INBOUND_EMAIL_SECRET)
 *   ANTHROPIC_API_KEY
 *
 * OPENAI_API_KEY is no longer used by this code.
 */

/* =========================================================================
 * Entry point
 * ========================================================================= */

function buildAddOn(e) {
  var config = getConfig_();
  if (!config.apiUrl || !config.secret) {
    return buildConfigMissingCard_();
  }

  var accessToken = e.gmail && e.gmail.accessToken;
  var messageId = e.gmail && e.gmail.messageId;

  if (!accessToken || !messageId) {
    return buildErrorCard_('Missing Gmail event context (accessToken/messageId).');
  }

  try {
    var g = fetchGmailMessage_(accessToken, messageId);

    var headers = headersToMap_(g.payload && g.payload.headers ? g.payload.headers : []);
    var from = parseFromHeader_(headers["from"] || "");
    var to = parseAddresses_(headers["to"] || "");
    var cc = parseAddresses_(headers["cc"] || "");

    var threadId = g.threadId || "";
    var receivedAtIso = g.internalDate
      ? new Date(Number(g.internalDate)).toISOString()
      : new Date().toISOString();

    var snippet = (g.snippet || "").slice(0, 280);
    var bodyText = extractPlainText_(g.payload);

    var messageData = {
      gmailMessageId: messageId,
      gmailThreadId: threadId,
      from: from,
      to: to,
      cc: cc,
      subject: headers["subject"] || "(No subject)",
      snippet: snippet,
      bodyText: bodyText,
      receivedAt: receivedAtIso,
      gmailUrl: threadId ? ("https://mail.google.com/mail/u/0/#inbox/" + threadId) : ""
    };

    return buildMessageCard_(messageData);
  } catch (err) {
    Logger.log("buildAddOn error: " + (err && err.message ? err.message : err));
    return buildErrorCard_("Failed to read email: " + (err && err.message ? err.message : String(err)));
  }
}

/* =========================================================================
 * Button handlers — inbox / opportunity / company / activity
 * ========================================================================= */

function onSendToInboxReview(e) {
  return callHiveInbound_(e, "/api/os/inbound/gmail-inbox-review");
}

function onReviewAndCreateOpportunity(e) {
  return callHiveInbound_(e, "/api/os/inbound/gmail-inbox-review-opportunity");
}

function onCreateOpportunity(e) {
  return callHiveInbound_(e, "/api/os/inbound/gmail");
}

function onLogActivityOnly(e) {
  return callHiveInbound_(e, "/api/os/inbound/gmail-log-activity");
}

function onCreateCompanyOnly(e) {
  return callHiveInbound_(e, "/api/os/inbound/gmail-company");
}

/* =========================================================================
 * Core POST helper for HiveOS inbound endpoints
 * ========================================================================= */

function callHiveInbound_(e, path) {
  try {
    var config = getConfig_();
    if (!config.apiUrl || !config.secret) {
      return notify_(e, "Missing HIVE_API_URL / HIVE_INBOUND_SECRET in Script Properties.");
    }

    var messageDataStr =
      (e && e.parameters && e.parameters.messageData) ? e.parameters.messageData :
      (e && e.parameters && e.parameters.payload) ? e.parameters.payload :
      "{}";

    var payload = JSON.parse(messageDataStr);

    var url = config.apiUrl.replace(/\/$/, "") + path;

    Logger.log("[HiveOS] POST " + url);

    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Hive-Secret": config.secret
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    var text = res.getContentText();

    Logger.log("[HiveOS] response code: " + code);
    Logger.log("[HiveOS] response body: " + text);

    if (code >= 200 && code < 300) {
      var parsed = {};
      try { parsed = JSON.parse(text || "{}"); } catch (err) { parsed = { ok: true, raw: text }; }
      return CardService.newActionResponseBuilder()
        .setNavigation(CardService.newNavigation().pushCard(renderResultCard_(parsed, payload)))
        .build();
    }

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(
        buildErrorCard_("Hive OS error (" + code + "): " + truncate_(text, 220))
      ))
      .build();

  } catch (err) {
    Logger.log("callHiveInbound_ error: " + (err && err.message ? err.message : err));
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(
        buildErrorCard_("Failed: " + (err && err.message ? err.message : String(err)))
      ))
      .build();
  }
}

/* =========================================================================
 * Extract Personal Tasks (Anthropic)
 * ========================================================================= */

function onExtractPersonalTasks(e) {
  try {
    var payload = JSON.parse(e.parameters.messageData || "{}");
    var body = payload.bodyText || "";
    var subject = payload.subject || "";

    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in Script Properties");

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "Extract action items from the email. Return ONLY a valid JSON array, no markdown, no explanation.\nEach object: {\"title\":\"verb-first action\",\"list\":\"inbox\"|\"my_tasks\"|\"waiting_on\"|\"someday\",\"priority\":\"high\"|\"medium\"|\"low\",\"due\":\"natural date string or null\",\"person\":\"name or null\",\"context\":\"1 sentence why it matters\"}\nRules: waiting_on=delegated or awaiting someone; my_tasks=clear personal actions; someday=vague or aspirational; inbox=unclear. Return [] if no tasks found.",
        messages: [{ role: "user", content: "Subject: " + subject + "\n\n" + body }]
      }),
      muteHttpExceptions: true
    });

    var raw = JSON.parse(response.getContentText()).content[0].text;
    var match = raw.match(/\[[\s\S]*\]/);
    var tasks = match ? JSON.parse(match[0]) : [];

    if (!tasks.length) {
      return CardService.newActionResponseBuilder()
        .setNavigation(CardService.newNavigation().pushCard(
          buildErrorCard_("No tasks found in this email.")
        ))
        .build();
    }

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(
        buildTaskPreviewCard_(tasks)
      ))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(
        buildErrorCard_("Task extraction failed: " + (err && err.message ? err.message : String(err)))
      ))
      .build();
  }
}

/* =========================================================================
 * Send extracted tasks to Reminders backend
 * ========================================================================= */

function onSendTasksToReminders(e) {
  try {
    var rawTasks = e.parameters.tasks || "";
    var config = getConfig_();

    // Send parsed JSON when possible; fall back to raw string for legacy callers.
    var tasksPayload;
    try {
      tasksPayload = JSON.parse(rawTasks);
    } catch (parseErr) {
      tasksPayload = rawTasks;
    }

    Logger.log("Raw tasks: " + rawTasks);

    var res = UrlFetchApp.fetch(config.apiUrl + "/api/reminders/create", {
      method: "post",
      contentType: "application/json",
      headers: {
        "X-Hive-Secret": config.secret
      },
      payload: JSON.stringify({ tasks: tasksPayload }),
      muteHttpExceptions: true
    });

    var text = res.getContentText();
    Logger.log("API response: " + text);

    var data = JSON.parse(text);

    if (!data.redirectUrl) {
      throw new Error("Missing redirectUrl");
    }

    var section = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph().setText("Click below to send tasks to Reminders:")
      )
      .addWidget(
        CardService.newTextButton()
          .setText("Open Reminders")
          .setOpenLink(
            CardService.newOpenLink().setUrl(data.redirectUrl)
          )
      );

    var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Send to Reminders"))
      .addSection(section)
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("❌ Failed: " + (err && err.message ? err.message : String(err)))
      )
      .build();
  }
}

/* =========================================================================
 * Task preview card (grouped by list)
 * ========================================================================= */

function buildTaskPreviewCard_(tasks) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Extracted Tasks"));

  var groups = [
    { key: "my_tasks",   header: "🎯 My Tasks" },
    { key: "waiting_on", header: "📤 Waiting On" },
    { key: "inbox",      header: "📥 Inbox" },
    { key: "someday",    header: "✦ Someday" }
  ];

  groups.forEach(function (group) {
    var items = tasks.filter(function (t) { return t && t.list === group.key; });
    if (!items.length) return;

    var section = CardService.newCardSection().setHeader(group.header);

    items.forEach(function (t) {
      section.addWidget(CardService.newTextParagraph().setText(formatTaskText_(t)));
    });

    card.addSection(section);
  });

  // Footer section with the Send button.
  var footer = CardService.newCardSection().addWidget(
    CardService.newTextButton()
      .setText("Send to Reminders")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName("onSendTasksToReminders")
          .setParameters({ tasks: JSON.stringify(tasks) })
      )
  );
  card.addSection(footer);

  return card.build();
}

function formatTaskText_(t) {
  var lines = [];
  lines.push("<b>" + escapeHtml_(t.title || "(untitled)") + "</b>");

  var meta = [];
  if (t.priority) meta.push("Priority: " + capitalize_(t.priority));
  if (t.due)      meta.push("Due: " + t.due);
  if (t.person)   meta.push("→ " + t.person);
  if (meta.length) lines.push(meta.join("  |  "));

  if (t.context) lines.push(escapeHtml_(t.context));

  return lines.join("\n");
}

function capitalize_(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================================================================
 * Header / address parsing helpers
 * ========================================================================= */

function parseFromHeader_(from) {
  var emailMatch = (from || '').match(/<([^>]+)>/);
  var email = emailMatch ? emailMatch[1] : (from || '').trim();
  var name = null;

  if (emailMatch) {
    name = (from || '').replace(/<[^>]+>/, '').trim();
    name = name.replace(/^["']|["']$/g, '').trim();
  }

  return {
    email: (email || '').toLowerCase(),
    name: name || null
  };
}

function parseAddresses_(addresses) {
  if (!addresses) return [];
  return String(addresses)
    .split(',')
    .map(function (addr) {
      addr = (addr || '').trim();
      var match = addr.match(/<([^>]+)>/);
      return (match ? match[1] : addr).toLowerCase().trim();
    })
    .filter(function (addr) { return addr.length > 0; });
}

function headersToMap_(headers) {
  var map = {};
  (headers || []).forEach(function (h) {
    if (h && h.name) map[String(h.name).toLowerCase()] = h.value || "";
  });
  return map;
}

/* =========================================================================
 * Gmail message fetch + plain-text extraction
 * ========================================================================= */

function fetchGmailMessage_(accessToken, messageId) {
  var url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/" + encodeURIComponent(messageId) + "?format=full";
  var res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + accessToken },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Gmail API " + code + ": " + truncate_(text, 200));
  }
  return JSON.parse(text);
}

function extractPlainText_(payload) {
  if (!payload) return "";

  function decode(b64) {
    if (!b64) return "";
    try {
      var bytes = Utilities.base64DecodeWebSafe(b64);
      return Utilities.newBlob(bytes).getDataAsString();
    } catch (err) {
      return "";
    }
  }

  // Direct body
  if (payload.mimeType === "text/plain" && payload.body && payload.body.data) {
    return decode(payload.body.data);
  }

  // Walk parts: prefer text/plain, fall back to text/html stripped.
  var plain = "";
  var html = "";
  function walk(parts) {
    (parts || []).forEach(function (p) {
      if (!p) return;
      if (p.mimeType === "text/plain" && p.body && p.body.data) {
        plain += (plain ? "\n" : "") + decode(p.body.data);
      } else if (p.mimeType === "text/html" && p.body && p.body.data) {
        html += (html ? "\n" : "") + decode(p.body.data);
      }
      if (p.parts && p.parts.length) walk(p.parts);
    });
  }
  walk(payload.parts);

  if (plain) return plain;
  if (html) return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

/* =========================================================================
 * Cards: result, message, config-missing, error
 * ========================================================================= */

function buildMessageCard_(messageData) {
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      "<b>From:</b> " + escapeHtml_(messageData.from && messageData.from.email || "(unknown)")
    ))
    .addWidget(CardService.newTextParagraph().setText(
      "<b>Subject:</b> " + escapeHtml_(messageData.subject || "")
    ));

  if (messageData.snippet) {
    section.addWidget(CardService.newTextParagraph().setText(escapeHtml_(messageData.snippet)));
  }

  var messageDataStr = JSON.stringify(messageData);

  function btn(label, fn) {
    return CardService.newTextButton()
      .setText(label)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName(fn)
          .setParameters({ messageData: messageDataStr })
      );
  }

  var actions = CardService.newCardSection()
    .addWidget(btn("Send to Inbox Review", "onSendToInboxReview"))
    .addWidget(btn("Review & Create Opportunity", "onReviewAndCreateOpportunity"))
    .addWidget(btn("Create Opportunity", "onCreateOpportunity"))
    .addWidget(btn("Log Activity Only", "onLogActivityOnly"))
    .addWidget(btn("Create Company Only", "onCreateCompanyOnly"))
    .addWidget(btn("Extract Personal Tasks", "onExtractPersonalTasks"));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Hive OS"))
    .addSection(section)
    .addSection(actions)
    .build();
}

function renderResultCard_(parsed, payload) {
  var section = CardService.newCardSection();
  var msg = parsed && parsed.message
    ? parsed.message
    : (parsed && parsed.ok ? "Sent to Hive OS." : "Done.");
  section.addWidget(CardService.newTextParagraph().setText(escapeHtml_(msg)));

  if (parsed && parsed.url) {
    section.addWidget(
      CardService.newTextButton()
        .setText("Open in Hive OS")
        .setOpenLink(CardService.newOpenLink().setUrl(parsed.url))
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Hive OS"))
    .addSection(section)
    .build();
}

function buildConfigMissingCard_() {
  var section = CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText(
      "Missing <b>HIVE_API_URL</b> or <b>HIVE_INBOUND_SECRET</b> in Script Properties."
    )
  );
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Hive OS — Configuration"))
    .addSection(section)
    .build();
}

function buildErrorCard_(message) {
  var section = CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText("⚠️ " + escapeHtml_(message || "Unknown error"))
  );
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Hive OS — Error"))
    .addSection(section)
    .build();
}

function notify_(e, message) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(message))
    .build();
}

/* =========================================================================
 * Config + misc helpers
 * ========================================================================= */

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var apiUrl = (props.getProperty('HIVE_API_URL') || '').trim();

  var secret = (props.getProperty('HIVE_INBOUND_SECRET') || '').trim();
  if (!secret) {
    secret = (props.getProperty('HIVE_INBOUND_EMAIL_SECRET') || '').trim();
  }

  return { apiUrl: apiUrl, secret: secret };
}

function truncate_(s, n) {
  s = String(s || "");
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
