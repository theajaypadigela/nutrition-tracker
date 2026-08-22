import apiClient from '../../../shared/api/client';
import type { DashboardResponse } from '../../../types/types';

export const dashboardApi = {
  async getForDate(date: string): Promise<DashboardResponse> {
    const { data } = await apiClient.get<DashboardResponse>(
      `/dashboard/${date}`,
    );
    return data;
  },
};
