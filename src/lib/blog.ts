export interface BlogSection {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  callout?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  dateTime: string;
  readTime: string;
  sections: readonly BlogSection[];
}

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'what-its-for-vs-where-it-is',
    title: "Why 'what it's for' and 'where it is' are two different questions",
    excerpt:
      'Most budgeting frustration comes from mixing up two things that should stay separate: what your money is meant to cover, and where it physically sits right now.',
    date: 'July 2026',
    dateTime: '2026-07-15',
    readTime: '4 min read',
    sections: [
      {
        heading: 'A budget and a balance answer different questions',
        paragraphs: [
          'A budget describes your intention. It assigns income to jobs such as rent, groceries, entertainment, and savings. A balance describes location: the amount currently held in a bank account, at home, or in a wallet.',
          'Those views are related, but they are not interchangeable. The money reserved for groceries might be split between your bank and your wallet. Your bank balance might include money intended for rent, savings, and several other categories at the same time.',
        ],
      },
      {
        heading: "The first question: what is the money for?",
        paragraphs: [
          'This is the planning side of budgeting. Flousy groups a plan into needs, wants, and savings. Categories make those broad envelopes useful: rent and basic groceries can sit under needs, while dining out or entertainment can sit under wants.',
          'The answer should remain meaningful even if you move cash from the bank to your wallet. A transfer changes where the money is held, but it does not turn grocery money into entertainment money or change the purpose of your savings.',
        ],
        bullets: [
          'Needs cover essential commitments and everyday necessities.',
          'Wants cover optional spending that can usually be adjusted.',
          'Savings covers money set aside for goals or future use.',
        ],
      },
      {
        heading: 'The second question: where is the money?',
        paragraphs: [
          'Location is an accounting question. If you withdraw 300 from your bank and put it in your wallet, your total money has not changed. The bank balance falls by 300 and the wallet balance rises by 300.',
          'Recording the location matters when you pay. A cash purchase should reduce the wallet, while a card purchase should reduce the bank. This makes each place useful as a real balance rather than a rough note.',
        ],
      },
      {
        heading: 'What goes wrong when the two views are mixed',
        paragraphs: [
          'Suppose your plan reserves 2,000 for needs, but you currently hold 1,500 in the bank and 500 in your wallet. Treating “bank” as if it were a budget category makes it look as though only the bank money can pay for needs. Treating “needs” as if it were an account makes it impossible to know whether enough cash is actually in your wallet.',
          'The confusion becomes more obvious after transfers, cash spending, or funding a savings goal. One action can affect a location without changing the plan, while another can use a budget category and reduce a location at the same time.',
        ],
        callout:
          'A useful rule: categories explain purpose; money places explain location. A transfer changes location, while an expense changes both a location and the amount spent from the plan.',
      },
      {
        heading: 'A practical monthly workflow',
        paragraphs: [
          'Start by assigning income across needs, wants, and savings. Then record the opening amounts held in each money place. During the month, choose both a category and a payment place for every expense. Record transfers separately so they do not appear as spending.',
          'Review the two views for different reasons. Use category progress to decide whether your spending still matches the plan. Use money-place balances to decide whether the bank, home, or wallet has enough available for the next payment.',
        ],
        bullets: [
          'Plan income by purpose at the start of the month.',
          'Track bank, home, and wallet as separate balances.',
          'Record transfers without counting them as income or spending.',
          'For each expense, record what it was for and where it was paid from.',
        ],
      },
      {
        heading: 'Clarity comes from keeping both views',
        paragraphs: [
          'A category-only budget can show that you overspent on dining out, but not whether the missing cash came from your wallet or bank. A balance-only tracker can show how much is in each place, but not whether that money is reserved for next week’s rent.',
          'Keeping purpose and location separate provides both answers without forcing one set of labels to do two jobs. That distinction is the basis of Flousy’s needs, wants, and savings envelopes and its bank, home, and wallet money places.',
        ],
      },
    ],
  },
  {
    slug: 'pick-a-budgeting-style',
    title: 'Picking a budgeting style that actually fits you',
    excerpt:
      "50/30/20 isn't for everyone. Here's how to think about which split of needs, wants, and savings matches how you actually live.",
    date: 'June 2026',
    dateTime: '2026-06-18',
    readTime: '5 min read',
    sections: [
      {
        heading: 'A budgeting method is a starting structure',
        paragraphs: [
          'A budgeting method gives each part of your income a default job. It can reduce the number of decisions you make each month, but it cannot know your rent, family responsibilities, irregular income, or current savings goal.',
          'The useful question is not which method is universally best. It is which starting structure most closely resembles your real obligations and the habit you want to build next.',
        ],
      },
      {
        heading: 'Begin with your non-negotiable needs',
        paragraphs: [
          'List essential housing, utilities, food, transport, health costs, and minimum debt commitments. Compare their monthly total with your take-home income. This gives you a needs percentage based on reality rather than a rule of thumb.',
          'If essential costs already use more than half of your income, forcing them into a 50% limit will not make the bills disappear. Choose a structure with more room for needs, then look for changes that are actually possible over time.',
        ],
        callout:
          'Use percentages as planning guides, not as a verdict. A realistic budget you can follow is more useful than an ideal split that fails every month.',
      },
      {
        heading: 'The four strategies available in Flousy',
        paragraphs: [
          'Flousy offers four strategies. Each one divides income into needs, wants, and savings, while still letting you edit category caps to match your month.',
        ],
        bullets: [
          '50/30/20 uses 50% for needs, 30% for wants, and 20% for savings. It is a balanced starting point when essentials fit near half of income.',
          'Zero-based budgeting starts at 60% for needs, 25% for wants, and 15% for savings in Flousy. Its core habit is giving all income an explicit job rather than leaving money unplanned.',
          'Envelope budgeting starts at 55% for needs, 35% for wants, and 10% for savings. It suits people who want visible category limits and frequent spending checks.',
          'Pay-yourself-first uses 45% for needs, 25% for wants, and 30% for savings. It puts a larger savings allocation in place before optional spending.',
        ],
      },
      {
        heading: 'Choose based on the problem you want to solve',
        paragraphs: [
          'If you mainly need a simple baseline, begin with 50/30/20. If money regularly remains unassigned and then disappears, zero-based budgeting creates a job for it. If one or two categories repeatedly run over, envelope budgeting makes those boundaries easier to see.',
          'Pay-yourself-first can help when saving is always postponed until the end of the month. It works best when the higher savings share still leaves enough for essential commitments.',
        ],
      },
      {
        heading: 'Test the method against a real month',
        paragraphs: [
          'Before committing, apply the split to last month’s take-home income. Compare the resulting amounts with what you actually spent on needs, wants, and savings. One unusual month should not decide everything, so repeat the comparison across two or three months if you have the records.',
          'Look for the size and direction of the mismatch. A small difference can be handled by adjusting category caps. A large, repeated difference usually means the strategy is not the right starting point yet.',
        ],
        bullets: [
          'Can the needs allocation cover essential bills without pretending they are optional?',
          'Does the wants allocation leave room for a plan you can realistically maintain?',
          'Is the savings target challenging but still repeatable?',
          'Can you explain where every part of the income will go?',
        ],
      },
      {
        heading: 'Change strategies when your life changes',
        paragraphs: [
          'A budgeting method is not a permanent identity. Moving, changing jobs, paying off a debt, supporting family, or reaching a major savings goal can all change the split that makes sense.',
          'Review the strategy when the same categories miss their targets for several months. First check whether the transactions are complete and the category caps are realistic. If the overall allocation still does not fit, switch the starting structure rather than repeatedly fighting it.',
        ],
      },
      {
        heading: 'Consistency matters more than the label',
        paragraphs: [
          'The best method is the one that helps you make decisions before spending and review the result afterward. Its name matters less than whether the numbers reflect your income, cover real needs, and leave a deliberate amount for both wants and savings.',
          'Start with the closest fit, adjust it using real spending, and revisit it when circumstances change. That turns a budgeting style from a fixed rule into a practical monthly tool.',
        ],
      },
    ],
  },
  {
    slug: 'track-cash-wallet-spending',
    title: 'The wallet leak: where small cash spending quietly adds up',
    excerpt:
      'Card spending is easy to track. Cash is where budgets usually spring a leak. A few habits that make wallet spending visible again.',
    date: 'May 2026',
    dateTime: '2026-05-20',
    readTime: '3 min read',
    sections: [
      {
        heading: 'Cash becomes invisible faster than card spending',
        paragraphs: [
          'A card payment usually leaves a searchable line in a banking app. Cash only leaves a receipt, a handful of coins, or a memory. Small purchases feel harmless on their own, so they are easy to postpone recording and easy to forget.',
          'The result is a familiar mismatch: the budget says money remains, but the wallet is nearly empty. The missing amount is often not one large expense. It is a series of transport fares, snacks, tips, and quick purchases that never reached the record.',
        ],
      },
      {
        heading: 'Treat the wallet as a balance, not a category',
        paragraphs: [
          'A wallet tells you where money is held. It does not explain what the money is for. Cash in the same wallet can pay for groceries, transport, or entertainment, so each purchase still needs a spending category.',
          'When you withdraw cash, record a transfer from bank to wallet. Do not record the withdrawal as an expense: your total money has not fallen yet. Record the expense only when the cash is actually spent, and reduce the wallet balance at that point.',
        ],
        callout:
          'Withdrawal: bank goes down and wallet goes up. Cash purchase: wallet goes down and the relevant spending category goes up.',
      },
      {
        heading: 'Use a capture habit that takes seconds',
        paragraphs: [
          'The best tracking routine is the one you can repeat while the purchase is still fresh. Enter the amount immediately, keep the receipt in one pocket until you log it, or add all cash purchases at one fixed time each evening.',
          'Do not wait for a perfect category name. A clear description, amount, broad category, and wallet payment place are enough. You can refine the entry later; reconstructing forgotten cash spending is much harder.',
        ],
        bullets: [
          'Log the purchase before putting the wallet away.',
          'If that is impractical, keep every unrecorded receipt in one place.',
          'Use a daily reminder until the action becomes automatic.',
          'Avoid a generic “cash” category; classify what the purchase was actually for.',
        ],
      },
      {
        heading: 'Reconcile the wallet once a week',
        paragraphs: [
          'Count the cash in your wallet and compare it with the tracked wallet balance. If the difference is small, review recent receipts and routine purchases. Correct the missing entries instead of silently changing the balance whenever possible.',
          'A weekly check keeps the search window short. It also shows whether the issue is missing transactions or a category that is consistently using more cash than planned.',
        ],
      },
      {
        heading: 'Give cash a deliberate limit',
        paragraphs: [
          'Some people find it easier to transfer a planned amount to the wallet at the start of the week. That amount is not a new budget category; it is a practical limit on how much cash is immediately available.',
          'When the wallet runs low, check the category balances before adding more. The pause makes small spending visible and prevents repeated withdrawals from hiding how much has already been used.',
        ],
      },
      {
        heading: 'The goal is an honest record, not perfect memory',
        paragraphs: [
          'Cash tracking works when transfers and purchases are treated as different events. Record where the cash moved, then record what it paid for. A short capture habit and a regular wallet count close most of the gap.',
          'Once cash spending is visible, it can be planned like any other spending. You can decide whether a category needs a larger cap, whether a habit should change, or whether carrying less cash makes the month easier to manage.',
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
