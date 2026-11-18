<script lang="ts">
  import UserAvatar from '#lib/components/shared-components/UserAvatar.svelte';
  import { executeMutation } from '#lib/queries/client.ts';
  import { createNotificationMutation } from '#lib/queries/notification.query.ts';
  import { NotificationLevel, type UserAdminResponseDto } from '@immich/sdk';
  import { Field, FormModal, Input } from '@immich/ui';
  import { mdiBellOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';

  type Props = {
    users: UserAdminResponseDto[];
    onClose: () => void;
  };

  let { users, onClose }: Props = $props();

  let title = $state('');
  let description = $state('');
  let level = $state<NotificationLevel>(NotificationLevel.Info);
  let targetType = $state<'all' | 'selected'>('all');
  const selectedUserIds = new SvelteSet<string>();

  const activeUsers = $derived(users.filter((u) => !u.deletedAt && (u.status as any) !== 'suspended'));

  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.has(userId)) {
      selectedUserIds.delete(userId);
    } else {
      selectedUserIds.add(userId);
    }
  };

  const onSubmit = async () => {
    if (!title.trim()) return;

    await executeMutation(
      createNotificationMutation,
      [
        {
          notificationCreateDto: {
            title: title.trim(),
            description: description.trim() || undefined,
            level,
            allUsers: targetType === 'all',
            userIds: targetType === 'selected' ? [...selectedUserIds] : undefined,
          } as any,
        },
      ],
      {
        onSuccess: onClose,
      },
    );
  };
</script>

<FormModal
  title={$t('send_notification')}
  icon={mdiBellOutline}
  submitText={$t('send_notification')}
  cancelText={$t('back')}
  {onSubmit}
  disabled={!title.trim() || (targetType === 'selected' && selectedUserIds.size === 0)}
  {onClose}
>
  <div class="flex flex-col gap-4 p-2">
    <Field label={$t('notification_title')}>
      <Input bind:value={title} placeholder="System maintenance notice" required />
    </Field>

    <Field label={$t('notification_description')}>
      <Input bind:value={description} placeholder="Details about this announcement..." />
    </Field>

    <Field label={$t('notification_level')}>
      <select
        bind:value={level}
        class="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-700 dark:bg-immich-dark-gray dark:text-white"
      >
        <option value={NotificationLevel.Info}>Info</option>
        <option value={NotificationLevel.Success}>Success</option>
        <option value={NotificationLevel.Warning}>Warning</option>
        <option value={NotificationLevel.Error}>Error</option>
      </select>
    </Field>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium">Audience</span>
      <div class="flex gap-4">
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="targetType"
            value="all"
            checked={targetType === 'all'}
            onchange={() => (targetType = 'all')}
          />
          <span class="text-sm">{$t('all_users')} ({activeUsers.length})</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="targetType"
            value="selected"
            checked={targetType === 'selected'}
            onchange={() => (targetType = 'selected')}
          />
          <span class="text-sm">{$t('selected_users')} ({selectedUserIds.size})</span>
        </label>
      </div>
    </div>

    {#if targetType === 'selected'}
      <div class="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg border p-2 dark:border-gray-700">
        <span class="text-xs text-gray-500">Select users:</span>
        {#each activeUsers as u (u.id)}
          <button
            type="button"
            class="flex items-center gap-3 rounded p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 {selectedUserIds.has(
              u.id,
            )
              ? 'bg-primary/10'
              : ''}"
            onclick={() => handleToggleUser(u.id)}
          >
            <input
              type="checkbox"
              checked={selectedUserIds.has(u.id)}
              onchange={() => handleToggleUser(u.id)}
              class="rounded"
            />
            <UserAvatar user={u} size="sm" />
            <div class="flex flex-col">
              <span class="text-sm font-medium">{u.name || u.email}</span>
              <span class="text-xs text-gray-500">{u.email}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</FormModal>
