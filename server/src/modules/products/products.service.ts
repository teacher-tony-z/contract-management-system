import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}

  findAll(status?: string) {
    const where: any = {};
    if (status !== undefined) where.status = Number(status);
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  findOne(id: number) {
    return this.repo.findOneByOrFail({ id }).catch(() => { throw new NotFoundException('产品不存在'); });
  }

  create(dto: CreateProductDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateProductDto) {
    const product = await this.repo.findOneBy({ id });
    if (!product) throw new NotFoundException('产品不存在');
    Object.assign(product, dto);
    return this.repo.save(product);
  }
}
