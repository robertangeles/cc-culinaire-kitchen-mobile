// AsyncStorage jest mock is registered globally in jest.setup.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearCount, feedbackCountKey, getCount, incrementCount } from '@/services/feedbackCount';

describe('feedbackCount', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('feedbackCountKey namespaces under feedback.count.<owner>', () => {
    expect(feedbackCountKey(42)).toBe('feedback.count.42');
    expect(feedbackCountKey('anon')).toBe('feedback.count.anon');
  });

  it('getCount returns 0 when no entry exists', async () => {
    expect(await getCount(42)).toBe(0);
  });

  it('incrementCount increases by 1 and persists', async () => {
    await incrementCount(7);
    await incrementCount(7);
    expect(await getCount(7)).toBe(2);
    expect(await AsyncStorage.getItem('feedback.count.7')).toBe('2');
  });

  it('getCount returns 0 when stored value is corrupt', async () => {
    await AsyncStorage.setItem('feedback.count.99', 'not-a-number');
    expect(await getCount(99)).toBe(0);
  });

  it('getCount returns 0 on a negative stored value (defensive)', async () => {
    await AsyncStorage.setItem('feedback.count.99', '-3');
    expect(await getCount(99)).toBe(0);
  });

  it('keys for different owners are isolated', async () => {
    await incrementCount(1);
    await incrementCount(1);
    await incrementCount(2);
    expect(await getCount(1)).toBe(2);
    expect(await getCount(2)).toBe(1);
  });

  it('anon keys are independent of numeric user_id keys', async () => {
    await incrementCount('anon');
    await incrementCount(1);
    expect(await getCount('anon')).toBe(1);
    expect(await getCount(1)).toBe(1);
  });

  it('clearCount removes the entry', async () => {
    await incrementCount(5);
    await clearCount(5);
    expect(await AsyncStorage.getItem('feedback.count.5')).toBeNull();
  });
});
