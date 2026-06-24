import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/audit-log.model';

export const logAudit = async (
  req: Request | null,
  scope: string,
  module: string,
  key: string,
  logMessage: string
) => {
  try {
    let userId: string | null = null;
    let actionBy = 'System';
    let role = 'System';
    let ipAddress = '127.0.0.1';
    let userAgent = 'Unknown';
    let device = 'Desktop';
    let location = 'Unknown';

    if (req) {
      if (req.user) {
        const u = req.user as any;
        userId = u.id;
        actionBy = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'User';
        role = u.role || u.role_name || 'User';
      }

      // Extract IP address
      const xForwardedFor = req.headers['x-forwarded-for'] as string;
      if (xForwardedFor) {
        ipAddress = xForwardedFor.split(',')[0].trim();
      } else {
        ipAddress = req.socket.remoteAddress || '127.0.0.1';
      }
      
      // Clean localhost loopback addresses
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        ipAddress = '127.0.0.1';
      }

      // Extract User Agent
      userAgent = req.headers['user-agent'] || 'Unknown';
      
      // Parse device type from User Agent
      if (/mobile|android|iphone|ipad/i.test(userAgent)) {
        device = 'Mobile';
      } else if (/tablet/i.test(userAgent)) {
        device = 'Tablet';
      } else {
        device = 'Desktop';
      }

      // Resolve Location using Vercel IP headers, or fallback to geolocation API
      const vercelCountry = req.headers['x-vercel-ip-country'] as string;
      const vercelCity = req.headers['x-vercel-ip-city'] as string;
      
      if (vercelCountry) {
        const decodedCity = vercelCity ? decodeURIComponent(vercelCity) : '';
        location = decodedCity ? `${decodedCity}, ${vercelCountry}` : vercelCountry;
      } else if (ipAddress === '127.0.0.1') {
        location = 'Localhost';
      } else {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000); // 1-second timeout
          const response = await fetch(`http://ip-api.com/json/${ipAddress}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            const data: any = await response.json();
            if (data && data.status === 'success') {
              location = [data.city, data.regionName, data.countryCode].filter(Boolean).join(', ');
            }
          }
        } catch (e) {
          location = 'Unknown';
        }
      }
    }

    await AuditLog.create({
      user: userId ? new Types.ObjectId(userId) : undefined,
      actionBy,
      role,
      scope,
      module,
      key,
      log: logMessage,
      ipAddress,
      userAgent,
      device,
      location,
      transactionDate: new Date()
    });
  } catch (error) {
    console.error('Failed to log audit activity:', error);
  }
};
