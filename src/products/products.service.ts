import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductsService {
  findAll() {
    return [{ id: 1, name: 'Produto Teste' }];
  }
}
