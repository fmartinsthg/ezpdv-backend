import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const res = ctx.switchToHttp().getResponse();
    return next.handle().pipe(
      tap((body) => {
        const v =
          (body?.version ?? body?.order?.version ?? null);
        if (Number.isInteger(v)) {
          res.setHeader('ETag', `W/"${v}"`);
        }
      }),
    );
  }
}