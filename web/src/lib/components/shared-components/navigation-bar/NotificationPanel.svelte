<script lang="ts">
  import { focusTrap } from '#lib/actions/focus-trap.ts';
  import NotificationItem from '#lib/components/shared-components/navigation-bar/NotificationItem.svelte';
  import { OpenQueryParam } from '#lib/constants.ts';
  import { executeMutation } from '#lib/queries/client.ts';
  import {
    getNotificationsQuery,
    updateNotificationMutation,
    updateNotificationsMutation,
  } from '#lib/queries/notification.query.ts';
  import { Route } from '#lib/route.ts';
  import { NotificationType, type NotificationDto } from '@immich/sdk';
  import { Button, Icon, Scrollable, Stack, Text } from '@immich/ui';
  import { mdiBellOutline, mdiCheckAll } from '@mdi/js';
  import { createQuery } from '@tanstack/svelte-query';
  import { t } from 'svelte-i18n';
  import { flip } from 'svelte/animate';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';

  const query = createQuery(getNotificationsQuery);
  const notifications = $derived(query.data ?? []);

  const isSocialUpdate = (n: NotificationDto): boolean => {
    if (n.type === NotificationType.AlbumInvite) return true;
    if (
      n.title?.toLowerCase().includes('reaction') ||
      n.title?.toLowerCase().includes('comment') ||
      n.title?.toLowerCase().includes('shared album')
    )
      return true;
    if (
      n.description?.toLowerCase().includes('reacted') ||
      n.description?.toLowerCase().includes('commented') ||
      n.description?.toLowerCase().includes('shared an album')
    )
      return true;
    if (
      n.data &&
      typeof n.data === 'string' &&
      (n.data.includes('isReaction') || n.data.includes('isComment') || n.data.includes('albumId'))
    ) {
      return true;
    }
    return false;
  };

  let activeSection: 'notifications' | 'updates' = $state('notifications');
  const systemNotifications = $derived(notifications.filter((n) => !isSocialUpdate(n)));
  const socialUpdates = $derived(notifications.filter((n) => isSocialUpdate(n)));
  const displayedNotifications = $derived(activeSection === 'notifications' ? systemNotifications : socialUpdates);
  const noUnreadNotifications = $derived(displayedNotifications.length === 0);

  const markAllAsRead = () =>
    executeMutation(updateNotificationsMutation, [
      { notificationUpdateAllDto: { ids: displayedNotifications.map(({ id }) => id), readAt: new Date().toISOString() } },
    ]);

  const handleNotificationAction = async (notification: NotificationDto) => {
    switch (notification.type) {
      case NotificationType.AlbumInvite:
      case NotificationType.AlbumUpdate: {
        if (!notification.data) {
          return;
        }

        if (typeof notification.data !== 'string') {
          return;
        }

        const data = JSON.parse(notification.data);
        if (data?.albumId) {
          await goto(`/albums/${data.albumId}`);
        }

        break;
      }

      case NotificationType.ClusterGroupRequest: {
        await goto(Route.userSettings({ isOpen: OpenQueryParam.SHARING }));
        break;
      }

      default: {
        break;
      }
    }
  };

  const onclick = (notification: NotificationDto) =>
    executeMutation(
      updateNotificationMutation,
      [{ id: notification.id, notificationUpdateDto: { readAt: new Date().toISOString() } }],
      { onSuccess: () => void handleNotificationAction(notification) },
    );
</script>

<div
  in:fade={{ duration: 100 }}
  out:fade={{ duration: 100 }}
  id="notification-panel"
  class="absolute top-17.5 right-6 z-1 w-[min(360px,100vw-50px)] rounded-3xl border border-gray-200 bg-gray-100 text-light shadow-lg dark:border dark:border-light dark:bg-immich-dark-gray"
  {@attach focusTrap()}
>
  <Stack class="max-h-125">
    <div class="mx-4 mt-4 flex items-center justify-between">
      <Text size="medium" color="secondary" fontWeight="semi-bold">{$t('notifications')}</Text>
      <div>
        <Button
          variant="ghost"
          disabled={noUnreadNotifications}
          leadingIcon={mdiCheckAll}
          size="small"
          color="primary"
          onclick={() => markAllAsRead()}>{$t('mark_all_as_read')}</Button
        >
      </div>
    </div>

    <div class="mx-4 flex gap-1.5 rounded-xl bg-gray-200/80 p-1 dark:bg-gray-800">
      <button
        type="button"
        class="flex-1 py-1 text-center text-xs font-semibold rounded-lg transition-colors {activeSection === 'notifications' ? 'bg-white text-primary shadow-xs dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}"
        onclick={() => (activeSection = 'notifications')}
      >
        Notifications ({systemNotifications.length})
      </button>
      <button
        type="button"
        class="flex-1 py-1 text-center text-xs font-semibold rounded-lg transition-colors {activeSection === 'updates' ? 'bg-white text-primary shadow-xs dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'}"
        onclick={() => (activeSection = 'updates')}
      >
        Updates ({socialUpdates.length})
      </button>
    </div>

    <hr class="dark:border-black" />

    {#if noUnreadNotifications}
      <Stack
        class="flex flex-col place-content-center place-items-center py-12 text-gray-700 dark:text-gray-300"
        gap={1}
      >
        <Icon icon={mdiBellOutline} size="20"></Icon>
        <Text>{activeSection === 'notifications' ? $t('no_notifications') : 'No social updates'}</Text>
      </Stack>
    {:else}
      <Scrollable class="pb-6">
        <Stack gap={0}>
          {#each displayedNotifications as notification (notification.id)}
            <div animate:flip={{ duration: 400 }}>
              <NotificationItem {notification} {onclick} />
            </div>
          {/each}
        </Stack>
      </Scrollable>
    {/if}
  </Stack>
</div>
