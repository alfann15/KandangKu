import { auth } from '@/lib/auth';
import { ActionResponse } from '@/lib/types';

export async function requireAuth(): Promise<{ id_kasir: number; role: string } | ActionResponse> {
  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      message: 'Unauthorized',
      error: 'UNAUTHORIZED',
    };
  }
  const id_kasir = parseInt(session.user.id as string, 10);
  const role = (session.user as any).role as string;
  return { id_kasir, role };
}

export function handleActionError(error: unknown, fallbackMessage: string): ActionResponse {
  if (error instanceof Error) {
    return {
      success: false,
      message: error.message,
      error: 'ACTION_ERROR',
    };
  }
  return {
    success: false,
    message: fallbackMessage,
    error: 'UNKNOWN_ERROR',
  };
}
