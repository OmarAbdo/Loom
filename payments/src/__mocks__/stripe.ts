/**
 * Manual mock for ../stripe used in tests (jest.mock('../stripe')).
 * charges.create resolves with a fake charge id — no real Stripe call.
 */
export const stripe = {
  charges: {
    create: jest.fn().mockResolvedValue({ id: 'ch_test_' + Math.random().toString(36).slice(2) }),
  },
};
