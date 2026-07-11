import { Repository, ObjectLiteral } from 'typeorm';

/**
 * 创建一个基本的 Mock Repository，覆盖 TypeORM Repository 的常用方法。
 * 各方法默认使用 jest.fn()，测试中可通过 mockReturnValue / mockResolvedValue 覆盖。
 */
export function createMockRepo<T extends ObjectLiteral>(
  overrides?: Partial<Record<keyof Repository<T>, jest.Mock>>,
): Record<string, jest.Mock> {
  const base = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    insert: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    manager: {
      connection: {
        createQueryRunner: jest.fn(),
      },
    } as any,
  };
  return { ...base, ...overrides };
}

/**
 * 通用的 QueryBuilder mock，支持链式调用。
 */
export function createMockQueryBuilder(): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {};
  const chainMethods = [
    'leftJoinAndSelect', 'innerJoinAndSelect',
    'where', 'andWhere', 'orWhere',
    'orderBy', 'addOrderBy',
    'groupBy', 'addGroupBy',
    'having', 'andHaving',
    'skip', 'take', 'limit', 'offset',
    'select', 'addSelect',
    'from', 'innerJoin',
  ];
  for (const method of chainMethods) {
    qb[method] = jest.fn().mockReturnThis();
  }
  qb.getMany = jest.fn();
  qb.getOne = jest.fn();
  qb.getRawMany = jest.fn();
  qb.getRawOne = jest.fn();
  qb.getCount = jest.fn();
  qb.getQuery = jest.fn();
  qb.execute = jest.fn();
  return qb;
}

/**
 * 模拟 QueryRunner (用于事务测试)
 */
export function createMockQueryRunner(): Record<string, jest.Mock> {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as any,
  };
}

/**
 * 模拟 EventEmitter2
 */
export function createMockEventEmitter(): Record<string, jest.Mock> {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
  };
}

/**
 * 模拟 JwtService
 */
export function createMockJwtService(): Record<string, jest.Mock> {
  return {
    sign: jest.fn(() => 'mock-token'),
    verify: jest.fn(),
    decode: jest.fn(),
  };
}
