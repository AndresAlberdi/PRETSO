const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Since we just need an ID token, we can use the REST API with a custom token
const axios = require('axios');

async function test() {
  const serviceAccount = require('../backend/service-account.json');
  
  // Actually, we can use firebase REST api to exchange custom token for ID token
  // but we need an API key
}

test();
