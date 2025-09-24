"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KdsBus = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let KdsBus = class KdsBus {
    constructor() {
        this.bus = new rxjs_1.Subject();
    }
    onModuleDestroy() {
        this.bus.complete();
    }
    publish(evt) {
        this.bus.next(evt);
    }
    /** Stream SSE por tenant; se station for informada, filtra também por estação. */
    stream(tenantId, station) {
        const data$ = this.bus.pipe((0, rxjs_1.filter)((e) => e.tenantId === tenantId), (0, rxjs_1.filter)((e) => !station
            ? true
            : ("station" in e && e.station === station) || !("station" in e)), 
        // 👇 Não setamos MessageEvent.type (para cair no canal "message")
        //    e mantemos `type` dentro de `data` (como o teste espera).
        (0, rxjs_1.map)((e) => ({ data: e })));
        // heartbeat a cada 15s, como mensagem "ping" no canal "message"
        const ping$ = (0, rxjs_1.interval)(15000).pipe((0, rxjs_1.map)(() => ({ data: { type: "ping", ts: Date.now() } })));
        // ready imediato (primeira mensagem) para eliminar race na abertura
        const ready$ = (0, rxjs_1.of)({ data: { type: "ready", ts: Date.now() } });
        return (0, rxjs_1.merge)(ready$, ping$, data$);
    }
};
exports.KdsBus = KdsBus;
exports.KdsBus = KdsBus = __decorate([
    (0, common_1.Injectable)()
], KdsBus);
