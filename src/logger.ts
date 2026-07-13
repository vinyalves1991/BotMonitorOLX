const timestamp = () => new Date().toISOString();

export const logger = {
  info(message: string, data?: unknown) {
    console.log(`[${timestamp()}] INFO  ${message}`, data ?? "");
  },

  warn(message: string, data?: unknown) {
    console.warn(`[${timestamp()}] WARN  ${message}`, data ?? "");
  },

  error(message: string, error?: unknown) {
    console.error(`[${timestamp()}] ERROR ${message}`);
    if (error instanceof Error) {
      console.error(error.message);
      return;
    }

    if (error) {
      console.error(error);
    }
  }
};
