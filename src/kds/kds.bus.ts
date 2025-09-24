import { Injectable, OnModuleDestroy, MessageEvent } from "@nestjs/common";
import { Observable, Subject, filter, map, merge, interval, of } from "rxjs";
import { PrepStation } from "@prisma/client";

type KdsEvent =
  | {
      type: "item.fired";
      tenantId: string;
      orderId: string;
      itemId: string;
      station: PrepStation;
      at: string;
    }
  | {
      type: "item.closed";
      tenantId: string;
      orderId: string;
      itemId: string;
      station: PrepStation;
      at: string;
    }
  | {
      type: "ticket.bumped";
      tenantId: string;
      orderId: string;
      affected: number;
      at: string;
    }
  | {
      type: "ticket.recalled";
      tenantId: string;
      orderId: string;
      affected: number;
      at: string;
    };

@Injectable()
export class KdsBus implements OnModuleDestroy {
  private readonly bus = new Subject<KdsEvent>();

  onModuleDestroy() {
    this.bus.complete();
  }

  publish(evt: KdsEvent) {
    this.bus.next(evt);
  }

  /** Stream SSE por tenant; se station for informada, filtra também por estação. */
  stream(tenantId: string, station?: PrepStation): Observable<MessageEvent> {
    const data$ = this.bus.pipe(
      filter((e) => e.tenantId === tenantId),
      filter((e) =>
        !station
          ? true
          : ("station" in e && (e as any).station === station) || !("station" in e)
      ),
      // 👇 Não setamos MessageEvent.type (para cair no canal "message")
      //    e mantemos `type` dentro de `data` (como o teste espera).
      map((e) => ({ data: e } as MessageEvent))
    );

    // heartbeat a cada 15s, como mensagem "ping" no canal "message"
    const ping$ = interval(15000).pipe(
      map(() => ({ data: { type: "ping", ts: Date.now() } } as MessageEvent))
    );

    // ready imediato (primeira mensagem) para eliminar race na abertura
    const ready$ = of({ data: { type: "ready", ts: Date.now() } } as MessageEvent);

    return merge(ready$, ping$, data$);
  }
}
