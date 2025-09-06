"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presentEndpoint = presentEndpoint;
// src/webhooks/presenter.ts
function presentEndpoint(e) {
    const secret = e.secret ? `${'*'.repeat(Math.max(0, e.secret.length - 4))}${e.secret.slice(-4)}` : '';
    return { ...e, secret };
}
