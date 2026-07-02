import { createAuthApi } from '../authApi';
import { createHabitApi } from '../habitApi';
import { createFoodLogApi } from '../foodLogApi';
import { createNutritionApi } from '../nutritionApi';
import { createDashboardApi } from '../dashboardApi';
import { HttpClient } from '../types';

const makeClient = () => {
  const ok = (data: any = {}) => Promise.resolve({ data } as any);
  return {
    get: jest.fn(() => ok()),
    post: jest.fn(() => ok()),
    put: jest.fn(() => ok()),
    delete: jest.fn(() => ok()),
  } as unknown as jest.Mocked<HttpClient>;
};

describe('authApi', () => {
  it('issues the expected requests and returns response.data', async () => {
    const client = makeClient();
    const api = createAuthApi(client);

    (client.get as jest.Mock).mockResolvedValueOnce({ data: { id: '1' } });
    await expect(api.me()).resolves.toEqual({ id: '1' });
    expect(client.get).toHaveBeenCalledWith('/auth/me');

    await api.login('a@b.c', 'pw');
    expect(client.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.c',
      password: 'pw',
    });

    await api.register('Bo', 'bo@x.io', 'pw', '2000-05-15', 'm');
    expect(client.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Bo',
      email: 'bo@x.io',
      password: 'pw',
      dob: '2000-05-15',
      gender: 'm',
    });

    await api.updateProfile('Ada', '31', 'f');
    expect(client.put).toHaveBeenCalledWith('/profile', {
      name: 'Ada',
      age: '31',
      gender: 'f',
    });
  });
});

describe('habitApi', () => {
  it('issues the expected habit requests', async () => {
    const client = makeClient();
    const api = createHabitApi(client);

    await api.getToday();
    expect(client.get).toHaveBeenCalledWith('/habit/today');

    const payload = {
      name: 'Walk',
      repeatDays: ['Mon'],
      reminderTime: '08:00',
      reminderType: 'notification',
    };
    await api.create(payload);
    expect(client.post).toHaveBeenCalledWith('/habit', payload);

    await api.toggle('123');
    expect(client.post).toHaveBeenCalledWith('/habit/123/toggle');

    await api.remove('123');
    expect(client.delete).toHaveBeenCalledWith('/habit/123');

    await api.interpretVoice(['line1'], 'Walk', '08:00');
    expect(client.post).toHaveBeenCalledWith('/habit/interpret-voice', {
      transcriptLines: ['line1'],
      habitName: 'Walk',
      habitTime: '08:00',
    });

    const result = {
      habitId: 'h1',
      habitName: 'Walk',
      habitStatus: 'completed',
      rescheduleMinutes: null,
      completedAt: '2026-06-14T08:00:00Z',
    };
    await api.submitVoiceResult(result);
    expect(client.post).toHaveBeenCalledWith('/habit/voice-result', result);
  });
});

describe('foodLogApi', () => {
  it('issues the expected food-log requests', async () => {
    const client = makeClient();
    const api = createFoodLogApi(client);

    await api.getLog('2026-06-14');
    expect(client.get).toHaveBeenCalledWith('/food/2026-06-14');

    const entry = { name: 'Egg', quantity: 2, unit: 'pcs' };
    await api.updateEntry('2026-06-14', 'e1', entry);
    expect(client.put).toHaveBeenCalledWith(
      '/food/2026-06-14/meals/entries/e1',
      entry,
    );

    await api.deleteEntry('e1');
    expect(client.delete).toHaveBeenCalledWith('/food/meals/entries/e1');

    await api.addEntries('2026-06-14', 'breakfast', [entry]);
    expect(client.post).toHaveBeenCalledWith(
      '/food/2026-06-14/meals/breakfast/entries',
      [entry],
    );

    const cfg = { timeout: 1000 };
    await api.interpretTranscript('ate eggs', 'breakfast', cfg);
    expect(client.post).toHaveBeenCalledWith(
      '/food/voice-log/interpret-transcript',
      { transcript: 'ate eggs', mealSlotId: 'breakfast' },
      cfg,
    );

    await api.parseTranscript('ate eggs', '2026-06-14', cfg);
    expect(client.post).toHaveBeenCalledWith(
      '/food/voice-log/parse-transcript',
      { transcript: 'ate eggs', logDate: '2026-06-14' },
      cfg,
    );
  });
});

describe('nutritionApi', () => {
  const range = { startDate: '2026-06-08', endDate: '2026-06-14' };

  it('issues the expected nutrition requests with the original query strings', async () => {
    const client = makeClient();
    const api = createNutritionApi(client);

    await api.getWeeklyReport(range);
    expect(client.get).toHaveBeenCalledWith(
      '/food/nutrition/weekly?startDate=2026-06-08&endDate=2026-06-14',
    );

    await api.getAllNutrients(range);
    expect(client.get).toHaveBeenCalledWith(
      '/food/nutrition/all?startDate=2026-06-08&endDate=2026-06-14',
    );

    await api.getInsights(range);
    expect(client.get).toHaveBeenCalledWith(
      '/food/nutrition/insights?startDate=2026-06-08&endDate=2026-06-14',
    );

    await api.pinNutrient('n1');
    expect(client.post).toHaveBeenCalledWith('/food/nutrient/n1/pin');

    await api.setNutrientTarget('n1', 12.5);
    expect(client.put).toHaveBeenCalledWith('/food/nutrient/n1/target', {
      target: 12.5,
    });

    await api.markNutrientAvoid('n1', ['soda', 'cake']);
    expect(client.put).toHaveBeenCalledWith('/food/nutrient/n1/avoid', {
      foods: ['soda', 'cake'],
    });
  });
});

describe('dashboardApi', () => {
  it('fetches the dashboard for a date', async () => {
    const client = makeClient();
    const api = createDashboardApi(client);
    (client.get as jest.Mock).mockResolvedValueOnce({ data: { date: '2026-06-14' } });

    await expect(api.getByDate('2026-06-14')).resolves.toEqual({
      date: '2026-06-14',
    });
    expect(client.get).toHaveBeenCalledWith('/dashboard/2026-06-14');
  });
});
