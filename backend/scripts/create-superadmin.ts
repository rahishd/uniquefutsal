/**
 * Create SuperAdmin Script
 * 
 * Usage:
 *   npx ts-node scripts/create-superadmin.ts
 * 
 * Or with environment variables:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass 
 * npx ts-node scripts/create-superadmin.ts
 */

import dotenv from "dotenv";
import readline from "readline";
import bcryptjs from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const bcrypt = bcryptjs;

dotenv.config(); 


const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log("\n========================================");
  console.log("  UniqueFutsal SuperAdmin Creator");
  console.log("========================================\n");

  // Get credentials from env or prompt
  let email = process.env.ADMIN_EMAIL || "";
  let password = process.env.ADMIN_PASSWORD || "";
  let name = process.env.ADMIN_NAME || "";

  if (!email) {
    email = await question("Enter admin email: ");
  }
  if (!password) {
    password = await question("Enter admin password (min 6 chars): ");
  }
  if (!name) {
    name = await question("Enter admin name (optional): ");
  }

  // Validate
  if (!email || !email.includes("@")) {
    console.error("\n❌ Invalid email address");
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error("\n❌ Password must be at least 6 characters");
    process.exit(1);
  }

  // Check if admin already exists
  const existing = await prisma.superAdmin.findUnique({
    where: { email }
  });

  if (existing) {
    const update = await question("\n⚠️  Admin with this email already exists. Update password? (y/n): ");
    if (update.toLowerCase() === "y") {
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.superAdmin.update({
        where: { email },
        data: { 
          password: hashedPassword,
          name: name || existing.name,
          updatedAt: new Date()
        }
      });
      console.log("\n✅ SuperAdmin password updated!");
    } else {
      console.log("\n❌ Cancelled.");
    }
  } else {
    // Create new admin
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const admin = await prisma.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        isActive: true
      }
    });

    console.log("\n✅ SuperAdmin created successfully!");
    console.log("\n   ID:    " + admin.id);
    console.log("   Email: " + admin.email);
    console.log("   Name:  " + (admin.name || "(not set)"));
  }

  console.log("\n========================================\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    rl.close();
  });
