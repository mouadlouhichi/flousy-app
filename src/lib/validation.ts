import { z } from 'zod';

export const moneyAmountSchema = z
  .number({ message: 'Amount must be a number' })
  .finite('Amount must be finite')
  .min(0, 'Amount cannot be negative')
  .max(1000000000, 'Amount exceeds maximum limit (1B)');

export const incomeSchema = z.object({
  income: moneyAmountSchema.refine((val) => val > 0, { message: 'Income must be greater than zero' }),
  currency: z.string().min(1, 'Currency is required'),
});

export const expenseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  type: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  place: z.enum(['bank', 'home', 'wallet'], { message: 'Money place is required' }),
  note: z.string().max(250, 'Note is too long').optional(),
});

export const fixedBillSchema = z.object({
  name: z.string().trim().min(1, 'Bill name is required').max(100, 'Name is too long'),
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  type: z.string().min(1, 'Category is required'),
  date: z.string().optional(),
  place: z.enum(['bank', 'home', 'wallet']),
});

export const moveMoneySchema = z
  .object({
    from: z.enum(['bank', 'home', 'wallet']),
    to: z.enum(['bank', 'home', 'wallet']),
    amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  })
  .refine((data) => data.from !== data.to, {
    message: 'Source and destination accounts must be different',
    path: ['to'],
  });

export const savingGoalSchema = z.object({
  name: z.string().trim().min(1, 'Goal name is required').max(100, 'Name is too long'),
  target: moneyAmountSchema.refine((val) => val > 0, { message: 'Target amount must be greater than zero' }),
  source: z.enum(['bank', 'home', 'wallet']),
  /** Amount already saved towards the goal before it was tracked here. */
  current: moneyAmountSchema.optional(),
});

/** Custom strategy split — whole percents that must add up to exactly 100. */
export const customStrategySchema = z
  .object({
    needs: z.number().finite().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
    wants: z.number().finite().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
    savings: z.number().finite().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100%'),
  })
  .refine((data) => Math.round(data.needs + data.wants + data.savings) === 100, {
    message: 'Needs, Wants and Savings must add up to 100%',
    path: ['needs'],
  });

export const fundGoalSchema = z.object({
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  sourcePlace: z.enum(['bank', 'home', 'wallet']),
});

export const withdrawGoalSchema = z.object({
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  targetPlace: z.enum(['bank', 'home', 'wallet']),
});

export const incomeSourceSchema = z.object({
  name: z.string().trim().min(1, 'Source name is required').max(60, 'Name is too long'),
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  // Optional salary pay day: 1–31, used as the monthly start date of the source.
  payDay: z
    .union([z.number().int().min(1).max(31), z.undefined()])
    .optional(),
});

export const authEmailSchema = z.string().email('Invalid email address');
export const authPasswordSchema = z.string().min(6, 'Password must be at least 6 characters');

export const loginSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export const customCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50, 'Category name is too long'),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format'),
  icon: z.string().min(1, 'Icon is required'),
});
