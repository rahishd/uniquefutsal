import authMiddleware from "./auth.middleware";
import roleMiddleware from "./role.middleware";

// Staff-only routes: a valid token AND an admin role. Customers get 403.
export const ADMIN_ROLES = ["admin", "superadmin"];
export const adminOnly = [authMiddleware, roleMiddleware(ADMIN_ROLES)];

export default adminOnly;
