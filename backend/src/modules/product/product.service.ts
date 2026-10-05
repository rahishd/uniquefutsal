import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { CreateProductDTO, UpdateProductDTO, ProductResponse } from "./product.dto";
import logger from "../../config/logger";

export class ProductService {
  async getAllProducts(categoryId?: string): Promise<ProductResponse[]> {
    try {
      const where = categoryId ? { categoryId } : {};
      return await prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      logger.error("Error fetching products:", error);
      throw new AppError(500, "Failed to fetch products");
    }
  }

  async getProductById(id: string): Promise<ProductResponse> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      throw new AppError(404, "Product not found");
    }

    return product;
  }

  async createProduct(dto: CreateProductDTO): Promise<ProductResponse> {
    try {
      return await prisma.product.create({
        data: {
          name: dto.name,
          description: dto.description,
          price: dto.price,
          categoryId: dto.categoryId,
          inventory: dto.inventory ?? 0,
          unit: dto.unit ?? "pcs",
          lowStockThreshold: dto.lowStockThreshold ?? 10,
          costPrice: dto.costPrice ?? 0,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error("Error creating product:", error);
      throw new AppError(500, "Failed to create product");
    }
  }

  async updateProduct(id: string, dto: UpdateProductDTO): Promise<ProductResponse> {
    try {
      return await prisma.product.update({
        where: { id },
        data: {
          ...dto,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error("Error updating product:", error);
      throw new AppError(500, "Failed to update product");
    }
  }

  async adjustStock(id: string, amount: number, reason?: string, price?: number, cashAmount?: number, onlineAmount?: number): Promise<ProductResponse> {
    try {
      const product = await this.getProductById(id);
      const newInventory = Math.max(0, product.inventory + amount);

      // Perform update and logging in a transaction
      const [updatedProduct] = await prisma.$transaction([
        prisma.product.update({
          where: { id },
          data: {
            inventory: newInventory,
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        (prisma as any).inventoryLog.create({
          data: {
            productId: id,
            change: amount,
            price: price,
            reason: reason || (amount < 0 ? "Manual Deduction" : "Manual Addition"),
            cashAmount: cashAmount || 0,
            onlineAmount: onlineAmount || 0,
          },
        }),
      ]);

      return updatedProduct;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error adjusting stock:", error);
      throw new AppError(500, "Failed to adjust stock");
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      await prisma.product.delete({
        where: { id },
      });
    } catch (error) {
      logger.error("Error deleting product:", error);
      throw new AppError(500, "Failed to delete product");
    }
  }

  async getInventoryLogs(): Promise<any[]> {
    try {
      return await (prisma as any).inventoryLog.findMany({
        take: 100,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          product: {
            select: {
              name: true,
              unit: true,
              costPrice: true,
            }
          }
        }
      });
    } catch (error) {
      logger.error("Error fetching inventory logs:", error);
      throw new AppError(500, "Failed to fetch inventory logs");
    }
  }
}

export default new ProductService();
