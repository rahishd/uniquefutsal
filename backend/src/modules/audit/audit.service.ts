import { prisma } from "../../config/db";

export class AuditService {
  static async log(params: {
    action: string;
    entity: string;
    entityId: string;
    changes?: string;
    userId?: string;
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          changes: params.changes || null,
          userId: params.userId || "system",
        },
      });
    } catch (error) {
      console.error("Failed to create audit log:", error);
    }
  }

  static async getLogs(filters: {
    page?: number;
    limit?: number;
    entity?: string;
    action?: string;
    search?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.entity) where.entity = filters.entity;
    if (filters.action) where.action = filters.action;

    if (filters.search) {
      // Find any users matching search to search by operator name/email
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phoneNumber: { contains: filters.search, mode: "insensitive" } },
          ],
        },
        select: { phoneNumber: true },
      });
      const userPhoneNumbers = matchingUsers.map((u) => u.phoneNumber);

      where.OR = [
        { action: { contains: filters.search, mode: "insensitive" } },
        { entity: { contains: filters.search, mode: "insensitive" } },
        { changes: { contains: filters.search, mode: "insensitive" } },
        { userId: { in: userPhoneNumbers } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    // Map operator details to each log
    const userIds = Array.from(
      new Set(items.map((item) => item.userId).filter(Boolean))
    ) as string[];
    
    const users = await prisma.user.findMany({
      where: { phoneNumber: { in: userIds } },
      select: {
        phoneNumber: true,
        name: true,
        email: true,
        role: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.phoneNumber, u]));
    const formattedItems = items.map((item) => {
      const u = item.userId ? userMap.get(item.userId) : null;
      return {
        id: item.id,
        action: item.action,
        entity: item.entity,
        entityId: item.entityId,
        changes: item.changes,
        userId: item.userId,
        user: u
          ? {
              id: u.phoneNumber,
              name: u.name,
              email: u.email || "",
              phoneNumber: u.phoneNumber,
              role: u.role,
            }
          : null,
        timestamp: item.createdAt.toISOString(),
      };
    });

    return {
      items: formattedItems,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  static async getFilters() {
    const [actions, entities] = await Promise.all([
      prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
      }),
      prisma.auditLog.findMany({
        distinct: ["entity"],
        select: { entity: true },
      }),
    ]);

    return {
      actions: actions.map((a) => a.action),
      entities: entities.map((e) => e.entity),
    };
  }
}

export default AuditService;
