import { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Minimal HTTP surface the domain services depend on (Dependency Inversion).
 *
 * The configured axios instance satisfies this structurally, so production code passes
 * it (the default). Tests pass a lightweight mock implementing only these four methods,
 * with no need to jest.mock the axios module.
 */
export interface HttpClient {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}
