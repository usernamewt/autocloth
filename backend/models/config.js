const path = require('path');

const SAVE_DIR = path.join(__dirname, '..', 'downloads');

function getBackendBaseUrl() {
  return (process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

module.exports = { SAVE_DIR, getBackendBaseUrl };
