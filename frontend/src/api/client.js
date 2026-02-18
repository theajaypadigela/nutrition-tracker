import axios from 'axios';
import { Platform } from 'react-native';

const baseURL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8080/'
    : 'http://localhost:8080/';

const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

export default apiClient;
