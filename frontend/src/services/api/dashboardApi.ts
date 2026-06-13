import apiClient from '../../api/client';
import { HttpClient } from './types';
import { DashboardResponse } from '../../types/types';

/** Dashboard aggregate for a given local date. */
export const createDashboardApi = (client: HttpClient = apiClient) => ({
  /** Dashboard data for a date (GET /dashboard/:date). */
  getByDate: (date: string) =>
    client.get<DashboardResponse>(`/dashboard/${date}`).then(r => r.data),
});

export const dashboardApi = createDashboardApi();
