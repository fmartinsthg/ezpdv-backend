"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJsonStringify = canonicalJsonStringify;
exports.sha256Hex = sha256Hex;
exports.isUuidV4 = isUuidV4;
const crypto_1 = require("crypto");
/** Ordena chaves recursivamente e serializa de forma determinística */
function canonicalJsonStringify(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        const obj = {};
        for (const k of keys) {
            const v = value[k];
            // Remover nulls redundantes (opcional: ajuste conforme semântica)
            if (v === undefined)
                continue;
            obj[k] = sortValue(v);
        }
        return obj;
    }
    // Para números, apenas deixe como estão (se quiser, converta para string decimal)
    return value;
}
function sha256Hex(input) {
    return (0, crypto_1.createHash)('sha256').update(input, 'utf8').digest('hex');
}
function isUuidV4(str) {
    if (!str)
        return false;
    // UUID v4 (simplificada)
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}
