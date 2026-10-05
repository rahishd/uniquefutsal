import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { CreateCategoryDTO, UpdateCategoryDTO, CategoryResponse } from "./category.dto";
import logger from "../../config/logger";

export class CategoryService {
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-");
  }

  async getAllCategories(): Promise<CategoryResponse[]> {
    try {
      return await prisma.category.findMany({
        orderBy: { name: "asc" },
      });
    } catch (error) {
      logger.error("Error fetching categories:", error);
      throw new AppError(500, "Failed to fetch categories");
    }
  }

  async getCategoryById(id: string): Promise<CategoryResponse> {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new AppError(404, "Category not found");
    }

    return category;
  }

  async createCategory(dto: CreateCategoryDTO): Promise<CategoryResponse> {
    try {
      const slug = this.slugify(dto.name);

      // Check if category with slug already exists
      const existing = await prisma.category.findUnique({
        where: { slug },
      });

      if (existing) {
        throw new AppError(400, "Category with this name already exists");
      }

      return await prisma.category.create({
        data: {
          name: dto.name,
          slug,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error creating category:", error);
      throw new AppError(500, "Failed to create category");
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDTO): Promise<CategoryResponse> {
    try {
      const data: any = { ...dto };
      if (dto.name) {
        data.slug = this.slugify(dto.name);
      }

      return await prisma.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error("Error updating category:", error);
      throw new AppError(500, "Failed to update category");
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      // Check if category has products
      const productsCount = await prisma.product.count({
        where: { categoryId: id },
      });

      if (productsCount > 0) {
        throw new AppError(400, "Cannot delete category with associated products");
      }

      await prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Error deleting category:", error);
      throw new AppError(500, "Failed to delete category");
    }
  }
}

export default new CategoryService();
