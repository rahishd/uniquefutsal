import bcrypt from "bcryptjs";

export class HashUtil {
  static async hash(password: string, rounds: number = 10): Promise<string> {
    return bcrypt.hash(password, rounds);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static isHashed(str: string): boolean {
    // bcrypt hashes start with $2a$, $2b$, or $2y$
    return /^\$2[aby]\$\d+\$/.test(str);
  }
}

export default HashUtil;
