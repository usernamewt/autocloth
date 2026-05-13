const mysql = require('mysql2/promise');
require('dotenv').config();

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '123456';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'wardrobe';

let dbPool;
async function getDb() {
  if (dbPool) return dbPool;
  dbPool = mysql.createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
  });
  return dbPool;
}

module.exports = { getDb };
