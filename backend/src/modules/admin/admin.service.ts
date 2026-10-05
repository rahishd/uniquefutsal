import bcrypt from "bcryptjs";
import { prisma } from "../../config/db";
import { JwtUtil } from "../../utils/jwt";

class AdminService {
  // Validate admin credentials against database
  async login(email: string, password: string) {
    // Find admin in database
    const admin = await prisma.superAdmin.findUnique({
      where: { email }
    });

    if (!admin) {
      throw new Error("Invalid credentials");
    }

    if (!admin.isActive) {
      throw new Error("Account is disabled");
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Update last login time
    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate admin token (use same signing/verification as authMiddleware)
    const token = JwtUtil.sign({
      id: admin.id,
      email: admin.email,
      role: "superadmin",
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: "superadmin"
      }
    };
  }

  // Verify admin token
  verifyToken(token: string) {
    try {
      const decoded = JwtUtil.verify(token) as unknown as {
        id: string;
        email: string;
        role: string;
      };

      if (decoded.role !== "superadmin") {
        throw new Error("Invalid admin token");
      }

      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  // Get admin info from token
  async getAdminInfo(token: string) {
    const decoded = this.verifyToken(token);
    
    // Verify admin still exists and is active
    const admin = await prisma.superAdmin.findUnique({
      where: { id: decoded.id }
    });

    if (!admin || !admin.isActive) {
      throw new Error("Admin not found or disabled");
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "superadmin"
    };
  }

  // Change admin password
  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: adminId }
    });

    if (!admin) {
      throw new Error("Admin not found");
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.superAdmin.update({
      where: { id: adminId },
      data: { password: hashedPassword }
    });

    return { success: true };
  }
}

export default new AdminService();
