export interface PaginationQuery {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class PaginationUtil {
  static getPagination(
    page: number = 1,
    limit: number = 10,
    maxLimit: number = 100,
  ): PaginationQuery {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), maxLimit);
    const skip = (validPage - 1) * validLimit;

    return {
      page: validPage,
      limit: validLimit,
      skip,
    };
  }

  static getMeta(page: number, limit: number, total: number): PaginationMeta {
    const pages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      pages,
      hasNext: page < pages,
      hasPrev: page > 1,
    };
  }
}

export default PaginationUtil;
