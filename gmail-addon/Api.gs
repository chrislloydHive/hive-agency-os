/**
 * Hive OS Gmail Add-on - API Functions
 *
 * Functions for communicating with the Hive OS API.
 */

/**
 * Get configuration from Script Properties
 * @returns {Object} Configuration object with apiUrl and secret
 */
function getConfig() {
  var props = PropertiesService.getScriptProperties();

  return {
    apiUrl: props.getProperty('HIVE_API_URL') || '',
    secret: props.getProperty('HIVE_INBOUND_EMAIL_SECRET') || ''
  };
}

/**
 * Call the Hive OS inbound email API
 * @param {Object} payload - Email data to send
 * @returns {Object} API response
 */
function callHiveApi(payload) {
  var config = getConfig();

  if (!config.apiUrl || !config.secret) {
    throw new Error('Hive OS configuration not set. Please configure Script Properties.');
  }

  var url = config.apiUrl.replace(/\/$/, '') + '/api/os/inbound/gmail';

  Logger.log('Calling Hive API: ' + url);

  var options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'X-Hive-Secret': config.secret
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log('API Response (' + responseCode + '): ' + responseText);

    if (responseCode === 401) {
      throw new Error('Authentication failed. Please check your HIVE_INBOUND_EMAIL_SECRET.');
    }

    if (responseCode >= 400) {
      var errorData = JSON.parse(responseText);
      throw new Error(errorData.message || 'API error: ' + responseCode);
    }

    return JSON.parse(responseText);
  } catch (error) {
    Logger.log('API Error: ' + error.message);

    // Re-throw with more context if it's a network error
    if (error.message.indexOf('fetch') !== -1 || error.message.indexOf('connect') !== -1) {
      throw new Error('Could not connect to Hive OS. Please check your HIVE_API_URL.');
    }

    throw error;
  }
}

/**
 * Call the Hive OS company-only API
 * @param {Object} payload - Email data to send
 * @returns {Object} API response
 */
function callHiveCompanyApi(payload) {
  var config = getConfig();

  if (!config.apiUrl || !config.secret) {
    throw new Error('Hive OS configuration not set. Please configure Script Properties.');
  }

  var url = config.apiUrl.replace(/\/$/, '') + '/api/os/inbound/gmail/company';

  Logger.log('Calling Hive Company API: ' + url);

  var options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'X-Hive-Secret': config.secret
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log('Company API Response (' + responseCode + '): ' + responseText);

    if (responseCode === 401) {
      throw new Error('Authentication failed. Please check your HIVE_INBOUND_EMAIL_SECRET.');
    }

    if (responseCode >= 400) {
      var errorData = JSON.parse(responseText);
      throw new Error(errorData.message || 'API error: ' + responseCode);
    }

    return JSON.parse(responseText);
  } catch (error) {
    Logger.log('Company API Error: ' + error.message);

    if (error.message.indexOf('fetch') !== -1 || error.message.indexOf('connect') !== -1) {
      throw new Error('Could not connect to Hive OS. Please check your HIVE_API_URL.');
    }

    throw error;
  }
}

/**
 * Test the API configuration (for debugging)
 * @returns {Object} Test result
 */
function testApiConfig() {
  var config = getConfig();

  Logger.log('API URL: ' + (config.apiUrl || '(not set)'));
  Logger.log('Secret: ' + (config.secret ? '(set, ' + config.secret.length + ' chars)' : '(not set)'));

  if (!config.apiUrl || !config.secret) {
    return {
      success: false,
      message: 'Configuration incomplete. Set HIVE_API_URL and HIVE_INBOUND_EMAIL_SECRET in Script Properties.'
    };
  }

  // Try to ping the API
  try {
    var url = config.apiUrl.replace(/\/$/, '') + '/api/health';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    return {
      success: true,
      message: 'Configuration looks good. API responded with: ' + response.getResponseCode()
    };
  } catch (error) {
    return {
      success: false,
      message: 'Could not reach API: ' + error.message
    };
  }
}
