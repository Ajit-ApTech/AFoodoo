import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebase';

export interface AdminRequest extends Request {
  adminUser?: {
    uid: string;
    email?: string;
    role: 'super_admin' | 'kitchen_staff' | 'delivery_manager';
  };
}

export function requireAdminRole(
  allowedRoles: ('super_admin' | 'kitchen_staff' | 'delivery_manager')[] = [
    'super_admin',
    'kitchen_staff',
    'delivery_manager',
  ]
) {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Development / Demo fallback if auth header not passed
      req.adminUser = {
        uid: 'super-admin-seed-id',
        email: 'admin@afoodoo.com',
        role: 'super_admin',
      };
      return next();
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      if (adminAuth) {
        const decodedToken = await adminAuth.verifyIdToken(token);
        const role = (decodedToken.role as any) || 'super_admin';
        if (!allowedRoles.includes(role)) {
          return res
            .status(403)
            .json({ error: `Forbidden: Requires role in [${allowedRoles.join(', ')}]` });
        }
        req.adminUser = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          role,
        };
      } else {
        req.adminUser = {
          uid: 'super-admin-seed-id',
          email: 'admin@afoodoo.com',
          role: 'super_admin',
        };
      }
      next();
    } catch (e: any) {
      // Fail-safe dev fallback
      req.adminUser = {
        uid: 'super-admin-seed-id',
        email: 'admin@afoodoo.com',
        role: 'super_admin',
      };
      next();
    }
  };
}
