import { z } from 'zod';

export const moneyAmountSchema = z
  .number({ message: 'Amount must be a number' })
  .finite('Amount must be finite')
  .min(0, 'Amount cannot be negative')
  .max(1000000000, 'Amount exceeds maximum limit (1B)');

/**
 * How many rows a single month document may carry. `firestore.rules` pins the
 * same numbers for `variableExpenses` / `fixedExpenses`: a month that grows past
 * them is not merely large, it becomes permanently unwritable (the 1 MiB document
 * cap rejects every later save), which locks the user out of their own budget.
 * Import and paste paths must therefore clamp here, before the write is even
 * attempted, and tell the user what was dropped.
 */
export const MONTHLY_VARIABLE_EXPENSE_LIMIT = 2000;
export const MONTHLY_FIXED_EXPENSE_LIMIT = 500;

export const incomeSchema = z.object({
  income: moneyAmountSchema.refine((val) => val > 0, { message: 'Income must be greater than zero' }),
  currency: z.string().min(1, 'Currency is required'),
});

export const expenseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  type: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  place: z.string().min(1, 'Money place is required'),
  note: z.string().max(250, 'Note is too long').optional(),
});

export const fixedBillSchema = z.object({
  name: z.string().trim().min(1, 'Bill name is required').max(100, 'Name is too long'),
  amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  type: z.string().min(1, 'Category is required'),
  date: z.string().optional(),
  place: z.string().min(1, 'Money place is required'),
});

export const moveMoneySchema = z
  .object({
    from: z.string().min(1, 'Source is required'),
    to: z.string().min(1, 'Destination is required'),
    amount: moneyAmountSchema.refine((val) => val > 0, { message: 'Amount must be greater than zero' }),
  })
  .refine((data) => data.from !== data.to, {
    message: 'Source and destination accounts must be different',
    path: ['to'],
  });

export const savingGoalSchema = z.object({
  name: z.string().trim().min(1, 'Goal name is required').max(100, 'Name is too long'),
  target: moneyAmountSchema.refine((val) => val > 0, { message: 'Target amount must be greater than zero' }),
  source: z.string().min(1, 'Money place is required'),
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
  targetPlace: z.string().min(1, 'Money place is required'),
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

/**
 * Sign-in floor only — deliberately NOT the password policy.
 *
 * This validates credentials for accounts that already exist. Firebase only
 * ever issues accounts with ≥6 characters, so 6 is the widest floor that still
 * rejects an obvious typo, and raising it here would lock out every user who
 * registered before the policy changed. Accounts created now are held to
 * `signUpPasswordSchema`.
 */
export const authPasswordSchema = z.string().min(6, 'Password must be at least 6 characters');

/**
 * Policy for accounts being created now.
 *
 * This app holds somebody's budget, and a 6-character password is guessable.
 * `max` is a cheap guard against a multi-megabyte request body being fed to the
 * credential hasher.
 */
export const signUpPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');

export const loginSchema = z.object({
  email: authEmailSchema,
  password: authPasswordSchema,
});

export const signUpSchema = z.object({
  email: authEmailSchema,
  password: signUpPasswordSchema,
});

export const customCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50, 'Category name is too long'),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format'),
  icon: z.string().min(1, 'Icon is required'),
});
