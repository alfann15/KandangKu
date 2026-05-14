export type ActionResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
};
