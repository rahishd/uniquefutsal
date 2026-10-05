export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  data?: T;
  message: string;
  timestamp: Date;
}

export class ApiResponseUtil {
  static success<T>(
    statusCode: number,
    message: string,
    data?: T,
  ): ApiResponse<T> {
    return {
      success: true,
      statusCode,
      data,
      message,
      timestamp: new Date(),
    };
  }

  static error(
    statusCode: number = 500,
    message: string = "Internal server error",
  ): ApiResponse {
    return {
      success: false,
      statusCode,
      message,
      timestamp: new Date(),
    };
  }
}

export default ApiResponseUtil;
