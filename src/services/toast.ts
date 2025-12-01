import toast, { ToastOptions } from 'react-hot-toast';
import { Logger } from './logger';

/**
 * Unified Toast Notification Service
 * Centralized notification system for the application
 */
export class ToastService {
  /**
   * Show success notification
   */
  static success(message: string, options?: ToastOptions) {
    Logger.info('Toast: Success', { message });
    return toast.success(message, {
      duration: 4000,
      position: 'top-right',
      ...options,
    });
  }

  /**
   * Show error notification
   */
  static error(message: string, options?: ToastOptions) {
    Logger.error('Toast: Error', { message });
    return toast.error(message, {
      duration: 5000,
      position: 'top-right',
      ...options,
    });
  }

  /**
   * Show warning notification
   */
  static warn(message: string, options?: ToastOptions) {
    Logger.warn('Toast: Warning', { message });
    return toast(message, {
      icon: '⚠️',
      duration: 4000,
      position: 'top-right',
      ...options,
    });
  }

  /**
   * Show info notification
   */
  static info(message: string, options?: ToastOptions) {
    Logger.info('Toast: Info', { message });
    return toast(message, {
      icon: 'ℹ️',
      duration: 3000,
      position: 'top-right',
      ...options,
    });
  }

  /**
   * Show loading notification (returns toast ID for dismissing)
   */
  static loading(message: string, options?: ToastOptions): string {
    Logger.info('Toast: Loading', { message });
    return toast.loading(message, {
      position: 'top-right',
      ...options,
    });
  }

  /**
   * Dismiss a specific toast
   */
  static dismiss(toastId: string) {
    toast.dismiss(toastId);
  }

  /**
   * Dismiss all toasts
   */
  static dismissAll() {
    toast.dismiss();
  }

  /**
   * Promise toast - shows loading, then success/error based on promise result
   */
  static async promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    },
    options?: ToastOptions
  ): Promise<T> {
    const loadingToastId = ToastService.loading(messages.loading, options);
    
    try {
      const data = await promise;
      ToastService.dismiss(loadingToastId);
      
      const successMessage = typeof messages.success === 'function'
        ? messages.success(data)
        : messages.success;
      
      ToastService.success(successMessage, options);
      return data;
    } catch (error: any) {
      ToastService.dismiss(loadingToastId);
      
      const errorMessage = typeof messages.error === 'function'
        ? messages.error(error)
        : messages.error;
      
      ToastService.error(errorMessage, options);
      throw error;
    }
  }
}

// Export default toast instance for convenience
export default toast;

