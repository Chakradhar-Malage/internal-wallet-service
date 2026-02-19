    // src/config/knex.js
const knex = require('knex');
require('dotenv').config();

const config = require('../../knexfile').development;

module.exports = knex(config);