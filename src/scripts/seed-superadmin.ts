import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { connectDatabase } from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { Company } from '../models/company.model';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';

const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
const SUPERADMIN_PASSWORD = 'superadmin123';
const SUPERADMIN_COMPANY_CODE = 'DEV-HUB';

const seed = async () => {
  await connectDatabase();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let company = await Company.findOne({ code: SUPERADMIN_COMPANY_CODE }).session(session);
    if (!company) {
      company = await Company.create(
        [
          {
            name: 'Developer Hub',
            code: SUPERADMIN_COMPANY_CODE,
            currency: 'INR'
          }
        ],
        { session }
      ).then((docs) => docs[0]);
      logger.info('Created developer company for superadmin');
    }

    if (!company) {
      throw new Error('Failed to initialize company for super admin seeding');
    }

    let role = await Role.findOne({ company: company._id, name: 'Super Admin' }).session(session);
    if (!role) {
      role = await Role.create(
        [
          {
            company: company._id,
            name: 'Super Admin',
            description: 'Developer-only role with full access',
            permissions: ['*'],
            isActive: true
          }
        ],
        { session }
      ).then((docs) => docs[0]);
      logger.info('Created Super Admin role');
    } else {
      role.permissions = ['*'];
      role.isActive = true;
      await role.save({ session });
    }

    if (!role) {
      throw new Error('Failed to initialize role for super admin seeding');
    }

    let user = await User.findOne({ email: SUPERADMIN_EMAIL }).session(session);
    if (!user) {
      const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, config.password.saltRounds);
      user = await User.create(
        [
          {
            company: company._id,
            firstName: 'Super',
            lastName: 'Admin',
            email: SUPERADMIN_EMAIL,
            passwordHash,
            role: 'superadmin',
            status: 'active',
            isActive: true
          }
        ],
        { session }
      ).then((docs) => docs[0]);
      logger.info('Created Super Admin user');
    } else {
      user.firstName = 'Super';
      user.lastName = 'Admin';
      user.company = company._id;
      user.role = 'superadmin';
      user.status = 'active';
      user.isActive = true;
      await user.save({ session });
      logger.info('Updated existing Super Admin user');
    }

    await session.commitTransaction();
    logger.info('Super Admin seed completed successfully');
  } catch (error) {
    await session.abortTransaction();
    logger.error({ error }, 'Failed to seed Super Admin');
    process.exitCode = 1;
  } finally {
    session.endSession();
    await mongoose.disconnect();
  }
};

seed();

