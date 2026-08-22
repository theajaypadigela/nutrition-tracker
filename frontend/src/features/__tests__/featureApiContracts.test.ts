import apiClient from '../../shared/api/client';
import { dashboardApi } from '../dashboard/api/dashboardApi';
import { foodLogApi } from '../food-log/api/foodLogApi';
import { habitApi } from '../habits/api/habitApi';
import { nutritionReportApi } from '../nutrition-report/api/nutritionReportApi';
import { voiceApi } from '../voice/api/voiceApi';
import { authApi } from '../auth/api/authApi';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

type MockApiMethod = jest.Mock<Promise<{ data: unknown }>, unknown[]>;

const mockGet = apiClient.get as unknown as MockApiMethod;
const mockPost = apiClient.post as unknown as MockApiMethod;
const mockPut = apiClient.put as unknown as MockApiMethod;
const mockDelete = apiClient.delete as unknown as MockApiMethod;

describe('feature API route contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
    mockPost.mockResolvedValue({ data: {} });
    mockPut.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
  });

  it('keeps dashboard routes and response unwrapping stable', async () => {
    mockGet.mockResolvedValueOnce({ data: { date: '2026-08-19' } });

    await expect(dashboardApi.getForDate('2026-08-19')).resolves.toEqual({
      date: '2026-08-19',
    });

    expect(mockGet).toHaveBeenCalledWith('/dashboard/2026-08-19');
  });

  it('keeps food-log verbs, paths, query params, and payloads stable', async () => {
    const entry = { name: 'Oats', quantity: 1, unit: 'bowl' };

    await foodLogApi.addEntries('2026-08-19', 'breakfast', [entry]);
    await foodLogApi.getForDate('2026-08-19');
    await foodLogApi.getRange('2026-08-13', '2026-08-19');
    await foodLogApi.updateEntry('2026-08-19', 'entry-1', entry);
    await foodLogApi.deleteEntry('2026-08-19', 'entry-1');

    expect(mockPost).toHaveBeenCalledWith(
      '/food/2026-08-19/meals/breakfast/entries',
      [entry],
    );
    expect(mockGet).toHaveBeenNthCalledWith(1, '/food/2026-08-19');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/food', {
      params: { from: '2026-08-13', to: '2026-08-19' },
    });
    expect(mockPut).toHaveBeenCalledWith(
      '/food/2026-08-19/meals/entries/entry-1',
      entry,
    );
    expect(mockDelete).toHaveBeenCalledWith(
      '/food/2026-08-19/meals/entries/entry-1',
    );
  });

  it('keeps nutrition report and preference contracts stable', async () => {
    const range = { startDate: '2026-08-13', endDate: '2026-08-19' };

    await nutritionReportApi.getWeekly(range);
    await nutritionReportApi.getAll(range);
    await nutritionReportApi.getInsights(range);
    await nutritionReportApi.togglePin('fiber');
    await nutritionReportApi.setTarget('fiber', 30);
    await nutritionReportApi.setAvoidedFoods('sugar', ['soda', 'cake']);
    await nutritionReportApi.getPreferences();

    expect(mockGet).toHaveBeenNthCalledWith(1, '/food/nutrition/weekly', {
      params: range,
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/food/nutrition/all', {
      params: range,
    });
    expect(mockGet).toHaveBeenNthCalledWith(3, '/food/nutrition/insights', {
      params: range,
    });
    expect(mockPost).toHaveBeenCalledWith('/food/nutrient/fiber/pin');
    expect(mockPut).toHaveBeenNthCalledWith(1, '/food/nutrient/fiber/target', {
      target: 30,
    });
    expect(mockPut).toHaveBeenNthCalledWith(2, '/food/nutrient/sugar/avoid', {
      foods: ['soda', 'cake'],
    });
    expect(mockGet).toHaveBeenNthCalledWith(4, '/food/nutrient/preferences');
  });

  it('keeps habit routes and camelCase voice payloads stable', async () => {
    const habit = {
      name: 'Walk',
      repeatDays: ['Wed'],
      reminderTime: '08:30 AM',
      reminderType: 'call' as const,
    };
    const voiceResult = {
      habitId: 9,
      habitName: 'Walk',
      habitStatus: 'rescheduled' as const,
      rescheduleMinutes: 15,
      completedAt: null,
    };

    await habitApi.create(habit);
    await habitApi.getAll();
    await habitApi.getToday();
    await habitApi.toggle('9', { habit: undefined });
    await habitApi.delete('9');
    await habitApi.recordVoiceResult(voiceResult);

    expect(mockPost).toHaveBeenNthCalledWith(1, '/habit', habit);
    expect(mockGet).toHaveBeenCalledWith('/habit');
    expect(mockGet).toHaveBeenCalledWith('/habit/today');
    expect(mockPost).toHaveBeenNthCalledWith(2, '/habit/9/toggle', {
      habit: undefined,
    });
    expect(mockDelete).toHaveBeenCalledWith('/habit/9');
    expect(mockPost).toHaveBeenNthCalledWith(
      3,
      '/habit/voice-result',
      voiceResult,
    );
  });

  it('keeps authenticated voice token and transcript routes stable', async () => {
    await voiceApi.getCallToken();
    await voiceApi.parseMealTranscript({ transcript: 'You: oatmeal' });

    expect(mockGet).toHaveBeenCalledWith('/food/voice/token');
    expect(mockPost).toHaveBeenCalledWith('/food/voice-log/parse-transcript', {
      transcript: 'You: oatmeal',
    });
  });

  it('sends and retains the user timezone at auth boundaries', async () => {
    const registration = {
      name: 'Asha',
      email: 'asha@example.com',
      password: 'password1',
      age: '31',
      gender: 'female',
      timezone: 'Asia/Kolkata',
    };
    const profileUpdate = {
      name: 'Asha',
      age: '32',
      gender: 'female',
      timezone: 'Asia/Kolkata',
    };

    mockPut.mockResolvedValueOnce({
      data: { id: 7, email: registration.email, ...profileUpdate },
    });

    await authApi.register(registration);
    await expect(authApi.updateProfile(profileUpdate)).resolves.toMatchObject({
      id: '7',
      timezone: 'Asia/Kolkata',
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/register', registration);
    expect(mockPut).toHaveBeenCalledWith('/profile', profileUpdate);
  });
});
