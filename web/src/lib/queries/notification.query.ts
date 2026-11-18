import { asMutation, queryClient } from '#lib/queries/client.ts';
import {
  createNotification,
  deleteNotification,
  getNotifications,
  updateNotification,
  updateNotifications,
} from '@immich/sdk';
import { queryOptions } from '@tanstack/svelte-query';

export const getNotificationsQuery = () =>
  queryOptions({
    queryKey: ['notifications'],
    queryFn: ({ signal }) => getNotifications({}, { signal }),
    refetchInterval: 10_000,
  });

export const createNotificationMutation = () =>
  asMutation(createNotification, {
    meta: {
      success: { toast: { color: 'success', description: 'notification_sent' } },
      error: { toast: 'errors.failed_to_load_notifications' },
    },
  });

export const updateNotificationMutation = () =>
  asMutation(updateNotification, {
    onSuccess: (notification) =>
      queryClient.setQueryData(getNotificationsQuery().queryKey, (notifications) =>
        notifications?.map((item) => (item.id === notification.id ? notification : item)),
      ),
    meta: { error: { toast: 'errors.failed_to_update_notification_status' } },
  });

export const updateNotificationsMutation = () =>
  asMutation(updateNotifications, {
    onSuccess: (_, [{ notificationUpdateAllDto }]) =>
      queryClient.setQueryData(getNotificationsQuery().queryKey, (notifications) =>
        notifications?.map((item) =>
          notificationUpdateAllDto.ids.includes(item.id)
            ? { ...item, readAt: notificationUpdateAllDto.readAt ?? undefined }
            : item,
        ),
      ),
    meta: {
      success: { toast: { color: 'info', description: 'marked_all_as_read' } },
      error: { toast: 'errors.failed_to_update_notification_status' },
    },
  });

export const deleteNotificationMutation = () =>
  asMutation(deleteNotification, {
    onSuccess: (_, [{ id }]) =>
      queryClient.setQueryData(getNotificationsQuery().queryKey, (notifications) =>
        notifications?.filter((item) => item.id !== id),
      ),
    meta: {
      error: { toast: 'errors.failed_to_update_notification_status' },
    },
  });
