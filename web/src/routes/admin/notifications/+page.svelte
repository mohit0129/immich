<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import SendNotificationModal from '#lib/modals/SendNotificationModal.svelte';
  import { createPreloadedQuery, queryClient } from '#lib/queries/client.ts';
  import { getNotificationsQuery } from '#lib/queries/notification.query.ts';
  import { searchUsersAdminQuery } from '#lib/queries/user-admin.query.ts';
  import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Container,
    IconButton,
    modalManager,
    toastManager,
    type ActionItem,
  } from '@immich/ui';
  import { mdiBellOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();

  const usersQuery = createPreloadedQuery(() => searchUsersAdminQuery({ withDeleted: true }));
  const users = $derived(usersQuery.data ?? []);

  const notifQuery = createPreloadedQuery(getNotificationsQuery);
  const notifications = $derived(notifQuery.data ?? []);

  const SendNotification = $derived<ActionItem>({
    title: $t('send_notification'),
    icon: mdiPlus,
    onAction: () => modalManager.show(SendNotificationModal, { users }),
  });

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) return;
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toastManager.primary('Notification removed');
        await queryClient.invalidateQueries({ queryKey: getNotificationsQuery().queryKey });
      } else {
        toastManager.danger('Failed to delete notification');
      }
    } catch {
      toastManager.danger('Failed to delete notification');
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '';
    const user = users.find((u) => u.id === userId);
    return user ? user.name || user.email : '';
  };
</script>

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]} actions={[SendNotification]}>
  <Container size="large" center>
    <div class="mt-4 flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold dark:text-white">{$t('notifications')}</h1>
          <p class="text-sm text-gray-500">Manage, broadcast, and remove system notifications</p>
        </div>
        <Button
          leadingIcon={mdiPlus}
          color="primary"
          onclick={() => modalManager.show(SendNotificationModal, { users })}
        >
          {$t('send_notification')}
        </Button>
      </div>

      {#if notifications.length === 0}
        <Card class="p-8 text-center">
          <CardBody class="flex flex-col items-center justify-center gap-2">
            <span class="text-4xl">🔔</span>
            <span class="font-medium">No notifications yet</span>
            <span class="text-sm text-gray-500">Broadcast a message or alert to users using the button above.</span>
          </CardBody>
        </Card>
      {:else}
        <div class="flex flex-col gap-2">
          {#each notifications as n (n.id)}
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
                  {#if n.userId}
                    <span class="text-xs text-gray-500">
                      To: {getUserName(n.userId) || 'User'}
                    </span>
                  {/if}
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                  <Badge color={n.readAt ? 'secondary' : 'primary'}>
                    {n.readAt ? 'Read (7d)' : 'Unread'}
                  </Badge>
                  <IconButton
                    size="small"
                    color="danger"
                    variant="ghost"
                    shape="round"
                    icon={mdiTrashCanOutline}
                    aria-label="Delete notification"
                    onclick={() => handleDeleteNotification(n.id)}
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
</AdminPageLayout>
