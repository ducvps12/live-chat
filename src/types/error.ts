export interface ErrorResponse {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
  };
}
