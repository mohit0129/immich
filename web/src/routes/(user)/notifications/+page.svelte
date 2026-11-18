<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import { createPreloadedQuery, executeMutation } from '#lib/queries/client.ts';
  import {
    deleteNotificationMutation,
    getNotificationsQuery,
    updateNotificationMutation,
  } from '#lib/queries/notification.query.ts';
  import { NotificationType, type NotificationDto } from '@immich/sdk';
  import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Container, IconButton } from '@immich/ui';
  import { mdiCheckAll, mdiFolderEyeOutline, mdiHeart, mdiMessageOutline, mdiShareVariant, mdiTrashCanOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();

  const notifQuery = createPreloadedQuery(getNotificationsQuery);
  const notifications = $derived(notifQuery.data ?? []);

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
  const displayedItems = $derived(activeSection === 'notifications' ? systemNotifications : socialUpdates);

  const handleMarkRead = async (id: string) => {
    await executeMutation(updateNotificationMutation, [
      { id, notificationUpdateDto: { readAt: new Date().toISOString() } },
    ]);
  };

  const handleDelete = async (id: string) => {
    await executeMutation(deleteNotificationMutation, [{ id }]);
  };

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.readAt) {
        await handleMarkRead(n.id);
      }
    }
  };
</script>

<UserPageLayout title={data.meta.title}>
  <Container size="medium" center>
    <div class="mt-4 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold dark:text-white">{$t('notifications')}</h1>
        {#if displayedItems.length > 0}
          <Button leadingIcon={mdiCheckAll} variant="ghost" size="small" onclick={handleMarkAllRead}>
            Mark all read
          </Button>
        {/if}
      </div>

      <div class="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors {activeSection === 'notifications' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
          onclick={() => (activeSection = 'notifications')}
        >
          <span>Notifications</span>
          {#if systemNotifications.filter(n => !n.readAt).length > 0}
            <span class="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {systemNotifications.filter(n => !n.readAt).length}
            </span>
          {/if}
        </button>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors {activeSection === 'updates' ? 'bg-primary text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
          onclick={() => (activeSection = 'updates')}
        >
          <span>Updates</span>
          {#if socialUpdates.filter(n => !n.readAt).length > 0}
            <span class="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {socialUpdates.filter(n => !n.readAt).length}
            </span>
          {/if}
        </button>
      </div>

      {#if displayedItems.length === 0}
        <Card class="p-8 text-center">
          <CardBody class="flex flex-col items-center justify-center gap-2">
            <span class="text-4xl">{activeSection === 'notifications' ? '🔔' : '💬'}</span>
            <span class="font-medium">No {activeSection === 'notifications' ? 'system notifications' : 'updates'}</span>
            <span class="text-sm text-gray-500">You're all caught up!</span>
          </CardBody>
        </Card>
      {:else}
        <div class="flex flex-col gap-2">
          {#each displayedItems as n (n.id)}
            <Card class="border dark:border-gray-800">
              <CardHeader class="flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <Badge
                    color={n.level === 'error'
                      ? 'danger'
                      : n.level === 'warning'
                        ? 'warning'
                        : n.level === 'success'
                          ? 'success'
                          : 'primary'}
                  >
                    {n.level?.toUpperCase()}
                  </Badge>
                  <CardTitle size="small">{n.title}</CardTitle>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                  {#if !n.readAt}
                    <Button variant="ghost" size="tiny" onclick={() => handleMarkRead(n.id)}>
                      Mark read
                    </Button>
                  {:else}
                    <Badge color="secondary">Read (7d)</Badge>
                  {/if}
                  <IconButton
                    size="small"
                    color="danger"
                    variant="ghost"
                    shape="round"
                    icon={mdiTrashCanOutline}
                    aria-label="Delete notification"
                    onclick={() => handleDelete(n.id)}
                  />
                </div>
              </CardHeader>
              {#if n.description}
                <CardBody class="pt-0 text-sm text-gray-600 dark:text-gray-300">
                  {n.description}
                </CardBody>
              {/if}
            </Card>
          {/each}
        </div>
      {/if}
    </div>
  </Container>
</UserPageLayout>
