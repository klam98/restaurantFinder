require('dotenv').config();

module.exports = {

  development: {
    client     : process.env.DB_CLIENT,
    connection:{
      host: process.env.HOST,
      user: process.env.DB_USER,
      password : process.env.DB_PASS,
      database: process.env.DB_NAME
    },
    migrations: {
      directory: './db/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  },

  test: {
    client     : process.env.DB_CLIENT,
    connection:{
      host: process.env.HOST,
      user: process.env.DB_USER,
      password : process.env.DB_PASS,
      database: process.env.DB_NAME
    },
    migrations: {
      directory: '../db/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: '../db/seeds'
    }
  },

  production: {
    client     : 'pg',
    connection: process.env.DATABASE_URL + `?ssl=true`,
    migrations: {
      directory: './db/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './db/seeds'
    }
  }


};