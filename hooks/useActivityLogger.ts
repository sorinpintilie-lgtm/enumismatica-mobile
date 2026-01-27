import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../../shared/activityLogService';

/**
 * Hook to automatically log user activity in mobile app
 */
export function useActivityLogger(currentScreen: string) {
  const { user } = useAuth();
  const previousScreenRef = useRef<string>('');
  const screenStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;

    const logPageView = async () => {
      try {
        const metadata: any = {
          page: currentScreen,
          platform: 'mobile',
        };

        if (previousScreenRef.current) {
          metadata.previousPage = previousScreenRef.current;
        }

        await logActivity(
          user.uid,
          'page_view',
          metadata,
          user.email || undefined,
          user.displayName || undefined,
          (user as any).isAdmin || false
        );

        previousScreenRef.current = currentScreen;
        screenStartTimeRef.current = Date.now();
      } catch (error) {
        console.error('Failed to log page view:', error);
      }
    };

    logPageView();

    // Log page leave on unmount
    return () => {
      if (user && currentScreen) {
        const timeOnPage = Date.now() - screenStartTimeRef.current;
        logActivity(
          user.uid,
          'page_leave',
          {
            page: currentScreen,
            timeOnPage,
            platform: 'mobile',
          },
          user.email || undefined,
          user.displayName || undefined,
          (user as any).isAdmin || false
        ).catch((error) => {
          console.error('Failed to log page leave:', error);
        });
      }
    };
  }, [user, currentScreen]);
}

/**
 * Helper function to log specific events
 */
export async function logEvent(
  user: any,
  eventType: any,
  metadata: any = {}
): Promise<void> {
  if (!user) return;

  try {
    await logActivity(
      user.uid,
      eventType,
      { ...metadata, platform: 'mobile' },
      user.email || undefined,
      user.displayName || undefined,
      (user as any).isAdmin || false
    );
  } catch (error) {
    console.error(`Failed to log event ${eventType}:`, error);
  }
}
