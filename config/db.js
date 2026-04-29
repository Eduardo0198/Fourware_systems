require('dotenv').config();
const dns = require('dns');
const { Pool, types } = require('pg');
const logger = require('../utils/logger');

dns.setDefaultResultOrder('ipv4first');

types.setTypeParser(1082, (val) => val);
types.setTypeParser(1114, (val) => val);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

function convertirPlaceholders(sql) {
    let idx = 0;
    let resultado = '';
    let enStringSimple = false;
    let enStringDoble = false;
    let enComentarioLinea = false;
    let enComentarioBloque = false;

    for (let i = 0; i < sql.length; i += 1) {
        const actual = sql[i];
        const siguiente = sql[i + 1];

        if (enComentarioLinea) {
            resultado += actual;
            if (actual === '\n') {
                enComentarioLinea = false;
            }
            continue;
        }

        if (enComentarioBloque) {
            resultado += actual;
            if (actual === '*' && siguiente === '/') {
                resultado += siguiente;
                i += 1;
                enComentarioBloque = false;
            }
            continue;
        }

        if (enStringSimple) {
            resultado += actual;
            if (actual === '\'' && siguiente === '\'') {
                resultado += siguiente;
                i += 1;
                continue;
            }
            if (actual === '\'') {
                enStringSimple = false;
            }
            continue;
        }

        if (enStringDoble) {
            resultado += actual;
            if (actual === '"') {
                enStringDoble = false;
            }
            continue;
        }

        if (actual === '-' && siguiente === '-') {
            resultado += actual + siguiente;
            i += 1;
            enComentarioLinea = true;
            continue;
        }

        if (actual === '/' && siguiente === '*') {
            resultado += actual + siguiente;
            i += 1;
            enComentarioBloque = true;
            continue;
        }

        if (actual === '\'') {
            resultado += actual;
            enStringSimple = true;
            continue;
        }

        if (actual === '"') {
            resultado += actual;
            enStringDoble = true;
            continue;
        }

        if (actual === '?') {
            idx += 1;
            resultado += `$${idx}`;
            continue;
        }

        resultado += actual;
    }

    return {
        sql: resultado,
        totalPlaceholders: idx
    };
}

pool.on('connect', () => {
    logger.info('Conectado a PostgreSQL (Supabase)');
});

pool.on('error', (err) => {
    logger.error('Error en pool de PostgreSQL:', err.message);
});

const db = {
    query(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        const conversion = convertirPlaceholders(sql);
        const pgSql = conversion.sql;
        const normalizedParams = params || [];

        if (conversion.totalPlaceholders !== normalizedParams.length) {
            logger.error({
                message: 'Cantidad de placeholders distinta al numero de parametros',
                query: pgSql,
                placeholderCount: conversion.totalPlaceholders,
                params: normalizedParams
            });
        }

        pool.query(pgSql, normalizedParams, (err, result) => {
            if (err) {
                logger.error({
                    message: 'Error al ejecutar consulta PostgreSQL',
                    query: pgSql,
                    params: normalizedParams,
                    pgCode: err.code,
                    pgMessage: err.message
                });
                return callback(err);
            }

            const rows = result.rows || [];
            rows.affectedRows = result.rowCount || 0;
            callback(null, rows);
        });
    },

    connect(callback) {
        pool.connect(callback);
    }
};

module.exports = db;
