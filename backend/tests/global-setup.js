const { execSync } = require("node:child_process");
module.exports = async () => {
  const url = "postgresql://unique:unique_dev_pw@localhost:5439/unique_test?schema=public";
  // never anything but the local test database
  if (!url.includes("localhost:5439/unique_test")) throw new Error("unsafe test database url");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
};
